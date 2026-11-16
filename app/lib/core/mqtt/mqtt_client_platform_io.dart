import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

/// Cliente nativo (Android, iOS, Windows, macOS, Linux): TCP plano.
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
}) {
  return MqttServerClient.withPort(host, id, puerto);
}
