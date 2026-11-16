/*
  =====================================================================
  robot_integrado.ino · Firmware maestro del robot de búsqueda y transporte
  Trabajo de Grado · Ingeniería en Telecomunicaciones · UCAB
  =====================================================================

  Este archivo FUSIONA los tres prototipos del proyecto:
    P01 (robot_mqtt)        -> Wi-Fi, MQTT, pedidos + ack, alertas QoS 2, batería
    P03 (traccion_encoders) -> PWM del L298N, encoders por interrupción, PID opcional
    P08 (seguidor_linea)    -> control PD del seguidor de línea a 100 Hz

  REGLAS DE ESTE FIRMWARE
    1. NO se usa delay() en ninguna parte. Todos los tiempos van con millis().
    2. Dos modos: MODO_AUTONOMO (sigue la línea con el PD) y MODO_MANUAL
       (obedece órdenes por MQTT o por el Monitor Serie).
    3. loop() nunca se bloquea: siempre llama a mqtt.loop() y revisa temporizadores.
    4. El control (PD o manual) corre cada 10 ms = 100 Hz.
    5. Los encoders se leen por interrupción (cuadratura, 4 flancos).
    6. Las alertas salen con QoS 2.

  CÓMO SE USA
    - Arranca en MODO_AUTONOMO después de 1,5 s de espera (para ubicar el robot).
    - En MANUAL, si no llega ninguna orden (MQTT o teclas) en 5 s,
      vuelve solo a MODO_AUTONOMO (medida de seguridad).
    - Teclas del Monitor Serie (115200):
        w adelante   s atrás   a izquierda   d derecha
        espacio o x  frenar    + / -  suben/bajan la velocidad 5 %
        t  alarma de prueba (QoS 2)      o  volver a autónomo
      La letra t es la alarma para no chocar con la "a" de "izquierda".
    - Botón BOOT (GPIO 0): alarma de prueba.
    - Órdenes MQTT: mismo JSON de P01; si trae "cmd" cambia a MANUAL:
        {"id":"P-0001","cmd":"adelante"}
        {"id":"P-0002","cmd":"izquierda","vel":0.6}
        {"id":"P-0003","cmd":"frenar"}
        {"id":"P-0004","cmd":"auto"}
      Una orden SIN "cmd" es un pedido de componente: solo se confirma (ack).

  TÓPICOS (los mismos de P01, no cambian)
    ucab-tg-sf/robot/estado       robot -> app   QoS 0   cada 2 s
    ucab-tg-sf/robot/ordenes      app -> robot   QoS 1
    ucab-tg-sf/robot/ordenes/ack  robot -> app   QoS 1
    ucab-tg-sf/robot/alertas      robot -> app   QoS 2
    ucab-tg-sf/robot/conexion     robot/broker  QoS 1   retenido (LWT)

  LIBRERÍAS
    - WiFi: viene incluida en el core del ESP32.
    - MQTT de Joel Gaehwiler (256dpi): Gestor de librerías -> "MQTT".
      NO se usa PubSubClient porque solo publica con QoS 0.
    - Core ESP32 3.x (ledcAttach). Para el core 2.x están las notas "CORE 2.x".

  PLACA: "ESP32 Dev Module" (DevKit de 30 pines, USB-C, CP2102).

  MAPA DE PINES (coincide con datos/proyecto.js)
    Motores:  ENA 25, IN1 26, IN2 27 | ENB 14, IN3 4, IN4 13
    Encoders: izq A 18, B 19 | der A 16, B 17
    Línea:    36, 39, 34, 35  (ADC1: no choca con el Wi-Fi)
    Batería:  32 (ADC1)       Botón: 0 (BOOT)
    IMU reservada: SDA 21, SCL 22, INT 2 (ver gancho al final)
  =====================================================================
*/

#include <Arduino.h>
#include <WiFi.h>
#include <MQTT.h>
#include "secrets.h"   // WIFI_SSID / WIFI_PASS / MQTT_BROKER: local, fuera del repo

// =====================================================================
// 1. PINES (un único bloque; antes estaban repetidos en los tres códigos)
// =====================================================================
// Puente H L298N, motor izquierdo
const uint8_t PIN_ENA = 25;   // PWM. Quitar el puente ENA del L298N
const uint8_t PIN_IN1 = 26;
const uint8_t PIN_IN2 = 27;
// Puente H L298N, motor derecho
const uint8_t PIN_ENB = 14;   // PWM. Quitar el puente ENB del L298N
const uint8_t PIN_IN3 = 4;
const uint8_t PIN_IN4 = 13;

// Encoders en cuadratura (alimentar los encoders con 3,3 V del ESP32)
const uint8_t PIN_ENC_IZQ_A = 18;
const uint8_t PIN_ENC_IZQ_B = 19;
const uint8_t PIN_ENC_DER_A = 16;
const uint8_t PIN_ENC_DER_B = 17;

// Sensores de línea: ADC1 (el ADC2 no funciona con el Wi-Fi encendido).
// Orden: de IZQUIERDA a DERECHA.
const uint8_t PIN_SENSOR[4] = {36, 39, 34, 35};

const uint8_t PIN_BATERIA = 32;  // divisor 100 kΩ + 22 kΩ (12,6 V -> 2,27 V)
const uint8_t PIN_PRUEBA  = 0;   // botón BOOT de la placa (activo en bajo)

