import 'package:mqtt_client/mqtt_browser_client.dart';
import 'package:mqtt_client/mqtt_client.dart';

/// Cliente web (Chrome / Navegadores móviles): MQTT sobre WebSocket.
///
/// Configuración específica para compatibilidad móvil y HTTPS:
///  * Esquema `wss://` con ruta `/mqtt`
///  * Puerto asignado por separado en [cliente.port]
///  * Subprotocolo configurado en [MqttClientConstants.protocolsSingleDefault] ('mqtt')
///
/// [puerto] es el puerto WS del broker:
///  * `HiveMQ`     → `wss://broker.hivemq.com:8884/mqtt`
///  * `EMQX`       → `wss://broker.emqx.io:8084/mqtt`
///  * `Mosquitto`  → `wss://test.mosquitto.org:8081/mqtt`
///  * `Local`      → `ws://localhost:9001/mqtt` (Mosquitto en PC local)
MqttClient crearClienteMqtt({
  required String host,
  required int puerto,
  required String id,
  required int maxIntentos,
  required bool seguro,
}) {
  final esquema = seguro ? 'wss' : 'ws';
  final cliente = MqttBrowserClient(
    '$esquema://$host/mqtt',
    id,
    maxConnectionAttempts: maxIntentos,
  );
  cliente.port = puerto;
  cliente.websocketProtocols = MqttClientConstants.protocolsSingleDefault;
  return cliente;
}
