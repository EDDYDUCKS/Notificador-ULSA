/*
 * ============================================================
 * NOTIFICADOR DE CATEDRÁTICOS – ULSA
 * Firmware ESP32 DevKit V1 (PlatformIO)
 * ============================================================
 * Hardware:
 * - DFPlayer Mini V3.0 (clon) → Serial2 (RX=D16, TX=D17, 1kΩ en D17)
 * - Botón Verde  → Pin 25  (INPUT_PULLUP, activo en LOW)
 * - Botón Rojo   → Pin 26  (INPUT_PULLUP, activo en LOW)
 * - Sensor PIR   → Pin 27
 *
 * Firebase Realtime Database:
 * /sistema/llamada_activa      (bool)   – escucha
 * /sistema/respuesta_hardware  (string) – escritura
 * /sistema/movimiento_sala     (bool)   – escritura
 * ============================================================
 */

// ── Librerías ────────────────────────────────────────────────
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>   // Helper para el manejo de tokens
#include <addons/RTDBHelper.h>    // Helper para RTDB
#include <DFRobotDFPlayerMini.h>

// ── Credenciales WiFi ────────────────────────────────────────
#define WIFI_SSID     "LionelRichie "
#define WIFI_PASSWORD "lechitacaliente"

// ── Credenciales Firebase ────────────────────────────────────
#define API_KEY       "AIzaSyBpDnPrzXqRDmW1ZbCWMdZ9ifeQUrrDGyk"
#define DATABASE_URL  "https://notificador-maestros-default-rtdb.firebaseio.com"
#define USER_EMAIL    "placa@ulsa.com"      // Usuario creado en Firebase Auth
#define USER_PASSWORD "password123"         // Contraseña de Firebase Auth

// ── Pines de Hardware ────────────────────────────────────────
#define PIN_BOTON_VERDE  25   // INPUT_PULLUP – "Voy en camino"
#define PIN_BOTON_ROJO   26   // INPUT_PULLUP – "Ocupado"
#define PIN_PIR          27   // Sensor de movimiento

// ── Constantes de Tiempo (ms) ────────────────────────────────
#define DEBOUNCE_MS          250   // Anti-rebote para botones (con detección de flanco)
#define FIREBASE_CHECK_MS    500   // Intervalo de lectura de llamada_activa
#define PIR_CHECK_MS         400   // Intervalo de lectura del PIR
#define WIFI_RECONNECT_MS   10000  // Reintento de conexión WiFi

// ── Objetos Globales ─────────────────────────────────────────
FirebaseData   fbdo;              // Objeto principal de Firebase
FirebaseData   fbdoStream;        // Objeto dedicado al stream/listener
FirebaseAuth   auth;
FirebaseConfig config;

HardwareSerial dfSerial(2);       // Serial2 → RX2(D16) / TX2(D17)
DFRobotDFPlayerMini myDFPlayer;

// ── Variables de Estado ──────────────────────────────────────
bool     firebaseReady       = false;
bool     streamConectado     = false;

// Estado de la Cola
int      idTurnoActual       = 1;
int      ultimoIdRegistrado  = 0;
bool     llamadaActiva       = false;
unsigned long tiempoInicioLlamada = 0;
#define  TIMEOUT_LLAMADA_MS 45000

// Debounce de botones
unsigned long ultimoBotonVerde = 0;
unsigned long ultimoBotonRojo  = 0;

// Estado anterior de botones
bool estadoAnteriorVerde = HIGH;
bool estadoAnteriorRojo  = HIGH;

// Sensor PIR
bool pirEstadoAnterior = false;
unsigned long ultimoCheckPIR = 0;
unsigned long ultimoReconnectWiFi = 0;

// Ignorar valores de arranque del stream
bool primerEventoStream = true;

// ── Prototipos ───────────────────────────────────────────────
void conectarWiFi();
void configurarFirebase();
void inicializarDFPlayer();
void streamCallback(FirebaseStream data);
void streamTimeoutCallback(bool timeout);
void procesarBotones();
void procesarPIR();
void comprobarCola();
void terminarLlamadaActual(const char* estadoFinal);
void enviarFirebaseString(const char* path, const char* valor);
void enviarFirebaseBool(const char* path, bool valor);