// =====================================================================
// 2. RED Y MQTT
// =====================================================================
// La red y el broker vienen de secrets.h (archivo local, en .gitignore).
const char* WIFI_RED   = WIFI_SSID;
const char* WIFI_CLAVE = WIFI_PASS;
const char* BROKER     = MQTT_BROKER;
const int   BROKER_PUERTO = MQTT_PUERTO;

const char* T_ESTADO   = "ucab-tg-sf/robot/estado";
const char* T_ORDENES  = "ucab-tg-sf/robot/ordenes";
const char* T_ACK      = "ucab-tg-sf/robot/ordenes/ack";
const char* T_ALERTAS  = "ucab-tg-sf/robot/alertas";
const char* T_CONEXION = "ucab-tg-sf/robot/conexion";

// Tiempos de red (reintentos sin delay)
const uint32_t REINTENTO_WIFI_MS     = 5000;
const uint32_t REINTENTO_MQTT_MS     = 3000;   // primer reintento de MQTT
const uint32_t REINTENTO_MQTT_MAX_MS = 30000;  // techo del backoff
const uint32_t PERIODO_ESTADO_MS     = 2000;   // estado cada 2 s
const uint32_t TIMEOUT_MQTT_MS       = 1000;   // acota lo que bloquea mqtt.connect()

// Backoff de reconexión: 3 s, 6 s, 12 s, 24 s, 30 s, 30 s...
uint32_t esperaMqttActual = REINTENTO_MQTT_MS;

WiFiClient red;
MQTTClient mqtt(512);

// Fases de la conexión (máquina de estados de red, sin bloqueos)
enum FaseRed {
  RED_ESPERANDO_WIFI,   // esperando que el Wi-Fi conecte
  RED_CONECTANDO_MQTT,  // Wi-Fi listo, intentando el broker
  RED_LISTO             // Wi-Fi y MQTT conectados
};
FaseRed faseRed = RED_ESPERANDO_WIFI;
uint32_t ultimoIntentoRed = 0;

// PID de velocidad (uno por rueda). El struct va aquí arriba porque el
// preprocesador de Arduino inserta los prototipos de las funciones antes
// de la primera definición, y pidPaso() usa este tipo.
struct Pid { float integral = 0.0f; float errPrev = 0.0f; };
Pid pidIzq, pidDer;

// =====================================================================
// 3. CONTROL DEL SEGUIDOR DE LÍNEA (PD de P08)
// =====================================================================
// Ganancias del PD. Son las de la simulación: calibrar con el robot real
// (primero KP hasta que no zigzaguee, después KD).
const float PD_BASE = 0.80f;    // velocidad base (0 a 1)
const float PD_KP   = 0.030f;   // PWM por cada mm de error
const float PD_KD   = 0.0015f;  // PWM por cada mm/s de cambio del error
const float SEP_MM  = 18.0f;    // separación entre sensores vecinos (mm)

// Lecturas de los TCRT5000 (supuestas por la simulación: calibrar)
const int   ADC_PISO  = 500;    // sobre piso claro (de 4095)
const int   ADC_CINTA = 3300;   // sobre la cinta negra
const float UMBRAL    = 0.20f;  // por debajo del 20 % se cuenta como piso
const float SUMA_MIN  = 0.30f;  // suma mínima para decir "veo la línea"

const uint32_t PERIODO_CONTROL_MS = 10;   // 10 ms = 100 Hz

// Estado que el lazo recuerda entre vueltas
struct EstadoLinea {
  float ultimaPos = 0.0f;     // última posición (mm) donde vio la línea
  float errorAnterior = 0.0f; // para el término derivativo
  bool  hayError = false;
};
EstadoLinea estadoLinea;

// Resultado de una vuelta del PD
struct SalidaLinea {
  float n[4];     // lecturas normalizadas (0 a 1)
  float suma;     // cuánta línea ve en total
  float pos_mm;   // posición de la línea (+ = a la izquierda)
  float P, D;     // términos del PD
  float corr;     // corrección total (P + D)
  bool  perdida;  // true si ningún sensor ve la línea
  float izq, der; // PWM de cada motor, de -1 a 1
};
SalidaLinea ultimaSalida = {};   // se guarda para la telemetría

// Utilidades
float limitar(float x, float a, float b) { return x < a ? a : (x > b ? b : x); }

// Posición de cada sensor en mm respecto al centro (+ = izquierda):
// +1,5, +0,5, -0,5, -1,5 separaciones
float xSensor(int i) { return (1.5f - i) * SEP_MM; }

