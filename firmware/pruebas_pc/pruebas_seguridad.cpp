// Banco de pruebas del firmware en el PC: compila robot_integrado.ino con
// stubs y ejecuta los escenarios de seguridad de la Tarea 1.
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

// Un "tick" de 10 ms. Cada 100 ms inyecta los pulsos de eco (us) que
// recogerían las ISR. pulso 0 = sin eco; 38000 = timeout (nada en 4 m).
unsigned long ecoF = 1160 * 5, ecoA = 1160 * 5;   // ~100 cm
void avanzar(uint32_t ms) {
  for (uint32_t i = 0; i < ms; i += 10) {
    g_millis += 10;
    if (g_millis - ultimoDisparoUltra >= PERIODO_DISPARO_ULTRA_MS) { usPulsoFrente = ecoF; usPulsoAtras = ecoA; }
    loop();
  }
}
bool motoresParados() { return g_duty[PIN_ENA] == 0 && g_duty[PIN_ENB] == 0; }
int alertas(const char* tipo) {
  int n = 0;
  for (auto& p : g_pubs) if (p.topic == T_ALERTAS && p.payload.find(std::string("\"tipo\":\"") + tipo + "\"") != std::string::npos) n++;
  return n;
}
std::string ultimoPub(const char* t) { for (auto it = g_pubs.rbegin(); it != g_pubs.rend(); ++it) if (it->topic == t) return it->payload; return ""; }
void reiniciar() {
  g_pubs.clear(); g_duty.clear();
  modo = MODO_AUTONOMO; paroPorTimeout = false; paroPorRed = false; dirIzq = dirDer = 0;
  ecoF = 1160 * 5; ecoA = 1160 * 5;
  avanzar(600);   // ecos válidos -> sensores OK
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
  avanzar(300);
  CHECK(sensorFrenteOk, "con 3 lecturas sin eco aun no declara fallo");
  avanzar(300);
  CHECK(!sensorFrenteOk, "con >= 5 lecturas sin eco declara sensorFrenteOk=false");
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
  avanzar(400);
  CHECK(sensorFrenteOk && !motoresParados(), "con 3 ecos validos se recupera y vuelve a avanzar");
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
  avanzar(700);
  CHECK(!sensorAtrasOk && motoresParados(), "bloquea el retroceso con el sensor trasero en fallo");
  CHECK(alertas("fallo_sensor_atras") == 1, "alerta 'fallo_sensor_atras'");
  aplicarCmd("adelante", -1.0f); avanzar(100);
  CHECK(!motoresParados(), "permite avanzar (frente sano)");

  printf("T5 · Obstaculo frontal 14 cm\n");
  reiniciar();
  aplicarCmd("adelante", 0.6f);
  ecoF = 14 * 58;
  avanzar(300);
  CHECK(obstaculoActivo && motoresParados(), "frena con frente < 20 cm");
  CHECK(alertas("obstaculo") >= 1, "alerta 'obstaculo' publicada");
  CHECK(g_pubs.size() && ultimoPub(T_ALERTAS).find("\"valor\":14") != std::string::npos, "la alerta lleva la distancia (valor)");
  aplicarCmd("atras", -1.0f); ecoA = 100 * 58; avanzar(100);
  CHECK(!motoresParados(), "permite retroceder con atras >= 20 cm y sensor valido");
  aplicarCmd("atras", -1.0f); ecoA = 10 * 58; avanzar(300);
  CHECK(motoresParados(), "bloqueo total: frente y atras < 20 cm");
  CHECK(alertas("obstaculo_atras") == 1, "alerta 'obstaculo_atras'");

  printf("T6 · Bateria critica 10,05 V y reposo 0 V\n");
  reiniciar();
  g_bat_mv = (uint32_t)(10.05f / DIVISOR * 1000.0f + 0.5f);
  avanzar(2100);
  CHECK(alertas("bateria_critica") == 1, "alerta 'bateria_critica' a 10,05 V");
  CHECK(alertas("bateria_baja") == 0, "aun no 'bateria_baja' (corte 9,9 V)");
  g_pubs.clear(); g_bat_mv = 0; alertaCriticaEnviada = false; alertaBateriaEnviada = false;
  avanzar(4100);
  CHECK(alertas("bateria_critica") == 0 && alertas("bateria_baja") == 0, "0,00 V (sin bateria medida) no genera alertas");
  g_bat_mv = 2000;

  printf("T7 · Alertas sin conexion quedan en cola\n");
  reiniciar();
  mqtt.con = false;           // en AUTONOMO la caida de red no frena (sigue la linea)
  ecoF = 10 * 58; avanzar(300);
  CHECK(motoresParados() && alertas("obstaculo") == 0, "sin broker frena igual por obstaculo y la alerta espera en cola");
  mqtt.con = true; avanzar(3500);
  CHECK(alertas("obstaculo") == 1, "al volver el broker la alerta sale");

  printf("\nResultado: %d/%d pruebas OK\n", total - fallos, total);
  return fallos ? 1 : 0;
}
