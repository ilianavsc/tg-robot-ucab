import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_browser_client.dart';

/// Cliente web (Chrome): MQTT sobre WebSocket seguro.
///
/// [puerto] es el puerto WS del broker (HiveMQ 8884, EMQX 8084,
/// Mosquitto 8081). En web NO existe `dart:io`, así que este archivo usa
/// `dart:js_interop` y solo se compila cuando el import condicional lo elige.
///
/// [maxIntentos] = 1: la librería falla rápido y `MqttService` decide cuándo
/// cambiar de broker, en lugar de reintentar 3 veces contra el mismo host.
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
  required int maxIntentos,
}) {
  return MqttBrowserClient(
    'wss://$host:$puerto/mqtt',
    id,
    maxConnectionAttempts: maxIntentos,
  );
}