/*
  El corazón del modo autónomo: de las 4 lecturas a los PWM de cada motor.
  Es la misma cuenta que control() del simulador (P08):

    1. Normaliza cada lectura entre ADC_PISO y ADC_CINTA.
    2. Calcula la posición de la línea como promedio ponderado por la
       posición de cada sensor. Esa posición ES el error (mm).
    3. Si no ve la línea, sigue girando hacia el último lado donde la vio.
    4. PD: corrección = KP * error + KD * (error - errorAnterior) / dt.
    5. Reparte: rueda izquierda = BASE - corrección, derecha = BASE + corr.

  Nota del signo: si la línea está a la izquierda (error positivo), la
  corrección positiva frena la rueda izquierda y acelera la derecha, o sea
  el robot gira hacia la izquierda. Así venía en P08 y se conserva.
*/
SalidaLinea calcularControl(EstadoLinea &e, const int raw[4], float dt) {
  SalidaLinea s;
  s.suma = 0.0f;
  for (int i = 0; i < 4; i++) {
    float v = (raw[i] - ADC_PISO) / float(ADC_CINTA - ADC_PISO);
    s.n[i] = (v < UMBRAL) ? 0.0f : (v > 1.0f ? 1.0f : v);
    s.suma += s.n[i];
  }

  float pos;
  s.perdida = false;
  if (s.suma > SUMA_MIN) {
    float acum = 0.0f;
    for (int i = 0; i < 4; i++) acum += s.n[i] * xSensor(i);
    pos = acum / s.suma;
    e.ultimaPos = pos;
  } else {
    // No ve la línea: sigue girando hacia el último lado donde la vio
    s.perdida = true;
    float lado = (e.ultimaPos < 0.0f) ? -1.0f : 1.0f;
    pos = lado * xSensor(0) * 1.2f;
  }
  s.pos_mm = pos;   // ya está en mm: es el error

  // Término derivativo con el dt real (protegido contra saltos raros)
  if (dt < 0.005f) dt = 0.005f;
  if (dt > 0.050f) dt = 0.050f;
  float de = e.hayError ? (pos - e.errorAnterior) / dt : 0.0f;
  e.errorAnterior = pos;
  e.hayError = true;

  s.P = PD_KP * pos;
  s.D = PD_KD * de;
  s.corr = s.P + s.D;
  s.izq = limitar(PD_BASE - s.corr, -1.0f, 1.0f);
  s.der = limitar(PD_BASE + s.corr, -1.0f, 1.0f);
  return s;
}

// =====================================================================
// 4. MOTORES (un único moverMotor, pwm de -1 a 1)
// =====================================================================
const uint32_t PWM_HZ   = 20000;  // 20 kHz: fuera de lo audible y el L298N lo soporta
const uint8_t  PWM_BITS = 10;     // 0 a 1023
const int      PWM_MAX  = (1 << PWM_BITS) - 1;

// Positivo = adelante, negativo = atrás, 0 = frena (IN1 = IN2 = LOW)
void moverMotor(uint8_t pinEn, uint8_t pinA, uint8_t pinB, float pwm) {
  if (pwm > 0.001f)      { digitalWrite(pinA, HIGH); digitalWrite(pinB, LOW); }
  else if (pwm < -0.001f) { digitalWrite(pinA, LOW);  digitalWrite(pinB, HIGH); }
  else                   { digitalWrite(pinA, LOW);  digitalWrite(pinB, LOW); pwm = 0.0f; }

  pwm = limitar(pwm, -1.0f, 1.0f);
  ledcWrite(pinEn, (int)(fabsf(pwm) * PWM_MAX + 0.5f));
  // CORE 2.x: ledcWrite(canal, valor), con canal 0 (izq) y 1 (der)
}

void detener() {
  moverMotor(PIN_ENA, PIN_IN1, PIN_IN2, 0.0f);
  moverMotor(PIN_ENB, PIN_IN3, PIN_IN4, 0.0f);
}

// =====================================================================
// 5. ENCODERS POR INTERRUPCIÓN (ISR de P03, sin cambios)
// =====================================================================
volatile long cuentaIzq = 0;
volatile long cuentaDer = 0;
volatile uint8_t estIzq = 0, estDer = 0;
const int8_t TABLA[16] = {0, +1, -1, 0, -1, 0, 0, +1, +1, 0, 0, -1, 0, -1, +1, 0};

void IRAM_ATTR isrIzq() {
  estIzq = ((estIzq << 2) | (digitalRead(PIN_ENC_IZQ_A) << 1) | digitalRead(PIN_ENC_IZQ_B)) & 0x0F;
  cuentaIzq += TABLA[estIzq];
}
void IRAM_ATTR isrDer() {
  estDer = ((estDer << 2) | (digitalRead(PIN_ENC_DER_A) << 1) | digitalRead(PIN_ENC_DER_B)) & 0x0F;
  cuentaDer += TABLA[estDer];
}

// =====================================================================
// 6. DATOS DEL MOTOR Y PID DE VELOCIDAD (de P03, PID APAGADO por defecto)
// =====================================================================
const float VBAT         = 11.1f;   // batería 3S nominal (V)
const float CAIDA_DRIVER = 2.1f;    // caída del L298N (V). TB6612FNG: 0.5
const float RUEDA_D      = 0.065f;  // diámetro de la rueda (m)
const float VIA          = 0.18f;   // distancia entre ruedas (m)
const float RPM_12V      = 280.0f;  // Speed 200: rpm sin carga a 12 V
const float RATIO        = 21.3f;   // caja reductora
const float PPR          = 11.0f;   // pulsos por vuelta del motor, por canal
const float CARGA        = 0.8f;    // SUPUESTO del simulador: se mide en P03

// Cuentas por vuelta de la RUEDA con 4 flancos: 11 x 21,3 x 4 = 937,2
const float CUENTAS_VUELTA = PPR * RATIO * 4.0f;

