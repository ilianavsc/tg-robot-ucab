// Banco de pruebas del firmware en el PC: compila robot_integrado.ino con
// stubs del core ESP32 y ejecuta los escenarios de seguridad (SIL: Software
// In the Loop). No reemplaza la prueba con el robot físico (HIL).
#include "Arduino.h"
#include "MQTT.h"
uint32_t g_millis = 0;
uint32_t g_bat_mv = 2000;   // ~11,1 V tras el divisor
std::map<int,int> g_duty, g_pin;
std::vector<Pub> g_pubs;
HardwareSerial Serial;
EspClass ESP;
WiFiClass WiFi;
// El .ino se compila tal cual como C++ (los stubs reemplazan al core ESP32)
#include "../robot_integrado.ino"

static int fallos = 0, total = 0;
#define CHECK(c, msg) do { total++; if (c) printf("  OK   %s\n", msg); else { fallos++; printf("  FALLA %s\n", msg); } } while (0)

// Un "tick" de 10 ms. En cada ciclo de disparo (100 ms) se inyecta el pulso de
// eco (us) que habría recogido la ISR del sensor de turno.
// pulso 0 = sin eco; 38000 = timeout del HC-SR04P (nada en 4 m).
unsigned long ecoF = 1160 * 5, ecoA = 1160 * 5;   // ~100 cm
void avanzar(uint32_t ms) {
  for (uint32_t i = 0; i < ms; i += 10) {
    g_millis += 10;
    if (g_millis - ultimoDisparoUltra >= PERIODO_DISPARO_ULTRA_MS) { usPulsoFrente = ecoF; usPulsoAtras = ecoA; }
    loop();
  }
}
void ponerBateria(float v) { g_bat_mv = (uint32_t)(v / DIVISOR * 1000.0f + 0.5f); }
bool motoresParados() { return g_duty[PIN_ENA] == 0 && g_duty[PIN_ENB] == 0; }
int alertas(const char* tipo) {
  int n = 0;
  for (auto& p : g_pubs) if (p.topic == T_ALERTAS && p.payload.find(std::string("\"tipo\":\"") + tipo + "\"") != std::string::npos) n++;
  return n;
}
int publicaciones(const char* t, const std::string& contiene) {
  int n = 0;
  for (auto& p : g_pubs) if (p.topic == t && p.payload.find(contiene) != std::string::npos) n++;
  return n;
}
std::string ultimoPub(const char* t) { for (auto it = g_pubs.rbegin(); it != g_pubs.rend(); ++it) if (it->topic == t) return it->payload; return ""; }
void ordenMqtt(const char* json) {
  String t = T_ORDENES, m = json;
  alRecibirMensaje(t, m);
}
void reiniciar() {
  g_pubs.clear(); g_duty.clear();
  modo = MODO_AUTONOMO; paroPorTimeout = false; paroPorRed = false; dirIzq = dirDer = 0;
  ecoF = 1160 * 5; ecoA = 1160 * 5;
  ponerBateria(11.1f);
  avanzar(1000);   // ecos válidos en los 2 sensores y batería rearmada
  paroPorBateria = false;
  ultimoIdOrden = "";
}

