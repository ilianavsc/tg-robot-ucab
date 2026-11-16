import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_browser_client.dart';

/// Cliente web (Chrome): MQTT sobre WebSocket.
///
/// [puerto] es el puerto WS del broker:
///  * `Local`      → `ws://localhost:9001/mqtt` (Mosquitto en esta PC)
///  * `HiveMQ`     → `wss://broker.hivemq.com:8884/mqtt`
///  * `EMQX`       → `ws://broker.emqx.io:8083/mqtt`
///  * `Mosquitto`  → `wss://test.mosquitto.org:8081/mqtt`
///
/// En web NO existe `dart:io`, así que este archivo usa `dart:js_interop` y solo
/// se compila cuando el import condicional lo elige.
///
/// [seguro] decide el esquema: `wss://` con TLS (normal) o `ws://` sin cifrar
/// (local y diagnóstico). El esquema lo pone el catálogo `brokers.dart`, así que
/// agregar un broker nuevo no requiere tocar este archivo.
///
/// [maxIntentos] = 1: la librería falla rápido y `MqttService` decide cuándo
/// cambiar de broker, en lugar de reintentar 3 veces contra el mismo host.
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
  required int maxIntentos,
  required bool seguro,
}) {
  final esquema = seguro ? 'wss' : 'ws';
  return MqttBrowserClient(
    '$esquema://$host:$puerto/mqtt',
    id,
    maxConnectionAttempts: maxIntentos,
  );
}
