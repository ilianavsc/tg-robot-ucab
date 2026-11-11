// P01 MQTT base, version 2.1 - Trabajo de Grado Robot UCAB
// Iliana Semprun y Andrea Ferrer
//
// Que hace:
//  1. Se conecta al Wi-Fi y al broker MQTT.
//  2. Avisa "en linea" y deja una ultima voluntad: si se cae, el broker avisa "desconectado".
//  3. Cada 2 segundos envia su estado (QoS 0).
//  4. Recibe pedidos (QoS 1) y responde con el numero del pedido (QoS 1).
//  5. Al escribir la letra a en el monitor, envia una alarma de prueba (QoS 2).

#include <WiFi.h>
#include <MQTT.h>

// ---------- 1. Red y broker ----------
const char* WIFI_RED   = "Wokwi-GUEST";
const char* WIFI_CLAVE = "";
const char* BROKER     = "broker.hivemq.com";

// ---------- 2. Topicos (buzones) ----------
const char* T_ESTADO   = "ucab-tg-sf/robot/estado";
const char* T_ORDENES  = "ucab-tg-sf/robot/ordenes";
const char* T_ACK      = "ucab-tg-sf/robot/ordenes/ack";
const char* T_ALERTAS  = "ucab-tg-sf/robot/alertas";
const char* T_CONEXION = "ucab-tg-sf/robot/conexion";

WiFiClient red;
MQTTClient mqtt(512);

// ---------- 3. Variables ----------
unsigned long ordenesRecibidas = 0;   // cuantos pedidos han llegado
unsigned long numeroEstado = 0;       // contador de mensajes de estado
unsigned long numeroAlarma = 0;       // contador de alarmas enviadas
unsigned long ultimoEstado = 0;       // cuando se envio el ultimo estado
const int MAX_PENDIENTES = 60;
String idsPendientes[MAX_PENDIENTES]; // pedidos que faltan por confirmar
int cantidadPendientes = 0;

// Saca el valor de "id" de un pedido como {"id":"P-0007",...}
String leerId(const String &pedido) {
  int inicio = pedido.indexOf("\"id\":\"");
  if (inicio < 0) return "sin-id";
  inicio += 6;
  int fin = pedido.indexOf("\"", inicio);
  if (fin < 0) return "sin-id";
  return pedido.substring(inicio, fin);
}

// ---------- 4. Al recibir un pedido ----------
void alRecibirMensaje(String &topico, String &mensaje) {
  ordenesRecibidas++;
  String id = leerId(mensaje);
  Serial.println("Pedido #" + String(ordenesRecibidas) + " (" + id + "): " + mensaje);
  if (cantidadPendientes < MAX_PENDIENTES) {
    idsPendientes[cantidadPendientes] = id;   // se confirma en loop(), no aqui
    cantidadPendientes++;
  }
}

// ---------- 5. Conexiones ----------
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
  String idCliente = "robot-ucab-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  while (!mqtt.connect(idCliente.c_str())) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println(" listo");
  mqtt.publish(T_CONEXION, "en linea", true, 1);  // retenido: quien llegue despues lo ve
  mqtt.subscribe(T_ORDENES, 1);                   // escuchar pedidos con QoS 1
}

void setup() {
  Serial.begin(115200);
  conectarWiFi();
  mqtt.begin(BROKER, 1883, red);
  // keepAlive 15 s, sesion persistente (el broker guarda los pedidos si el robot se cae)
  // y espera hasta 10 s las respuestas del broker antes de cortar (red lenta con VPN)
  mqtt.setOptions(15, false, 10000);
  mqtt.setWill(T_CONEXION, "desconectado", true, 1);  // ultima voluntad (LWT)
  mqtt.onMessage(alRecibirMensaje);
  conectarMQTT();
  Serial.println("Listo. Escribe la letra a en el monitor para enviar una alarma de prueba.");
}

// ---------- 6. Ciclo principal ----------
void loop() {
  mqtt.loop();
  delay(10);

  // Reconexion automatica
  if (WiFi.status() != WL_CONNECTED) conectarWiFi();
  if (!mqtt.connected()) conectarMQTT();

  // Confirmar un pedido pendiente por vuelta (QoS 1)
  if (cantidadPendientes > 0) {
    String id = idsPendientes[0];
    for (int i = 1; i < cantidadPendientes; i++) idsPendientes[i - 1] = idsPendientes[i];
    cantidadPendientes--;
    String ack = "{\"id\":\"" + id + "\",\"recibidas\":" + String(ordenesRecibidas) + ",\"t\":" + String(millis()) + "}";
    mqtt.publish(T_ACK, ack, false, 1);
  }

  // Estado cada 2 segundos (QoS 0)
  if (millis() - ultimoEstado > 2000) {
    ultimoEstado = millis();
    numeroEstado++;
    String estado = "{\"n\":" + String(numeroEstado) + ",\"estado\":\"espera\",\"bateria\":100,\"ordenes\":" + String(ordenesRecibidas) + ",\"t\":" + String(millis()) + "}";
    mqtt.publish(T_ESTADO, estado, false, 0);
  }

  // Alarma de prueba al escribir "a" (QoS 2)
  if (Serial.available()) {
    char letra = Serial.read();
    if (letra == 'a') {
      numeroAlarma++;
      String alarma = "{\"n\":" + String(numeroAlarma) + ",\"tipo\":\"antirrobo\",\"prueba\":true,\"t\":" + String(millis()) + "}";
      mqtt.publish(T_ALERTAS, alarma, false, 2);
      Serial.println("Alarma #" + String(numeroAlarma) + " enviada");
    }
  }
}
