# 🎓 Notificador de Catedráticos ULSA - Documentación Técnica Avanzada

Este documento consolida a nivel de ingeniería la arquitectura, el funcionamiento algorítmico y el código fuente del **Notificador de Catedráticos IoT**. Diseñado para la automatización de la comunicación en cubículos universitarios.

---

## 1. 🎯 Topología y Arquitectura del Sistema

El proyecto opera bajo un modelo **Cliente-Servidor-Hardware (IoT)** impulsado por eventos (Event-Driven). 

*   **Cliente (Frontend):** Aplicación Web React consumida por estudiantes y maestros.
*   **Servidor (Backend):** Google Firebase Realtime Database (Base de datos NoSQL basada en WebSockets).
*   **Hardware (Edge/IoT):** Placa ESP32 programada en C++ (PlatformIO) manejando interrupciones físicas y reproducción de audio.

---

## 2. 💻 Frontend: Lógica Web (React)

El frontend no es solo una interfaz; tiene reglas estrictas de negocio para el control de la concurrencia y la prevención de spam.

### 2.1. Bloqueo Anti-Spam por Dispositivo (`App.jsx`)
Para evitar que un estudiante "juegue" con el sistema haciendo múltiples peticiones, la App ancla el dispositivo a la llamada en curso usando memoria persistente.

**Fragmento Clave (Manejo del candado y auto-liberación):**
```javascript
// App.jsx - useEffect de auto-liberación
useEffect(() => {
  let timer;
  if (activeQueueId && colas) {
    const miLlamada = colas[`ll_${activeQueueId}`];
    
    // Si la llamada sigue existiendo pero ya fue respondida por el hardware
    if (miLlamada && (miLlamada.estado === 'voy_en_camino' || miLlamada.estado === 'ocupado' || miLlamada.estado === 'timeout')) {
      
      // Mantiene el color verde/rojo en pantalla por 6 segundos para que el alumno lo lea
      timer = setTimeout(() => {
        handleReleaseCall(); // Elimina el bloqueo local y físicamente borra el nodo de Firebase
      }, 6000);
      
    } else if (Object.keys(colas).length > 0 && !miLlamada) {
      // Seguridad: Si la llamada fue borrada misteriosamente (o por un admin), liberar dispositivo.
      handleReleaseCall();
    }
  }
  return () => clearTimeout(timer);
}, [activeQueueId, colas, handleReleaseCall]);
```

### 2.2. Algoritmo Analizador de Fila (`CallPanel.jsx`)
Para mostrarle al estudiante cuántas personas hay delante de él en tiempo real, el sistema debe ignorar matemáticamente los turnos cancelados que quedaron atrás o en huecos.

**Fragmento Clave (Reductor de turnos activos):**
```javascript
// CallPanel.jsx
const turnosPorDelante = Object.keys(colas || {}).reduce((count, key) => {
  const id = parseInt(key.replace('ll_', ''), 10);
  
  // Cuenta estrictamente tickets entre lo que atiende el ESP32 actualmente y mi propio Ticket
  if (!isNaN(id) && id >= turno_esp32 && id < queueId) {
    const state = colas[key]?.estado;
    // Solo toma en cuenta llamadas legítimamente en espera o sonando
    if (state === 'pendiente' || state === 'notificando') {
      return count + 1;
    }
  }
  return count;
}, 0);
```

### 2.3. Transacciones Atómicas en Firebase (`useFirebase.js`)
Para crear un nuevo ticket, no usamos un simple "escribir y sumar 1", ya que si dos estudiantes presionan al mismo tiempo habría una colisión (Race Condition). Se usa `runTransaction`.

```javascript
// useFirebase.js
const colaCountRef = ref(db, 'sistema/cola_ultimo_id');
// Transaction asegura que la suma sea atómica en los servidores de Google
const result = await runTransaction(colaCountRef, (currentData) => {
  return (currentData || 0) + 1;
});
if (result.committed) {
    const nuevoId = result.snapshot.val();
    // Se inserta en /colas/ll_[nuevoId]
}
```

---

## 3. ⚙️ Firmware IoT: Lógica en Placa (C++ ESP32)

La placa debe ser resistente a fallos de red, cancelaciones abruptas de usuarios, y debe procesar los audios sin que se empalmen.

