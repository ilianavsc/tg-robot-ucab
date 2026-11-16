import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_browser_client.dart';

/// Cliente web (Chrome): MQTT sobre WebSocket seguro.
///
/// HiveMQ expone el WebSocket en `wss://broker.hivemq.com:8884/mqtt`.
/// En web NO existe `dart:io`, así que este archivo usa `dart:js_interop`
/// (ya resuelto por `mqtt_browser_client.dart`) y se compila solo cuando
/// el import condicional lo selecciona.
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
}) {
  return MqttBrowserClient('wss://$host:$puerto/mqtt', id);
}
