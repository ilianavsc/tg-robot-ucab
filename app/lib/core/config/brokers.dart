/// Catálogo de brokers públicos para el respaldo por WebSocket.
///
/// **Importante:** el firmware apunta a HiveMQ (`broker.hivemq.com`). Si la app
/// cae al broker de respaldo, el robot **no** estará ahí: para ver telemetría
/// real, el ESP32 debe publicar en el mismo broker que muestre la app
/// (cambiar `MQTT_BROKER` en `firmware/secrets.h`). El respaldo sirve para que
/// la demo no se quede en pantalla muerta si el broker principal falla.
class BrokerEndpoint {
  const BrokerEndpoint({
    required this.nombre,
    required this.host,
    required this.puertoNativo,
    required this.puertoWeb,
  });

  /// Nombre corto para mostrar en logs.
  final String nombre;

  /// Host TCP/WS.
  final String host;

  /// Puerto TCP plano (Android, iOS, desktop).
  final int puertoNativo;

  /// Puerto WebSocket seguro (Chrome).
  final int puertoWeb;

  /// URL completa que espera `MqttBrowserClient`.
  String get urlWeb => 'wss://$host:$puertoWeb/mqtt';
}

/// Orden de intento: primero el del firmware, después respaldos públicos.
const List<BrokerEndpoint> brokers = <BrokerEndpoint>[
  BrokerEndpoint(
    nombre: 'HiveMQ',
    host: 'broker.hivemq.com',
    puertoNativo: 1883,
    puertoWeb: 8884,
  ),
  BrokerEndpoint(
    nombre: 'EMQX',
    host: 'broker.emqx.io',
    puertoNativo: 1883,
    puertoWeb: 8084,
  ),
  BrokerEndpoint(
    nombre: 'Mosquitto',
    host: 'test.mosquitto.org',
    puertoNativo: 1883,
    puertoWeb: 8081,
  ),
];