### 3.1. Streams vs HTTP Polling
En lugar de preguntar "habrá datos?" cada segundo (lo cual saturaría el procesador), el ESP32 abre un canal TCP directo a Firebase. La función `streamCallback` se dispara asíncronamente en el microsegundo que llega un dato.

```cpp
// main.cpp - Callback Asíncrono
void streamCallback(FirebaseStream data) {
  int idStream = data.dataType() == "double" ? (int)data.doubleData() : data.intData();
  // Al llegar un nuevo ID, actualizamos nuestra variable límite.
  if (idStream > ultimoIdRegistrado) {
     ultimoIdRegistrado = idStream;
  }
}
```

### 3.2. Orquestador de Turnos y Detección de "Fantasmas" (`comprobarCola()`)
Si un alumno genera un ticket, pero antes de que la placa lo procese decide Cancelarlo, el estudiante borra físicamente el nodo en la base de datos (con `remove()`). El ESP32 detecta inteligentemente que el ticket se volvió "null".

**Fragmento Clave:**
```cpp
// main.cpp - Dentro de comprobarCola()
String rutaEstado = "/colas/ll_" + String(idTurnoActual) + "/estado";

if (Firebase.RTDB.getString(&fbdo, rutaEstado.c_str())) {
  if (fbdo.dataType() == "null") {
    // El nodo fue eliminado de la DB antes de que lo atendiéramos
    Serial.printf("[Queue] Turno #%d fue ELIMINADO. Avanzando...\n", idTurnoActual);
    idTurnoActual++; 
    Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", idTurnoActual);
  } else {
    // Si existe, y es "pendiente", leemos la pista de audio e iniciamos el DFPlayer
  }
} else {
  // Manejo de Error: Si lanza "path not exist" es porque no hay nada escrito aún
  if (fbdo.errorReason().indexOf("path not exist") != -1) {
    idTurnoActual++; // Brinca el fantasma
  }
}
```

### 3.3. Watcher de Aborto en Tiempo Real (`loop()`)
¿Qué pasa si el estudiante cancela **mientras** el audio se está reproduciendo en la bocina? La placa debe frenar el audio instantáneamente.

**Fragmento Clave:**
```cpp
// main.cpp - Watcher en el loop()
if (llamadaActiva && Firebase.ready()) {
  static unsigned long ultimoCheckCancelacion = 0;
  // Encuestamos el ticket actual cada 2000 milisegundos
  if (millis() - ultimoCheckCancelacion > 2000) {
    ultimoCheckCancelacion = millis();
    bool cancelado = false;
    
    // Si la lectura da null o "path not exist", significa que el alumno eliminó la llamada.
    if (Firebase.RTDB.getString(&fbdo, rutaEstado.c_str())) {
      if (fbdo.dataType() == "null") cancelado = true;
    } else {
      if (fbdo.errorReason().indexOf("path not exist") != -1) cancelado = true;
    }

    if (cancelado) {
      Serial.printf("Turno #%d cancelado. Abortando audio...\n", idTurnoActual);
      myDFPlayer.stop();      // 1. SILENCIA LA BOCINA AL INSTANTE
      llamadaActiva = false;  // 2. LIBERA EL ESTADO DEL ESP32
      idTurnoActual++;        // 3. AVANZA AL SIGUIENTE ESTUDIANTE
    }
  }
}
```

---

## 4. 🧠 Preguntas Difíciles del Jurado (Q&A Defensa)

Aquí tienes una batería de preguntas trampa o complejas que un jurado técnico podría hacerte, junto con sus respuestas sólidas.

### 🚩 Pregunta 1: ¿Qué pasa si dos alumnos desde dos celulares diferentes presionan el botón "Llamar" exactamente al mismo milisegundo? ¿Se traba o se empalman los audios?
**Respuesta:** "No hay ningún problema, porque el backend utiliza `runTransaction` de Firebase. Una transacción funciona como un embudo matemático a nivel servidor; Firebase pone temporalmente en pausa a un celular por fracciones de segundo mientras le otorga el ID al primero, y luego le da el ID + 1 al segundo. Los audios nunca se empalman porque el firmware del ESP32 está diseñado como un **Orquestador en Serie (Queue)**. El microcontrolador solo procesa la llamada `idTurnoActual` y no atiende la siguiente hasta que la actual termina o es cancelada."