// PID de velocidad (uno por rueda). GANANCIAS EN 0 = DESACTIVADO.
// Se activa poniendo usarPIDVelocidad = true y midiendo KP, KI y KD.
const float PID_KP = 0.0f;
const float PID_KI = 0.0f;
const float PID_KD = 0.0f;
bool usarPIDVelocidad = false;

// El struct Pid y sus dos instancias (pidIzq, pidDer) están definidos arriba,
// al final de la sección 2, para que el preprocesador de Arduino los vea.

// Velocidad que predice el modelo del simulador para un PWM dado
float velModelo(float pwm) {
  float v = (VBAT - CAIDA_DRIVER) * pwm;            // voltaje que llega al motor
  float rpm = RPM_12V * (v / 12.0f) * CARGA;        // rpm de la rueda
  return PI * RUEDA_D * rpm / 60.0f;                // m/s
}

float pidPaso(Pid &p, float objetivo, float medida, float dt) {
  float e = objetivo - medida;
  p.integral = limitar(p.integral + e * dt, -1.0f, 1.0f);   // anti-windup simple
  float d = (e - p.errPrev) / dt;
  p.errPrev = e;
  float base = objetivo / ((velModelo(1.0f) > 0.01f) ? velModelo(1.0f) : 0.01f);
  float u = base + PID_KP * e + PID_KI * p.integral + PID_KD * d;
  return limitar(u, 0.0f, 1.0f);
}

// =====================================================================
// 7. BATERÍA Y ALERTAS
// =====================================================================
const float DIVISOR      = (100.0f + 22.0f) / 22.0f;
const float BAT_LLENA_V  = 12.6f;   // batería 3S llena
const float BAT_BAJA_V   = 9.9f;    // alarma de batería baja (la de P08)

float leerBateriaV() {
  // analogReadMilliVolts usa la calibración de fábrica del ESP32
  return analogReadMilliVolts(PIN_BATERIA) / 1000.0f * DIVISOR;
}

int bateriaPorcentaje(float v) {
  float p = (v - BAT_BAJA_V) / (BAT_LLENA_V - BAT_BAJA_V) * 100.0f;
  return (int)(limitar(p, 0.0f, 100.0f) + 0.5f);
}

// =====================================================================
// 8. MÁQUINA DE ESTADOS DEL ROBOT
// =====================================================================
/*
  MODO_AUTONOMO:  el robot sigue la línea con el PD. Es el modo por defecto.
  MODO_MANUAL:    obedece órdenes (adelante/atrás/izquierda/derecha/frenar)
                  que llegan por MQTT o por el Monitor Serie.

  Reglas de cambio:
    - Cualquier orden con "cmd" (o una tecla de manejo) pasa a MANUAL.
    - "cmd":"auto" (o la tecla o) vuelve a AUTONOMO.
    - SEGURIDAD: si en MANUAL pasan 5 s sin órdenes, vuelve a AUTONOMO.
      Así el robot no se queda corriendo solo si se cae el Wi-Fi o la app.
*/
enum Modo {
  MODO_AUTONOMO,
  MODO_MANUAL
};
Modo modo = MODO_AUTONOMO;

const uint32_t TIMEOUT_MANUAL_MS  = 5000;   // 5 s sin órdenes -> autónomo
const uint32_t ESPERA_ARRANQUE_MS = 1500;   // tiempo para ubicar el robot al encender
uint32_t ultimaOrdenMs = 0;
uint32_t inicioMs = 0;

// Velocidad y sentido del modo manual
float velManual = 0.75f;          // 0 a 1 (el simulador de P03 empieza en 75 %)
const float PASO_VEL = 0.05f;
int dirIzq = 0, dirDer = 0;       // +1 adelante, -1 atrás, 0 frena

// Paro por pérdida de red: si en MANUAL se cae el Wi-Fi o el MQTT, el robot
// frena y NO vuelve a arrancar hasta que llegue una orden nueva.
bool paroPorRed = false;

// Frena y latchea el paro. Sin esto, controlar() reaplicaría el PWM manual
// a los 10 ms y el robot seguiría avanzando a ciegas.
void paradaSegura() {
  dirIzq = 0;
  dirDer = 0;
  paroPorRed = true;
  detener();
  Serial.println("PARO POR RED: motores detenidos hasta nueva orden");
}

const char* nombreModo() {
  return (modo == MODO_AUTONOMO) ? "autonomo" : "manual";
}

// Cambia a AUTONOMO reiniciando el PD para que el cambio no dé un tirón
void pasarAAutonomo() {
  if (modo == MODO_AUTONOMO) return;
  modo = MODO_AUTONOMO;
  paroPorRed = false;                // una orden explícita libera el paro por red
  estadoLinea.hayError = false;      // sin historial: el término D arranca en 0
  estadoLinea.errorAnterior = 0.0f;
  estadoLinea.ultimaPos = 0.0f;
  pidIzq = Pid();
  pidDer = Pid();
  Serial.println("Modo AUTONOMO");
}

