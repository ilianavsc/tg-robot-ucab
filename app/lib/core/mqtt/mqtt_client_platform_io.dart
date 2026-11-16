import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

/// Cliente nativo (Android, iOS, Windows, macOS, Linux): TCP plano.
///
/// [seguro] no aplica en nativo (el TCP no negocia esquema), se acepta para
/// mantener la misma firma que la fábrica web.
///
/// [maxIntentos] se limita a 1 porque la reconexión la controla `MqttService`;
/// dejar que la librería reintente por dentro produce tormentas de conexión.
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
  required int maxIntentos,
  required bool seguro,
}) {
  return MqttServerClient.withPort(
    host,
    id,
    puerto,
    maxConnectionAttempts: maxIntentos,
  );
}
