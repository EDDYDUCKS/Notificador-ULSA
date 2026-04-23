# 🎓 Notificador de Catedráticos ULSA - Documentación del Proyecto

Este documento consolida la arquitectura, el funcionamiento y el desarrollo técnico del **Notificador de Catedráticos IoT**, diseñado para resolver la comunicación asíncrona entre estudiantes y profesores en los cubículos de la universidad.

---

## 1. 🎯 Objetivo del Proyecto
Optimizar el tiempo de los estudiantes y catedráticos al eliminar la incertidumbre de buscar a un profesor en su cubículo. El sistema permite al estudiante solicitar atención desde una aplicación web y al maestro ser notificado mediante una alerta por voz, dándole la oportunidad de responder físicamente si está disponible, ocupado o en camino.

---

## 2. 🔌 Componentes de Hardware (Físico)
El cerebro físico del sistema está construido en torno a microcontroladores y sensores económicos pero potentes:

*   **ESP32 DevKit V1:** El microcontrolador central. Cuenta con un módulo Wi-Fi integrado que le permite mantenerse conectado a internet permanentemente para escuchar los eventos de la base de datos.
*   **Módulo DFPlayer Mini V3.0:** Un reproductor MP3 de hardware que lee archivos de audio desde una tarjeta MicroSD. Recibe comandos por puerto Serial (UART) desde el ESP32 para reproducir el nombre específico del maestro solicitado.
*   **Sensor PIR (Movimiento):** Detecta calor corporal en el área del cubículo. Permite que el sistema sepa en tiempo real si hay "movimiento en la sala", reflejándolo en la página web.
*   **Botones Físicos de Respuesta:**
    *   🟢 **Botón Verde:** Envía la señal *"Voy en camino / Espérame"*.
    *   🔴 **Botón Rojo:** Envía la señal *"Estoy ocupado"*.
*   **Altavoz / Bocina:** Conectada al DFPlayer para amplificar los audios de los nombres de los profesores.

---

## 3. 🌐 Arquitectura Backend (Firebase)
El sistema utiliza **Google Firebase** como infraestructura "Serverless" en la nube, garantizando tiempos de respuesta de milisegundos.

*   **Firebase Realtime Database:** Una base de datos NoSQL alojada en la nube que sincroniza datos en tiempo real. 
    *   **Gestión de Colas (`/colas`):** En lugar de sobreescribir variables simples, el sistema utiliza un algoritmo de encolado (`ll_1`, `ll_2`, etc.). Esto garantiza que si 5 alumnos llaman a distintos maestros al mismo tiempo, las alertas de voz no se empalmen, sino que suenen una por una ordenadamente.
    *   **Directorio (`/maestros`):** Almacena la información de los catedráticos, incluyendo si están "disponibles" o "no disponibles" y su motivo (ej. "En laboratorio").
*   **Reglas de Seguridad:** La base de datos cuenta con reglas estrictas de seguridad (Firebase Rules) que impiden accesos no autorizados a ciertas ramas sensitivas.

---

## 4. 💻 Frontend (Aplicación Web)
La cara visible del proyecto para los alumnos y maestros.

*   **Tecnologías:** Construida con **React**, **Vite** y estilizada con **Tailwind CSS** para una interfaz moderna, ultra rápida y completamente responsiva (adaptable a celulares y computadoras).
*   **Interfaz de Estudiantes:** 
    *   Muestra tarjetas dinámicas de cada profesor con gradientes de color según su estado en vivo.
    *   Sistema de Prevención de Spam: Al realizar una llamada, el navegador guarda un candado local (`localStorage`) que bloquea el dispositivo del alumno en una ventana de "espera", impidiéndole hacer llamadas infinitas y saturar el sistema.
*   **Panel Secreto para Maestros:**
    *   Un panel protegido por PIN al que solo los profesores pueden acceder.
    *   Permite al maestro ver una lista en vivo de **quién lo está llamando** (Nombre y Carrera del alumno) y cambiar su estado general a *"Fuera de oficina"*, *"En junta"*, etc.

---

## 5. ⚙️ Firmware de la Placa (Código ESP32 en C++)
El programa interno de la placa fue escrito en **C++** utilizando PlatformIO. Su diseño es altamente robusto y multitarea:

*   **Manejo de Streams (Event-driven):** El ESP32 no pregunta repetitivamente a la base de datos "habrá llamadas?". En su lugar, mantiene una conexión abierta (Stream). Firebase empuja la información a la placa instantáneamente en cuanto un alumno presiona "Llamar".
*   **Orquestador de Cola (`Queue Orchestrator`):** La placa mantiene un puntero interno (`turno_esp32`). Si llegan múltiples llamadas, la placa las reproduce en orden perfecto.
*   **Cancelación en Tiempo Real (Polling Watcher):** Si el alumno se desespera y presiona "Cancelar solicitud" en la página web, el ESP32 (que revisa el estado cada 2 segundos) detecta la desaparición del ticket en Firebase y **aborta el audio al instante**, pasando a la siguiente persona.
*   **Manejo de Timeouts:** Si un maestro no responde físicamente a los botones después de 45 segundos, el ESP32 marca la llamada como "Expirada/Timeout" para no dejar al alumno congelado esperando.

---

## 🔄 Flujo Completo del Sistema (Diagrama Lógico)

1. **Solicitud:** El alumno "Eddy (ICE)" presiona *Llamar* al Profe X en la Web.
2. **Nube:** La Web inscribe un ticket (ej. `ll_24`) en Firebase con el estado *"pendiente"*.
3. **Notificación:** El ESP32 recibe el aviso al instante. Lee que es el audio pista #4.
4. **Hardware en Acción:** El ESP32 le ordena al DFPlayer reproducir la pista 4. En paralelo, Firebase cambia a *"notificando"*.
5. **Decisión del Maestro:** El maestro escucha la alerta y presiona el Botón Verde.
6. **Respuesta:** El ESP32 envía a Firebase el estado *"voy_en_camino"*.
7. **Resolución:** La Web detecta el cambio, le muestra una pantalla verde de éxito a Eddy, y tras 6 segundos, limpia la base de datos automáticamente liberando su dispositivo.

---

> **Nota para el Jurado:**
> *Este sistema no solo resuelve un problema logístico físico mediante hardware, sino que implementa conceptos avanzados de software moderno: algoritmos de colas, gestión de concurrencia, bases de datos reactivas en tiempo real y componentes de UI controlados por estado.*