// Aplica una orden de movimiento (vel < 0 significa "mantener la actual")
void aplicarCmd(const String &cmd, float vel) {
  ultimaOrdenMs = millis();
  paroPorRed = false;                // cualquier orden nueva libera el paro

  if (cmd == "auto") { pasarAAutonomo(); return; }

  modo = MODO_MANUAL;
  if (cmd == "adelante")       { dirIzq = +1; dirDer = +1; }
  else if (cmd == "atras")     { dirIzq = -1; dirDer = -1; }
  else if (cmd == "izquierda") { dirIzq = -1; dirDer = +1; }
  else if (cmd == "derecha")   { dirIzq = +1; dirDer = -1; }
  else                         { dirIzq = 0; dirDer = 0; }   // "frenar" o desconocido

  if (vel >= 0.0f) velManual = limitar(vel, 0.0f, 1.0f);
  Serial.println("Modo MANUAL: " + cmd);
}

// =====================================================================
// 9. VARIABLES DE MQTT Y TELEMETRÍA
// =====================================================================
unsigned long ordenesRecibidas = 0;
unsigned long numeroEstado = 0;
unsigned long numeroAlarma = 0;

uint32_t ultimoEstado = 0;
uint32_t ultimoImpreso = 0;
uint32_t ultimoControl = 0;
uint32_t ultimoBoton = 0;
bool botonAntes = true;                 // BOOT está en alto cuando no se aprieta
bool alertaBateriaEnviada = false;      // para no repetir la alerta de batería baja

// Cola de pedidos que falta confirmar (se confirma en loop, no en el callback)
const int MAX_PENDIENTES = 60;
String idsPendientes[MAX_PENDIENTES];
int cantidadPendientes = 0;

// Medidas de los encoders (se actualizan cada 10 ms)
long cuentaIzqPrev = 0, cuentaDerPrev = 0;
float rpmIzq = 0.0f, rpmDer = 0.0f;
float vIzq = 0.0f, vDer = 0.0f;
float pwmIzqAplicado = 0.0f, pwmDerAplicado = 0.0f;

// =====================================================================
// 10. LECTURA DEL JSON (pedidos de la app) — tolerante a espacios
// =====================================================================
// {"cmd":"adelante"} y { "cmd" : "adelante" } se leen igual.
bool esEspacioJson(char c) {
  return c == ' ' || c == '\t' || c == '\n' || c == '\r';
}

// Devuelve el índice del primer carácter del VALOR de "campo", o -1.
// La comilla inicial del patrón ancla la búsqueda: "nocmd" no da falso positivo.
int localizarValor(const String &json, const char *campo) {
  String patron = String("\"") + campo + "\"";
  int i = json.indexOf(patron);
  if (i < 0) return -1;
  i += patron.length();
  const int n = (int)json.length();
  while (i < n && esEspacioJson(json[i])) i++;     // espacios antes de ':'
  if (i >= n || json[i] != ':') return -1;
  i++;
  while (i < n && esEspacioJson(json[i])) i++;     // espacios después de ':'
  return (i < n) ? i : -1;
}

// Saca el valor de un campo de texto: {"cmd":"adelante"} -> "adelante"
String leerCadena(const String &json, const char *campo) {
  int i = localizarValor(json, campo);
  if (i < 0 || json[i] != '"') return "";
  int f = json.indexOf('"', i + 1);
  if (f < 0) return "";
  return json.substring(i + 1, f);
}

// Saca un número: {"vel":0.6} -> 0.6. Devuelve false si el campo no está
// o si no empieza por un dígito/signo (p.ej. "vel":true).
bool leerNumero(const String &json, const char *campo, float &valor) {
  int i = localizarValor(json, campo);
  if (i < 0) return false;
  const int n = (int)json.length();
  int f = i;
  while (f < n) {
    char c = json[f];
    if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' ||
        c == 'e' || c == 'E') f++;
    else break;
  }
  if (f == i) return false;
  valor = json.substring(i, f).toFloat();
  return true;
}

// =====================================================================
// 11. MQTT: recepción, conexión y publicación
// =====================================================================
void alRecibirMensaje(String &topico, String &mensaje) {
  ordenesRecibidas++;
  String id = leerCadena(mensaje, "id");
  if (id.length() == 0) id = "sin-id";
  Serial.println("Pedido #" + String(ordenesRecibidas) + " (" + id + "): " + mensaje);

  // 1) Se encola la confirmación (se publica desde loop, no aquí)
  if (cantidadPendientes < MAX_PENDIENTES) {
    idsPendientes[cantidadPendientes++] = id;
  }

  // 2) Si la orden trae "cmd", es una orden de movimiento
  String cmd = leerCadena(mensaje, "cmd");
  if (cmd.length() > 0) {
    float vel = -1.0f;
    leerNumero(mensaje, "vel", vel);
    aplicarCmd(cmd, vel);
  }
}

bool conectarMQTT() {
  String idCliente = "robot-ucab-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (!mqtt.connect(idCliente.c_str())) return false;
  mqtt.publish(T_CONEXION, "en linea", true, 1);  // retenido: quien llegue después lo ve
  mqtt.subscribe(T_ORDENES, 1);                   // pedidos con QoS 1
  Serial.println("MQTT conectado");
  return true;
}

// Regla de seguridad: en MANUAL, perder la red = detenerse YA.
// En AUTONOMO no se toca nada: el PD sigue siguiendo la línea.
void alPerderRed() {
  if (modo == MODO_MANUAL) paradaSegura();
}