int main() {
  setup();
  faseRed = RED_LISTO;
  avanzar(2000);   // pasa la espera de arranque y valida los sensores

  printf("T1 · Timeout manual fail-safe (5 s)\n");
  reiniciar();
  aplicarCmd("adelante", 0.6f);
  avanzar(1000);
  CHECK(!motoresParados(), "en manual 'adelante' los motores giran");
  avanzar(4200);
  CHECK(modo == MODO_MANUAL, "tras 5 s sin ordenes sigue en MANUAL (no pasa a autonomo)");
  CHECK(motoresParados(), "tras 5 s sin ordenes los motores estan en 0");
  CHECK(paroPorTimeout, "latch paroPorTimeout activo");
  CHECK(alertas("timeout_manual") == 1, "alerta 'timeout_manual' publicada una vez");
  avanzar(10000);
  CHECK(modo == MODO_MANUAL && motoresParados(), "10 s despues sigue detenido en MANUAL");
  CHECK(alertas("timeout_manual") == 1, "la alerta no se repite");
  avanzar(1600);
  CHECK(ultimoPub(T_ESTADO).find("\"parada\":\"timeout\"") != std::string::npos, "estado publica parada=timeout");
  aplicarCmd("adelante", -1.0f);
  avanzar(200);
  CHECK(!motoresParados(), "una orden nueva libera el paro");

  printf("T2 · Fallo de eco FRENTE (0 cm persistente)\n");
  reiniciar();
  aplicarCmd("adelante", 0.6f);
  avanzar(200);
  CHECK(!motoresParados(), "avanza con eco valido");
  ecoF = 0;            // se desconecta el modulo delantero
  avanzar(400);
  CHECK(sensorFrenteOk, "con 2 lecturas propias sin eco (400 ms) aun no declara fallo");
  avanzar(400);
  CHECK(!sensorFrenteOk, "con 3 lecturas propias sin eco (600 ms) declara sensorFrenteOk=false");
  CHECK(motoresParados(), "bloquea el avance");
  CHECK(alertas("fallo_sensor_frente") == 1, "alerta 'fallo_sensor_frente' publicada");
  aplicarCmd("derecha", -1.0f); avanzar(100);
  CHECK(motoresParados(), "bloquea tambien los giros");
  aplicarCmd("auto", -1.0f); avanzar(100);
  CHECK(motoresParados(), "bloquea el modo autonomo");
  aplicarCmd("atras", -1.0f); avanzar(100);
  CHECK(!motoresParados(), "permite retroceder (sensor trasero sano y despejado)");
  avanzar(1600);
  CHECK(ultimoPub(T_ULTRASONIDO).find("\"frente_ok\":false") != std::string::npos, "ultrasonido publica frente_ok=false");
  ecoF = 1160 * 5;
  aplicarCmd("adelante", -1.0f);
  avanzar(500);
  CHECK(sensorFrenteOk && !motoresParados(), "con 2 ecos validos se recupera y vuelve a avanzar");
  CHECK(alertas("fallo_sensor_frente") == 1, "una sola alerta por episodio");

  printf("T3 · Sin objeto en 4 m (pulso de timeout) NO es fallo\n");
  reiniciar();
  ecoF = 38000;        // timeout del HC-SR04P: 655 cm -> 0.0 cm "despejado"
  aplicarCmd("adelante", 0.6f);
  avanzar(1500);
  CHECK(frenteCm == 0.0f && sensorFrenteOk && !motoresParados(), "0 cm por fuera de rango con modulo vivo: sigue avanzando");

  printf("T4 · Fallo de eco ATRAS\n");
  reiniciar();
  ecoA = 0;
  aplicarCmd("atras", 0.6f);
  avanzar(800);
  CHECK(!sensorAtrasOk && motoresParados(), "bloquea el retroceso con el sensor trasero en fallo");
  CHECK(alertas("fallo_sensor_atras") == 1, "alerta 'fallo_sensor_atras'");
  aplicarCmd("adelante", -1.0f); avanzar(100);
  CHECK(!motoresParados(), "permite avanzar (frente sano)");

  printf("T5 · Obstaculo frontal 14 cm\n");
  reiniciar();
  aplicarCmd("adelante", 0.6f);
  ecoF = 14 * 58;
  avanzar(300);
  CHECK(obstaculoActivo && motoresParados(), "frena con frente < 20 cm (en <= 300 ms)");
  CHECK(alertas("obstaculo") >= 1, "alerta 'obstaculo' publicada");
  CHECK(ultimoPub(T_ALERTAS).find("\"valor\":14") != std::string::npos, "la alerta lleva la distancia (valor)");
  aplicarCmd("atras", -1.0f); ecoA = 100 * 58; avanzar(100);
  CHECK(!motoresParados(), "permite retroceder con atras >= 20 cm y sensor valido");
  aplicarCmd("atras", -1.0f); ecoA = 10 * 58; avanzar(300);
  CHECK(motoresParados(), "bloqueo total: frente y atras < 20 cm");
  CHECK(alertas("obstaculo_atras") == 1, "alerta 'obstaculo_atras'");

  printf("T6 · Aviso preventivo de bateria (10,05 V) y reposo 0 V\n");
  reiniciar();
  ponerBateria(10.05f);
  avanzar(800);
  CHECK(alertas("bateria_baja") == 1, "aviso 'bateria_baja' a 10,05 V (<= 10,30 V)");
  CHECK(alertas("bateria_critica") == 0 && !paroPorBateria, "10,05 V no es corte (corte <= 9,90 V)");
  g_pubs.clear(); g_bat_mv = 0; alertaAvisoBateriaEnviada = false;
  aplicarCmd("adelante", 0.6f);
  avanzar(1000);
  CHECK(alertas("bateria_critica") == 0 && alertas("bateria_baja") == 0, "0,00 V (USB, sin bateria) no genera alertas");
  CHECK(!paroPorBateria && !motoresParados(), "0,00 V no corta: con USB el robot se puede probar en la mesa");

  printf("T7 · Alertas sin conexion quedan en cola\n");
  reiniciar();
  mqtt.con = false;           // en AUTONOMO la caida de red no frena (sigue la linea)
  ecoF = 10 * 58; avanzar(300);
  CHECK(motoresParados() && alertas("obstaculo") == 0, "sin broker frena igual por obstaculo y la alerta espera en cola");
  mqtt.con = true; avanzar(3500);
  CHECK(alertas("obstaculo") == 1, "al volver el broker la alerta sale");

  printf("T8 · Corte de seguridad por bateria (<= 9,90 V, histeresis 10,10 V)\n");
  reiniciar();
  aplicarCmd("adelante", 0.6f);
  avanzar(200);
  CHECK(!motoresParados(), "con 11,1 V avanza");
  ponerBateria(9.80f); avanzar(200);    // bajon de 1 lectura al arrancar motores
  ponerBateria(11.0f); avanzar(400);
  CHECK(!paroPorBateria && !motoresParados(), "un bajon de 200 ms no corta (exige 3 lecturas)");
  ponerBateria(9.85f);
  aplicarCmd("adelante", -1.0f);
  avanzar(800);
  CHECK(bateriaEnCorte && paroPorBateria && motoresParados(), "con 9,85 V sostenidos frena (detener)");
  CHECK(alertas("bateria_critica") == 1, "alerta 'bateria_critica' publicada");
  CHECK(ultimoPub(T_ALERTAS).find("\"valor\":9.8") != std::string::npos, "la alerta lleva la tension (valor)");
  aplicarCmd("adelante", -1.0f); avanzar(300);
  CHECK(motoresParados(), "en corte, una orden nueva NO mueve el robot");
  ponerBateria(10.05f); avanzar(1000);  // rebote sin carga: entre corte y rearme
  aplicarCmd("adelante", -1.0f); avanzar(300);
  CHECK(bateriaEnCorte && motoresParados(), "a 10,05 V (< 10,10 V) sigue bloqueado: histeresis");
  avanzar(1600);
  CHECK(ultimoPub(T_ESTADO).find("\"parada\":\"corte_bateria\"") != std::string::npos, "estado publica parada=corte_bateria");
  ponerBateria(10.40f); avanzar(1000);
  CHECK(!bateriaEnCorte && motoresParados(), "a 10,40 V se rearma pero NO arranca solo");
  aplicarCmd("adelante", -1.0f); avanzar(200);
  CHECK(!paroPorBateria && !motoresParados(), "con > 10,10 V y una orden nueva vuelve a moverse");
  CHECK(alertas("bateria_critica") == 1, "una sola alerta de corte por episodio");

  printf("T9 · Deduplicacion de ordenes MQTT por id (QoS 1)\n");
  reiniciar();
  unsigned long antes = ordenesRecibidas;
  ordenMqtt("{\"id\":\"D-1\",\"cmd\":\"adelante\"}");
  avanzar(100);
  CHECK(ordenesRecibidas == antes + 1 && !motoresParados(), "la primera orden se ejecuta y se cuenta");
  avanzar(4000);
  ordenMqtt("{\"id\":\"D-1\",\"cmd\":\"adelante\"}");   // reentrega del broker
  avanzar(100);
  CHECK(ordenesRecibidas == antes + 1, "la reentrega con el mismo id no se cuenta");
  CHECK(ordenesDuplicadas == 1, "contador de duplicados = 1");
  char ack[64];
  snprintf(ack, sizeof ack, "\"id\":\"D-1\",\"recibidas\":%lu", antes + 1);
  CHECK(publicaciones(T_ACK, ack) == 2, "se reconfirma con el MISMO numero de recibidas");
  avanzar(1000);
  CHECK(paroPorTimeout && motoresParados(), "el duplicado no renueva el timeout de 5 s (no hay doble ejecucion)");
  ordenMqtt("{\"id\":\"D-2\",\"cmd\":\"frenar\"}");
  ordenMqtt("{\"id\":\"D-1\",\"cmd\":\"adelante\"}");   // id viejo, no es el ultimo
  avanzar(100);
  CHECK(ordenesRecibidas == antes + 3 && !motoresParados(), "solo se compara con el ultimo id (D-1 despues de D-2 se acepta)");
  ordenMqtt("{\"cmd\":\"frenar\"}");
  ordenMqtt("{\"cmd\":\"frenar\"}");
  CHECK(ordenesRecibidas == antes + 5, "las ordenes sin id no se deduplican");

  printf("T10 · Lectura alternada de ultrasonidos (pares frente, impares atras)\n");
  reiniciar();
  uint8_t sinF0 = sinEcoFrente, sinA0 = sinEcoAtras;
  ecoF = 0; ecoA = 0;
  avanzar(400);   // 4 ciclos de 100 ms
  CHECK(sinEcoFrente - sinF0 == 2 && sinEcoAtras - sinA0 == 2, "en 4 ciclos cada sensor se lee 2 veces (cada 200 ms)");
  ecoF = 1160 * 5; ecoA = 1160 * 5; avanzar(600);
  bool turno = turnoFrente;
  avanzar(100);
  CHECK(turnoFrente != turno, "el turno cambia en cada ciclo");
  turnoFrente = true;                           // turno del frente
  unsigned long inicioAtras = usInicioAtras;
  g_millis += 1; g_pin[PIN_ULTRA_ATRAS] = 1;
  isrEchoAtras();                               // flanco del trasero fuera de turno
  CHECK(usInicioAtras == inicioAtras, "la ISR ignora el eco del sensor que no esta de turno");
  g_pin[PIN_ULTRA_ATRAS] = 0;
  turnoFrente = false;                          // turno del trasero
  unsigned long inicioFrente = usInicioFrente;
  g_millis += 1; g_pin[PIN_ULTRA_FRENTE] = 1;
  isrEchoFrente();
  CHECK(usInicioFrente == inicioFrente, "y al reves: el frente se ignora en el turno del trasero");
  g_pin[PIN_ULTRA_FRENTE] = 0;

  if (fallos) printf("\nResultado: FALLARON %d comprobaciones\n", fallos);
  else printf("\nResultado: escenarios T1-T10 en verde\n");
  return fallos ? 1 : 0;
}
