import 'package:mqtt_client/mqtt_client.dart';

/// Fábrica por defecto: solo se compila si no aplica ni `dart.library.io` ni
/// `dart.library.js_interop` (no debería pasar nunca en esta app).
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
  required int maxIntentos,
}) {
  throw UnsupportedError('Plataforma sin soporte MQTT');
}