// Máquina de fases de la red: reintenta con millis, nunca con delay.
// El único bloqueo es mqtt.connect() dentro de RED_CONECTANDO_MQTT, acotado
// a TIMEOUT_MQTT_MS (1 s) y solo mientras los motores están parados.
void gestionarRed() {
  uint32_t ahora = millis();
  switch (faseRed) {
    case RED_ESPERANDO_WIFI:
      if (WiFi.status() == WL_CONNECTED) {
        Serial.print("Wi-Fi listo, IP ");
        Serial.println(WiFi.localIP());
        esperaMqttActual = REINTENTO_MQTT_MS;          // backoff a cero
        faseRed = RED_CONECTANDO_MQTT;
        ultimoIntentoRed = ahora - REINTENTO_MQTT_MS;  // intenta en esta vuelta
      } else if (ahora - ultimoIntentoRed >= REINTENTO_WIFI_MS) {
        ultimoIntentoRed = ahora;
        Serial.println("Wi-Fi: reintentando...");
        WiFi.begin(WIFI_RED, WIFI_CLAVE);
      }
      break;

    case RED_CONECTANDO_MQTT:
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi caido");
        alPerderRed();
        faseRed = RED_ESPERANDO_WIFI;
        ultimoIntentoRed = ahora;
        break;
      }
      if (ahora - ultimoIntentoRed < esperaMqttActual) break;  // aún no toca
      ultimoIntentoRed = ahora;
      detener();   // el intento puede bloquear 1 s: no avanzar a ciegas
      if (conectarMQTT()) {
        faseRed = RED_LISTO;
        esperaMqttActual = REINTENTO_MQTT_MS;                  // backoff reiniciado
      } else {
        esperaMqttActual = min(esperaMqttActual * 2, REINTENTO_MQTT_MAX_MS);
        Serial.print("MQTT sin conexion, reintento en ");
        Serial.print(esperaMqttActual / 1000);
        Serial.println(" s");
      }
      break;

    case RED_LISTO:
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi caido");
        alPerderRed();
        faseRed = RED_ESPERANDO_WIFI;
        ultimoIntentoRed = ahora;
      } else if (!mqtt.connected()) {
        Serial.println("MQTT caido");
        alPerderRed();
        faseRed = RED_CONECTANDO_MQTT;
        ultimoIntentoRed = ahora;
        esperaMqttActual = REINTENTO_MQTT_MS;   // vuelve a 3 s tras una caída
      }
      break;
  }
}

// Confirma un pedido por vuelta de loop (QoS 1)
void procesarAcks() {
  if (cantidadPendientes == 0) return;
  String id = idsPendientes[0];
  for (int i = 1; i < cantidadPendientes; i++) idsPendientes[i - 1] = idsPendientes[i];
  cantidadPendientes--;
  if (!mqtt.connected()) return;
  String ack = "{\"id\":\"" + id + "\",\"recibidas\":" + String(ordenesRecibidas) +
               ",\"t\":" + String(millis()) + "}";
  mqtt.publish(T_ACK, ack, false, 1);
}

// Alerta con QoS 2 (antirrobo, batería baja, etc.)
void enviarAlerta(const char *tipo, bool prueba) {
  numeroAlarma++;
  String a = "{\"n\":" + String(numeroAlarma) +
             ",\"tipo\":\"" + tipo + "\"" +
             ",\"prueba\":" + (prueba ? "true" : "false") +
             ",\"t\":" + String(millis()) + "}";
  if (mqtt.connected()) mqtt.publish(T_ALERTAS, a, false, 2);
  Serial.println("Alerta #" + String(numeroAlarma) + " (" + tipo + ") enviada");
}

// Estado periódico cada 2 s (QoS 0) + revisión de batería baja
void publicarEstado() {
  uint32_t ahora = millis();
  if (ahora - ultimoEstado < PERIODO_ESTADO_MS) return;
  ultimoEstado = ahora;
  numeroEstado++;

  float vbat = leerBateriaV();
  int pct = bateriaPorcentaje(vbat);

  // Alerta de batería baja con histéresis (se rearma al recuperar 0,3 V)
  bool baja = vbat < BAT_BAJA_V;
  if (baja && !alertaBateriaEnviada) {
    alertaBateriaEnviada = true;
    enviarAlerta("bateria_baja", false);
  } else if (!baja && vbat > BAT_BAJA_V + 0.3f) {
    alertaBateriaEnviada = false;
  }

  if (!mqtt.connected()) return;
  String estado = "{\"n\":" + String(numeroEstado) +
                  ",\"estado\":\"" + nombreModo() + "\"" +
                  ",\"bateria\":" + String(pct) +
                  ",\"bateria_v\":" + String(vbat, 2) +
                  ",\"ordenes\":" + String(ordenesRecibidas) +
                  ",\"linea_mm\":" + String(ultimaSalida.pos_mm, 1) +
                  ",\"v_izq\":" + String(vIzq, 2) +
                  ",\"v_der\":" + String(vDer, 2) +
                  ",\"t\":" + String(millis()) + "}";
  mqtt.publish(T_ESTADO, estado, false, 0);
}