### 🚩 Pregunta 2: ¿Qué sucede si el internet de la universidad falla o el ESP32 se desconecta del Wi-Fi temporalmente mientras hay gente en la fila?
**Respuesta:** "El sistema es tolerante a fallos. Si el ESP32 pierde conexión, su código en la función `loop()` tiene un mecanismo de auto-reconexión `WIFI_RECONNECT_MS` que intenta reconectarse automáticamente. Durante esa caída, los alumnos pueden seguir pidiendo llamadas porque la página web se comunica directo a los servidores de Google. Cuando el ESP32 recupera el internet, simplemente reanuda leyendo su puntero `turno_esp32` desde donde se quedó, y atiende rápidamente las llamadas que se acumularon."

### 🚩 Pregunta 3: ¿Por qué usaron Firebase Realtime Database (Sockets) en lugar de una API REST tradicional (HTTP Requests)?
**Respuesta:** "La arquitectura REST tradicional requiere hacer *Polling*, es decir, forzar al microcontrolador a preguntarle al servidor '¿Hay llamadas nuevas?' cada segundo. Eso sobrecarga el procesador del ESP32, agota el ancho de banda y tiene latencia. Nosotros usamos Firebase RTDB porque usa WebSockets (un canal bidireccional abierto). El servidor 'empuja' la información al ESP32 asíncronamente en el instante exacto en que ocurre. Esto reduce la carga a casi 0% de CPU inactivo y nos da latencias de respuesta de milisegundos."

### 🚩 Pregunta 4: Imagina que un estudiante malicioso usa un programa para hacer mil solicitudes de llamada falsas. ¿Saturaría la base de datos o colapsaría la memoria de su nube?
**Respuesta:** "Tenemos dos defensas contra eso. Primero, el Frontend implementa un candado local que amarra tu dispositivo y no te permite salir de la pantalla de 'Llamada Pendiente' hasta que termine el ciclo. Segundo, incluso si logra evadirlo o decide simplemente 'Llamar y Cancelar' repetidamente, el sistema no acumula basura en la nube. Hemos implementado un proceso de *Limpieza Dinámica* donde usamos el comando físico `remove()` en Firebase en lugar de simplemente cambiar estados. Toda llamada cancelada, o toda llamada contestada, se desintegra de la base de datos de inmediato, por lo que nunca saturamos el almacenamiento de la nube ni cobramos de más."

### 🚩 Pregunta 5: ¿Y si el profesor no se encuentra y nunca llega a presionar el botón de que está ocupado o en camino? ¿La bocina sonaría infinitamente trabando la fila?
**Respuesta:** "Para empezar, contamos con un Watchdog (Perro Guardián) global de 45 segundos (`TIMEOUT_LLAMADA_MS`). Sin embargo, para no hacer esperar al alumno tanto tiempo en vano, implementamos un **Auto-Rechazo Inteligente mediante Telemetría**. Aquí es donde brilla el Sensor PIR de movimiento. Cuando la llamada entra, el ESP32 inicia un temporizador paralelo de 15 segundos ligado al PIR. Si durante esos 15 segundos el sensor no detecta absolutamente ningún calor ni movimiento en la sala, el microcontrolador deduce con 100% de certeza que el maestro está ausente. Automáticamente aborta el audio al instante, libera la base de datos y le avisa al estudiante que no hay nadie, optimizando radicalmente el tiempo de la fila."

### 🚩 Pregunta 6: ¿Para qué sirve realmente el sensor PIR? ¿No es solo un adorno?
**Respuesta:** "En absoluto. Tiene dos funciones vitales en el sistema. Primero, previene llamadas inútiles: le muestra al estudiante en la página web si hay 'Movimiento en la Sala', dándole la oportunidad de ni siquiera intentar llamar si ve que la sala lleva vacía mucho tiempo. Y segundo (como mencioné anteriormente), activa la rutina de *Auto-Rechazo Inteligente* en la placa ESP32, cortando la llamada a los 15 segundos si no detecta presencia humana durante la alerta, haciendo al sistema completamente autónomo ante los olvidos de los maestros."
