/*
  P08 · Seguidor de línea · ESP32 + L298N + 4 × TCRT5000
  Tesis: Robot móvil para búsqueda y transporte de componentes (UCAB Telecom)

  Este código hace lo mismo que el simulador 3D (codigo/model.js, función control()):
    - Lee los 4 sensores TCRT5000 (salida analógica A0) en ADC1.
    - Calcula dónde está la línea (promedio de las lecturas, ponderado por la posición de cada sensor).
    - Controla con un PD y manda un PWM distinto a cada motor.
    - Si ningún sensor ve la línea, sigue girando hacia el lado donde la vio por última vez.
    - Lazo de control a 100 Hz.

  Valores iniciales = los de la página del simulador:
    BASE 0.8 · KP 0.03 · KD 0.0015 · separación entre sensores 18 mm

  IMPORTANTE (qué es medido y qué es supuesto):
    - ADC_PISO, ADC_CINTA, SEP_MM, KP y KD son los de la SIMULACIÓN. Hay que calibrarlos con el robot real.
    - Pines: son la PROPUESTA del mapa de pines (datos/proyecto.js). Se confirman en la Fase II.

  Placa en Arduino IDE: "ESP32 Dev Module". Probado para el core ESP32 3.x (ledcAttach).
  Si usas el core 2.x, mira los comentarios marcados con "CORE 2.x".

  Cómo calibrar (3 pasos):
    1. Sube el código y abre el Monitor Serie a 115200.
    2. Pon el robot con los 4 sensores sobre el piso: anota el valor de raw (ADC_PISO).
       Luego sobre la cinta negra: anota raw (ADC_CINTA). Cambia las dos constantes.
    3. Con el robot en el piso, levanta SOLO la rueda: ajusta KP y KD hasta que no zigzaguee.
*/

#include <Arduino.h>

// ---------- PINES (propuesta del mapa de pines del proyecto) ----------
// Sensores de línea: ADC1 (el ADC2 no funciona con el Wi-Fi encendido). Orden: de IZQUIERDA a DERECHA.
const uint8_t PIN_SENSOR[4] = {36, 39, 34, 35};   // GPIO 36 (VP), 39 (VN), 34, 35: solo entrada

// Puente H L298N, motor izquierdo
const uint8_t PIN_ENA = 25;   // PWM. Quitar el puente (jumper) ENA del L298N
const uint8_t PIN_IN1 = 26;
const uint8_t PIN_IN2 = 27;
// Puente H L298N, motor derecho
const uint8_t PIN_ENB = 14;   // PWM. Quitar el puente (jumper) ENB del L298N
const uint8_t PIN_IN3 = 4;
const uint8_t PIN_IN4 = 13;

// Batería 3S por divisor 100 kΩ + 22 kΩ (12,6 V quedan en 2,27 V)
const uint8_t PIN_BATERIA = 32;

// ---------- PARÁMETROS DEL CONTROL (los mismos de la simulación) ----------
const float BASE = 0.80f;     // velocidad base, de 0 a 1 (en el simulador: 80 %)
const float KP   = 0.030f;    // ganancia proporcional (PWM por cada mm de error)
const float KD   = 0.0015f;   // ganancia derivativa (PWM por cada mm/s de cambio del error)
const float SEP_MM = 18.0f;   // separación entre sensores vecinos (mm). Medir con los módulos reales

// Sensores (SUPUESTOS de la simulación: calibrar con los TCRT5000 reales)
const int   ADC_PISO  = 500;  // lectura sobre piso claro (de 4095)
const int   ADC_CINTA = 3300; // lectura sobre la cinta negra
const float UMBRAL    = 0.20f; // por debajo del 20 % se cuenta como piso
const float SUMA_MIN  = 0.30f; // suma mínima para decir "veo la línea"

// Tiempo
const uint32_t PERIODO_US = 10000;   // 10 ms = 100 Hz, igual que el simulador
const float    DT = PERIODO_US / 1e6f;

// PWM del ESP32
const uint32_t PWM_HZ   = 1000;      // 1 kHz, bueno para el L298N
const uint8_t  PWM_BITS = 10;        // 0 a 1023
const int      PWM_MAX  = (1 << PWM_BITS) - 1;

// Batería baja (la alarma del simulador: 9,9 V)
const float BAT_BAJA_V = 9.9f;
const float DIVISOR = (100.0f + 22.0f) / 22.0f;

// ---------- ESTADO (lo que el ESP32 recuerda entre vueltas del lazo) ----------
struct Estado {
  float ultimaPos = 0.0f;   // última posición (mm) en que vio la línea
  float errorAnterior = 0.0f;
  bool  hayError = false;
};
Estado st;

struct Salida {
  float n[4];       // lecturas normalizadas (0 a 1)
  float suma;
  float pos_mm;     // posición de la línea (+ = a la izquierda)
  float P, D, corr;
  bool  perdida;
  float izq, der;   // PWM de cada motor, de -1 a 1
};

float limitar(float x, float a, float b) { return x < a ? a : (x > b ? b : x); }

// Posición de cada sensor en mm respecto al centro (izquierda +): +1.5, +0.5, -0.5, -1.5 separaciones
float xSensor(int i) { return (1.5f - i) * SEP_MM; }

