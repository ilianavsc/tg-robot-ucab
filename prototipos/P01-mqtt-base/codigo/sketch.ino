// P01 MQTT base - Trabajo de Grado Robot UCAB
#include <WiFi.h>
#include <MQTT.h>

// Red y broker
const char* WIFI_RED   = "Wokwi-GUEST";
const char* WIFI_CLAVE = "";
const char* BROKER     = "broker.hivemq.com";

// Topicos
const char* T_ESTADO   = "ucab-tg-sf/robot/estado";
const char* T_ORDENES  = "ucab-tg-sf/robot/ordenes";
const char* T_ACK      = "ucab-tg-sf/robot/ordenes/ack";
const char* T_ALERTAS  = "ucab-tg-sf/robot/alertas";
const char* T_CONEXION = "ucab-tg-sf/robot/conexion";

WiFiClient red;
MQTTClient mqtt(512);

unsigned long ordenesRecibidas = 0;
int acksPendientes = 0;
unsigned long ultimoEstado = 0;

// Se ejecuta cada vez que llega una orden
void alRecibirMensaje(String &topico, String &mensaje) {
  ordenesRecibidas++;
  Serial.println("Orden #" + String(ordenesRecibidas) + ": " + mensaje);
  acksPendientes++;  // la respuesta se envia en loop()
}

void conectarWiFi() {
  Serial.print("Conectando al Wi-Fi");
  WiFi.begin(WIFI_RED, WIFI_CLAVE, 6);
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println(" listo");
}

void conectarMQTT() {
  Serial.print("Conectando al broker");
  String id = "robot-ucab-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  while (!mqtt.connect(id.c_str())) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println(" listo");
  mqtt.publish(T_CONEXION, "en linea", true, 1);  // aviso de que el robot esta conectado
  mqtt.subscribe(T_ORDENES, 1);                   // escuchar ordenes con QoS 1
}

void setup() {
  Serial.begin(115200);
  conectarWiFi();
  mqtt.begin(BROKER, 1883, red);
  mqtt.setKeepAlive(10);
  // Ultima voluntad: si el robot se cae, el broker avisa "desconectado"
  mqtt.setWill(T_CONEXION, "desconectado", true, 1);
  mqtt.onMessage(alRecibirMensaje);
  conectarMQTT();
  Serial.println("Escribe la letra a en el monitor para enviar una alerta de prueba");
}

void loop() {
  mqtt.loop();
  delay(10);

  // Reconexion automatica
  if (WiFi.status() != WL_CONNECTED) conectarWiFi();
  if (!mqtt.connected()) conectarMQTT();

  // Responder cada orden recibida (QoS 1)
  if (acksPendientes > 0) {
    acksPendientes--;
    mqtt.publish(T_ACK, "{\"recibidas\":" + String(ordenesRecibidas) + "}", false, 1);
  }

  // Enviar estado cada 2 segundos (QoS 0)
  if (millis() - ultimoEstado > 2000) {
    ultimoEstado = millis();
    String estado = "{\"estado\":\"espera\",\"bateria\":100,\"ordenes\":" + String(ordenesRecibidas) + "}";
    mqtt.publish(T_ESTADO, estado, false, 0);
  }

  // Alerta de prueba al escribir "a" (QoS 2)
  if (Serial.available()) {
    char letra = Serial.read();
    if (letra == 'a') {
      mqtt.publish(T_ALERTAS, "{\"tipo\":\"antirrobo\",\"prueba\":true}", false, 2);
      Serial.println("Alerta enviada");
    }
  }
}