// =============================================================
//  SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Notificador ULSA – Iniciando V2 (Con Cola) ===");

  // Configurar pines
  pinMode(PIN_BOTON_VERDE, INPUT_PULLUP);
  pinMode(PIN_BOTON_ROJO,  INPUT_PULLUP);
  pinMode(PIN_PIR,         INPUT);

  conectarWiFi();

  Serial.println("[DFPlayer] Esperando montaje de MicroSD (1s)...");
  delay(1000);
  inicializarDFPlayer();

  configurarFirebase();

  // ── Sincronizar Puntero de Cola ──
  // Recuperar en qué turno se quedó el ESP32 si hubo un reinicio de energía
  Serial.print("[Firebase] Esperando conexión auth...");
  int timeoutAuth = 0;
  while (!Firebase.ready() && timeoutAuth < 20) { 
     delay(1000); 
     Serial.print("."); 
     timeoutAuth++;
  }
  Serial.println();

  if (Firebase.ready()) {
    if (Firebase.RTDB.getInt(&fbdo, "/sistema/turno_esp32")) {
      idTurnoActual = fbdo.intData();
      Serial.printf("[Queue] Retomando desde el turno: %d\n", idTurnoActual);
    } else {
      idTurnoActual = 1;                                                                                  
      Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", 1);
    }
    
    // Conocer cuántos se han formateado antes de encender el stream
    if (Firebase.RTDB.getInt(&fbdo, "/sistema/cola_ultimo_id")) {
      ultimoIdRegistrado = fbdo.intData();
    }
  }

  Serial.println("=== Setup completo ===\n");
}

// =============================================================
//  LOOP
// =============================================================
void loop() {
  // 1. WiFi Reconnect
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long ahora = millis();
    if (ahora - ultimoReconnectWiFi >= WIFI_RECONNECT_MS) {
      ultimoReconnectWiFi = ahora;
      Serial.println("[WiFi] Desconectando... reconectando");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    delay(50);
    return;
  }

  // 2. Firebase Stream en último ID
  if (Firebase.ready()) {
    if (!streamConectado) {
      Serial.println("[Firebase] Iniciando stream en /sistema/cola_ultimo_id...");
      if (Firebase.RTDB.beginStream(&fbdoStream, "/sistema/cola_ultimo_id")) {
        Firebase.RTDB.setStreamCallback(&fbdoStream, streamCallback, streamTimeoutCallback);
        streamConectado = true;
        Serial.println("[Firebase] Stream conectado a la cola.");
      }
    }
  }

  // 3. Revisar si hay llamados pendientes y no estamos ocupados reproduciendo
  comprobarCola();

  // 4. Timer de expiración de llamada (Time out)
  if (llamadaActiva && (millis() - tiempoInicioLlamada > TIMEOUT_LLAMADA_MS)) {
    Serial.println("[Queue] ¡TIEMPO DE ESPERA AGOTADO! El maestro no respondió.");
    terminarLlamadaActual("timeout");
  }

  // 4.5. Detectar si el estudiante canceló la llamada a la mitad
  if (llamadaActiva && Firebase.ready()) {
    static unsigned long ultimoCheckCancelacion = 0;
    if (millis() - ultimoCheckCancelacion > 2000) {
      ultimoCheckCancelacion = millis();
      String rutaEstado = "/colas/ll_" + String(idTurnoActual) + "/estado";
      
      bool cancelado = false;
      if (Firebase.RTDB.getString(&fbdo, rutaEstado.c_str())) {
        if (fbdo.dataType() == "null") {
          cancelado = true;
        }
      } else {
        if (fbdo.errorReason().indexOf("path not exist") != -1) {
          cancelado = true;
        }
      }

      if (cancelado) {
        Serial.printf("[Queue] Turno #%d cancelado por el estudiante. Abortando audio...\n", idTurnoActual);
        myDFPlayer.stop();
        llamadaActiva = false;
        idTurnoActual++;
        Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", idTurnoActual);
      }
    }
  }

  // 5. Sensores y Botones
  procesarBotones();
  procesarPIR();

  delay(10);
}

// =============================================================
//  CONECTORES RED / HARDWARE
// =============================================================

void conectarWiFi() {
  Serial.print("[WiFi] Conectando a ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(1000);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 40) {
    delay(500);
    Serial.print(".");
    intentos++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ¡Conectado!");
  } else {
    Serial.println("\n[WiFi] Falló.");
  }
}