// =====================================================================
// 12. BOTÓN, TECLAS Y GANCHO DE LA IMU
// =====================================================================
void atenderBotonYSerie() {
  // Botón BOOT: alarma de prueba (activo en bajo, antirrebote 300 ms)
  bool boton = digitalRead(PIN_PRUEBA);
  if (!boton && botonAntes && millis() - ultimoBoton > 300) {
    ultimoBoton = millis();
    enviarAlerta("antirrobo", true);
  }
  botonAntes = boton;

  // Teclas del Monitor Serie
  while (Serial.available()) {
    char k = Serial.read();
    if      (k == 'w')                 aplicarCmd("adelante", -1.0f);
    else if (k == 's')                 aplicarCmd("atras", -1.0f);
    else if (k == 'a')                 aplicarCmd("izquierda", -1.0f);
    else if (k == 'd')                 aplicarCmd("derecha", -1.0f);
    else if (k == ' ' || k == 'x')     aplicarCmd("frenar", -1.0f);
    else if (k == 'o')                 pasarAAutonomo();
    else if (k == 't')                 enviarAlerta("antirrobo", true);
    else if (k == '+' || k == '=') {
      velManual = limitar(velManual + PASO_VEL, 0.0f, 1.0f);
      if (modo == MODO_MANUAL) ultimaOrdenMs = millis();
    } else if (k == '-') {
      velManual = limitar(velManual - PASO_VEL, 0.0f, 1.0f);
      if (modo == MODO_MANUAL) ultimaOrdenMs = millis();
    }
  }
}

/*
  GANCHO IMU (MPU6050) — listo para conectar en el futuro.
  La IMU no está en los tres sketches fusionados; el mapa de pines le reserva
  SDA = 21, SCL = 22 e INT = 2.

  Para conectarla:
    1. Instala la librería "Adafruit MPU6050" y añade:
         #include <Wire.h>
         #include <Adafruit_MPU6050.h>
         Adafruit_MPU6050 imu;
    2. En setup():  Wire.begin(21, 22);
                    if (imu.begin()) imuLista = true;
    3. En el TODO de abajo, lee el acelerómetro y si el módulo supera el
       umbral (empujón/manipulación), llama enviarAlerta("antirrobo_imu", false).
    4. No hay que tocar loop(): esta función ya se llama desde ahí cada 50 ms.
*/
bool imuLista = false;                 // pasa a true cuando la IMU responda
uint32_t ultimoChequeoIMU = 0;
const uint32_t PERIODO_IMU_MS = 50;

void atenderIMU() {
  if (!imuLista) return;               // sin IMU configurada no hace nada
  uint32_t ahora = millis();
  if (ahora - ultimoChequeoIMU < PERIODO_IMU_MS) return;
  ultimoChequeoIMU = ahora;

  // TODO al conectar la MPU6050:
  //   sensors_event_t a, g, temp;
  //   imu.getEvent(&a, &g, &temp);
  //   float modulo = sqrtf(a.acceleration.x * a.acceleration.x +
  //                        a.acceleration.y * a.acceleration.y +
  //                        a.acceleration.z * a.acceleration.z);
  //   if (modulo > 12.0f) enviarAlerta("antirrobo_imu", false);  // ~1,2 g
}

// =====================================================================
// 13. CONTROL A 100 Hz (PD autónomo o PWM manual) — SIN delay()
// =====================================================================
void controlar() {
  uint32_t ahora = millis();
  if (ahora - ultimoControl < PERIODO_CONTROL_MS) return;
  float dt = (ahora - ultimoControl) / 1000.0f;
  ultimoControl = ahora;
  if (dt <= 0.0f) dt = PERIODO_CONTROL_MS / 1000.0f;

  // --- 1) Medir los encoders (lectura atómica: noInterrupts/interrupts) ---
  noInterrupts();
  long cI = cuentaIzq;
  long cD = cuentaDer;
  interrupts();

  float vueltasIzq = (cI - cuentaIzqPrev) / CUENTAS_VUELTA / dt;
  float vueltasDer = (cD - cuentaDerPrev) / CUENTAS_VUELTA / dt;
  cuentaIzqPrev = cI;
  cuentaDerPrev = cD;

  rpmIzq = vueltasIzq * 60.0f;
  rpmDer = vueltasDer * 60.0f;
  vIzq = vueltasIzq * PI * RUEDA_D;   // m/s, con signo (+ = adelante)
  vDer = vueltasDer * PI * RUEDA_D;

  // --- 2) Espera de arranque (reemplaza el delay(2000) de P08) ---
  if (ahora - inicioMs < ESPERA_ARRANQUE_MS) {
    detener();
    return;
  }

  // --- 3a) Paro por red: no se reaplica PWM mientras dure el latch ---
  if (paroPorRed) {
    detener();
    return;
  }

  // --- 3b) Máquina de estados: timeout de seguridad del modo MANUAL ---
  if (modo == MODO_MANUAL && (ahora - ultimaOrdenMs) > TIMEOUT_MANUAL_MS) {
    Serial.println("Manual sin ordenes por 5 s: vuelvo a AUTONOMO (seguridad)");
    pasarAAutonomo();
  }

  // --- 4) Actuar según el modo ---
  if (modo == MODO_AUTONOMO) {
    // 4a) Leer los 4 sensores y calcular el PD
    int raw[4];
    for (int i = 0; i < 4; i++) raw[i] = analogRead(PIN_SENSOR[i]);
    ultimaSalida = calcularControl(estadoLinea, raw, dt);
    pwmIzqAplicado = ultimaSalida.izq;
    pwmDerAplicado = ultimaSalida.der;
  } else {
    // 4b) Manual: el PWM sale del sentido y de la velocidad elegida
    float pwmI = dirIzq * velManual;
    float pwmD = dirDer * velManual;
    if (usarPIDVelocidad) {
      float objetivo = velModelo(velManual);
      pwmI = dirIzq * pidPaso(pidIzq, objetivo, fabsf(vIzq), dt);
      pwmD = dirDer * pidPaso(pidDer, objetivo, fabsf(vDer), dt);
    }
    pwmIzqAplicado = pwmI;
    pwmDerAplicado = pwmD;
  }

  moverMotor(PIN_ENA, PIN_IN1, PIN_IN2, pwmIzqAplicado);
  moverMotor(PIN_ENB, PIN_IN3, PIN_IN4, pwmDerAplicado);
}