// El corazón: de las 4 lecturas a los PWM. Es la misma cuenta que control() en model.js.
Salida calcularControl(Estado &e, const int raw[4]) {
  Salida s;
  s.suma = 0;
  for (int i = 0; i < 4; i++) {
    float v = (raw[i] - ADC_PISO) / float(ADC_CINTA - ADC_PISO);
    s.n[i] = (v < UMBRAL) ? 0.0f : (v > 1.0f ? 1.0f : v);
    s.suma += s.n[i];
  }

  float pos;
  s.perdida = false;
  if (s.suma > SUMA_MIN) {
    float acum = 0;
    for (int i = 0; i < 4; i++) acum += s.n[i] * xSensor(i);
    pos = acum / s.suma;
    e.ultimaPos = pos;
  } else {
    // No ve la línea: sigue girando hacia el último lado donde la vio
    s.perdida = true;
    float lado = (e.ultimaPos < 0) ? -1.0f : 1.0f;
    pos = lado * xSensor(0) * 1.2f;
  }
  s.pos_mm = pos;                       // ya está en mm: es el error

  float de = e.hayError ? (pos - e.errorAnterior) / DT : 0.0f;
  e.errorAnterior = pos;
  e.hayError = true;

  s.P = KP * pos;
  s.D = KD * de;
  s.corr = s.P + s.D;
  s.izq = limitar(BASE - s.corr, -1.0f, 1.0f);
  s.der = limitar(BASE + s.corr, -1.0f, 1.0f);
  return s;
}

// ---------- MOTORES ----------
// Manda un PWM de -1 a 1 a un lado. Positivo = adelante, negativo = atrás, 0 = frena.
void moverMotor(uint8_t pinEn, uint8_t pinA, uint8_t pinB, float pwm) {
  int duty = (int)(fabsf(pwm) * PWM_MAX);
  if (pwm > 0)      { digitalWrite(pinA, HIGH); digitalWrite(pinB, LOW); }
  else if (pwm < 0) { digitalWrite(pinA, LOW);  digitalWrite(pinB, HIGH); }
  else              { digitalWrite(pinA, LOW);  digitalWrite(pinB, LOW); }
  ledcWrite(pinEn, duty);   // CORE 2.x: ledcWrite(canal, duty) con canal 0 (izq) y 1 (der)
}

void detener() {
  moverMotor(PIN_ENA, PIN_IN1, PIN_IN2, 0);
  moverMotor(PIN_ENB, PIN_IN3, PIN_IN4, 0);
}

float leerBateriaV() {
  // analogReadMilliVolts usa la calibración de fábrica del ESP32: más exacto que analogRead
  return analogReadMilliVolts(PIN_BATERIA) / 1000.0f * DIVISOR;
}

// ---------- ARRANQUE ----------
void setup() {
  Serial.begin(115200);

  pinMode(PIN_IN1, OUTPUT); pinMode(PIN_IN2, OUTPUT);
  pinMode(PIN_IN3, OUTPUT); pinMode(PIN_IN4, OUTPUT);

  // CORE 3.x: ledcAttach(pin, frecuencia, bits)
  ledcAttach(PIN_ENA, PWM_HZ, PWM_BITS);
  ledcAttach(PIN_ENB, PWM_HZ, PWM_BITS);
  // CORE 2.x, en su lugar:
  //   ledcSetup(0, PWM_HZ, PWM_BITS); ledcAttachPin(PIN_ENA, 0);
  //   ledcSetup(1, PWM_HZ, PWM_BITS); ledcAttachPin(PIN_ENB, 1);

  analogReadResolution(12);                 // 0 a 4095, como en el simulador
  for (int i = 0; i < 4; i++) {
    pinMode(PIN_SENSOR[i], INPUT);
    analogSetPinAttenuation(PIN_SENSOR[i], ADC_11db);   // rango hasta ~3,3 V
  }
  analogSetPinAttenuation(PIN_BATERIA, ADC_11db);

  detener();
  Serial.println("P08 seguidor de linea listo. Empieza en 2 s...");
  delay(2000);
}

// ---------- LAZO PRINCIPAL (100 Hz) ----------
uint32_t proximo = 0;
uint8_t  contador = 0;

void loop() {
  uint32_t ahora = micros();
  if ((int32_t)(ahora - proximo) < 0) return;   // todavía no toca
  proximo = ahora + PERIODO_US;

  // 1) Leer los 4 sensores
  int raw[4];
  for (int i = 0; i < 4; i++) raw[i] = analogRead(PIN_SENSOR[i]);

  // 2) Calcular el control
  Salida s = calcularControl(st, raw);

  // 3) Mandar a los motores
  moverMotor(PIN_ENA, PIN_IN1, PIN_IN2, s.izq);
  moverMotor(PIN_ENB, PIN_IN3, PIN_IN4, s.der);

  // 4) Monitor serie, 10 veces por segundo (para calibrar y depurar)
  if (++contador >= 10) {
    contador = 0;
    float vbat = leerBateriaV();
    Serial.printf("raw %4d %4d %4d %4d | pos %6.1f mm | P %5.2f D %5.2f | izq %5.2f der %5.2f%s | bat %4.1f V%s\n",
                  raw[0], raw[1], raw[2], raw[3], s.pos_mm, s.P, s.D, s.izq, s.der,
                  s.perdida ? " PERDIDA" : "", vbat, vbat < BAT_BAJA_V ? " BAJA" : "");
  }
}