void configurarFirebase() {
  Serial.println("[Firebase] Configurando...");
  delay(3000); 

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  config.token_status_callback = tokenStatusCallback;
  config.timeout.socketConnection = 10 * 1000;
  config.timeout.sslHandshake   = 10 * 1000; 

  fbdo.setBSSLBufferSize(4096, 1024);
  fbdoStream.setBSSLBufferSize(4096, 1024);
  Firebase.reconnectNetwork(true);
  Firebase.begin(&config, &auth);
}


// =============================================================
//  DFPlayer Mini
// =============================================================

/**
 * Inicializa el DFPlayer Mini por Serial2.
 * Incluye reintentos para clones lentos.
 */
void inicializarDFPlayer() {
  dfSerial.begin(9600, SERIAL_8N1, 16, 17);  // RX2=D16, TX2=D17

  Serial.println("[DFPlayer] Inicializando...");

  int intentos = 0;
  while (!myDFPlayer.begin(dfSerial) && intentos < 5) {
    Serial.println("[DFPlayer] Reintentando conexión...");
    delay(500);
    intentos++;
  }

  if (intentos >= 5) {
    Serial.println("[DFPlayer] ¡ERROR! No se pudo conectar al módulo.");
    Serial.println("[DFPlayer] Verifica: cableado, resistencia 1kΩ, MicroSD con mp3/0001.mp3");
    return;
  }

  Serial.println("[DFPlayer] ¡Conectado exitosamente!");
  myDFPlayer.volume(25);  // Volumen fijo al 25 (rango: 0-30)
  Serial.println("[DFPlayer] Volumen fijado a 25.");
}


// =============================================================
//  CONTROL DE COLA DE LLAMADAS (QUEUE ORCHESTRATOR)
// =============================================================

void comprobarCola() {
  if (llamadaActiva || !Firebase.ready()) return;
  // Solo revisar si el turno actual que quiero leer es menor o igual al último creado
  if (idTurnoActual <= ultimoIdRegistrado) {

    String rutaLlamada = "/colas/ll_" + String(idTurnoActual);
    String rutaEstado = rutaLlamada + "/estado";

    if (Firebase.RTDB.getString(&fbdo, rutaEstado.c_str())) {
      if (fbdo.dataType() == "null") {
        Serial.printf("[Queue] Turno #%d fue ELIMINADO de la base de datos. Avanzando...\n", idTurnoActual);
        idTurnoActual++; 
        Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", idTurnoActual);
      } else {
        String estado = fbdo.stringData();
        
        if (estado == "pendiente") {
          Serial.println("\n==================================");
          Serial.printf("[Queue] Procesando Turno #%d\n", idTurnoActual);
          
          llamadaActiva = true;
          tiempoInicioLlamada = millis();
          enviarFirebaseString(rutaEstado.c_str(), "notificando");
          
          // Extraer audio
          int pista = 1;
          String rutaPista = rutaLlamada + "/pista_audio";
          if (Firebase.RTDB.getInt(&fbdo, rutaPista.c_str())) {
             pista = fbdo.intData();
          }
          
          Serial.printf("[DFPlayer] Reproduciendo pista %d...\n", pista);
          myDFPlayer.play(pista);

        } else {
          // En caso de que el ID fuera alterado o saltado manualmente
          Serial.printf("[Queue] Turno #%d no está pendiente (es %s). Avanzando...\n", idTurnoActual, estado.c_str());
          idTurnoActual++; 
          Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", idTurnoActual);
        }
      }
    } else {
      String razonError = fbdo.errorReason();
      if (razonError.indexOf("path not exist") != -1) {
        Serial.printf("[Queue] Turno #%d NO EXISTE. Avanzando...\n", idTurnoActual);
        idTurnoActual++;
        Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", idTurnoActual);
      }
      // Si el error es otro (retraso en propagación, timeout), lo reintenta después
    }
  }
}

void terminarLlamadaActual(const char* estadoFinal) {
  if (!llamadaActiva) return;

  Serial.printf("[Queue] Finalizando turno #%d -> %s\n", idTurnoActual, estadoFinal);
  
  // Guardar estado
  String rutaEstado = "/colas/ll_" + String(idTurnoActual) + "/estado";
  enviarFirebaseString(rutaEstado.c_str(), estadoFinal);

  myDFPlayer.stop();

  // Avanzar turno
  llamadaActiva = false;
  idTurnoActual++;
  Firebase.RTDB.setInt(&fbdo, "/sistema/turno_esp32", idTurnoActual);
}