// Telemetría por serie, 1 vez por segundo (para calibrar y depurar)
void imprimirTelemetria() {
  uint32_t ahora = millis();
  if (ahora - ultimoImpreso < 1000) return;
  ultimoImpreso = ahora;

  Serial.printf("[%s] linea %6.1f mm | P %5.2f D %5.2f%s | PWM izq %5.2f der %5.2f | "
                "izq %5.2f m/s der %5.2f m/s | bat %4.1f V\n",
                nombreModo(),
                ultimaSalida.pos_mm, ultimaSalida.P, ultimaSalida.D,
                ultimaSalida.perdida ? " PERDIDA" : "",
                pwmIzqAplicado, pwmDerAplicado,
                vIzq, vDer, leerBateriaV());
}

// =====================================================================
// 14. SETUP
// =====================================================================
void setup() {
  Serial.begin(115200);

  // Botón BOOT
  pinMode(PIN_PRUEBA, INPUT_PULLUP);

  // Motores
  pinMode(PIN_IN1, OUTPUT);
  pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_IN3, OUTPUT);
  pinMode(PIN_IN4, OUTPUT);
  ledcAttach(PIN_ENA, PWM_HZ, PWM_BITS);   // CORE 3.x
  ledcAttach(PIN_ENB, PWM_HZ, PWM_BITS);
  // CORE 2.x, en su lugar:
  //   ledcSetup(0, PWM_HZ, PWM_BITS); ledcAttachPin(PIN_ENA, 0);
  //   ledcSetup(1, PWM_HZ, PWM_BITS); ledcAttachPin(PIN_ENB, 1);

  // Encoders (interrupciones en los 4 canales)
  pinMode(PIN_ENC_IZQ_A, INPUT_PULLUP);
  pinMode(PIN_ENC_IZQ_B, INPUT_PULLUP);
  pinMode(PIN_ENC_DER_A, INPUT_PULLUP);
  pinMode(PIN_ENC_DER_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_IZQ_A), isrIzq, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_IZQ_B), isrIzq, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_DER_A), isrDer, CHANGE);
  attachInterrupt(digitalPinToInterrupt(PIN_ENC_DER_B), isrDer, CHANGE);

  // Sensores de línea y batería (ADC1, 12 bits, hasta ~3,3 V)
  analogReadResolution(12);
  for (int i = 0; i < 4; i++) {
    pinMode(PIN_SENSOR[i], INPUT);
    analogSetPinAttenuation(PIN_SENSOR[i], ADC_11db);
  }
  analogSetPinAttenuation(PIN_BATERIA, ADC_11db);

  detener();

  // Wi-Fi (sin bloqueo: la conexión real la sigue gestionarRed en loop)
  WiFi.mode(WIFI_STA);
  Serial.print("Red configurada: ");
  Serial.println(WIFI_RED);
  if (String(WIFI_RED) == "TU_RED_WIFI") {
    Serial.println("AVISO: edita secrets.h con tu red y tu clave");
  }
  WiFi.begin(WIFI_RED, WIFI_CLAVE);

  // MQTT
  mqtt.begin(BROKER, BROKER_PUERTO, red);
  red.setTimeout(TIMEOUT_MQTT_MS);   // acota también el TCP contra el broker
  // keepAlive 15 s, sesión persistente y 1 s máximo esperando al broker
  mqtt.setOptions(15, false, TIMEOUT_MQTT_MS);
  mqtt.setWill(T_CONEXION, "desconectado", true, 1);   // última voluntad (LWT)
  mqtt.onMessage(alRecibirMensaje);

  // Temporizadores
  inicioMs = millis();
  ultimoControl = millis() - PERIODO_CONTROL_MS;   // el primer cálculo entra enseguida

  Serial.println("Robot integrado listo.");
  Serial.println("Teclas: w s a d | espacio/x frenar | + - velocidad | t alarma | o autonomo");
}

// =====================================================================
// 15. LOOP PRINCIPAL (libre de bloqueos)
// =====================================================================
void loop() {
  mqtt.loop();               // siempre: atiende mensajes y reconexión de la librería
  gestionarRed();            // Wi-Fi/MQTT por fases, con millis()
  procesarAcks();            // confirma pedidos pendientes (QoS 1)
  atenderBotonYSerie();      // botón BOOT, teclas y alarma
  atenderIMU();              // gancho de la MPU6050 (por ahora no hace nada)
  controlar();               // PD o manual cada 10 ms (100 Hz)
  publicarEstado();          // estado cada 2 s (QoS 0)
  imprimirTelemetria();      // monitor serie cada 1 s
}