// =============================================================
//  STREAM (DETECTAR NUEVOS AÑADIDOS A LA COLA)
// =============================================================
void streamCallback(FirebaseStream data) {
  if (primerEventoStream) {
    primerEventoStream = false;
    return;
  }
  
  if (data.dataType() == "int" || data.dataType() == "float" || data.dataType() == "double") {
    int idStream = data.dataType() == "double" ? (int)data.doubleData() : data.intData();
    if (idStream > ultimoIdRegistrado) {
       ultimoIdRegistrado = idStream;
       Serial.printf("[Stream] ¡Nueva llamada registrada! Hay %d items en cola histórica.\n", ultimoIdRegistrado);
    }
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) Serial.println("[Stream] Timeout, reconectando...");
  if (!fbdoStream.httpConnected()) streamConectado = false;
}

// =============================================================
//  BOTONES FÍSICOS
// =============================================================

void procesarBotones() {
  unsigned long ahora = millis();

  // Verde (voy en camino)
  bool lecturaVerde = digitalRead(PIN_BOTON_VERDE);
  if (estadoAnteriorVerde == HIGH && lecturaVerde == LOW) {
    if (ahora - ultimoBotonVerde >= 250) {
      ultimoBotonVerde = ahora;
      Serial.println("[Botón] Verde presionado → voy_en_camino");
      terminarLlamadaActual("voy_en_camino");
    }
  }
  estadoAnteriorVerde = lecturaVerde;

  // Rojo (ocupado)
  bool lecturaRojo = digitalRead(PIN_BOTON_ROJO);
  if (estadoAnteriorRojo == HIGH && lecturaRojo == LOW) {
    if (ahora - ultimoBotonRojo >= 250) {
      ultimoBotonRojo = ahora;
      Serial.println("[Botón] Rojo presionado → ocupado");
      terminarLlamadaActual("ocupado");
    }
  }
  estadoAnteriorRojo = lecturaRojo;
}


// =============================================================
//  SENSOR PIR (DETECCIÓN DE CAMBIO)
// =============================================================

/**
 * Monitorea el sensor PIR y solo envía a Firebase cuando
 * el estado cambia (HIGH→LOW o LOW→HIGH).
 */
void procesarPIR() {
  unsigned long ahora = millis();

  // Leer a intervalos para no saturar
  if (ahora - ultimoCheckPIR < PIR_CHECK_MS) return;
  ultimoCheckPIR = ahora;

  bool pirActual = digitalRead(PIN_PIR) == HIGH;

  // Solo enviar si el estado cambió
  if (pirActual != pirEstadoAnterior) {
    pirEstadoAnterior = pirActual;

    if (pirActual) {
      Serial.println("[PIR] Movimiento DETECTADO → movimiento_sala = true");
      enviarFirebaseBool("/sistema/movimiento_sala", true);
    } else {
      Serial.println("[PIR] Sin movimiento → movimiento_sala = false");
      enviarFirebaseBool("/sistema/movimiento_sala", false);
    }
  }
}


// =============================================================
//  FUNCIONES AUXILIARES DE FIREBASE
// =============================================================

/**
 * Envía un valor String a una ruta de Firebase RTDB.
 */
void enviarFirebaseString(const char* path, const char* valor) {
  if (Firebase.ready()) {
    if (Firebase.RTDB.setString(&fbdo, path, valor)) {
      Serial.printf("[Firebase] %s → \"%s\" ✓\n", path, valor);
    } else {
      Serial.printf("[Firebase] Error en %s: %s\n", path, fbdo.errorReason().c_str());
    }
  } else {
    Serial.println("[Firebase] No está listo. Operación pospuesta.");
  }
}

/**
 * Envía un valor bool a una ruta de Firebase RTDB.
 */
void enviarFirebaseBool(const char* path, bool valor) {
  if (Firebase.ready()) {
    if (Firebase.RTDB.setBool(&fbdo, path, valor)) {
      Serial.printf("[Firebase] %s → %s ✓\n", path, valor ? "true" : "false");
    } else {
      Serial.printf("[Firebase] Error en %s: %s\n", path, fbdo.errorReason().c_str());
    }
  } else {
    Serial.println("[Firebase] No está listo. Operación pospuesta.");
  }
}