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
    this.seguroWeb = true,
  });

  /// Nombre corto para mostrar en logs.
  final String nombre;

  /// Host TCP/WS.
  final String host;

  /// Puerto TCP plano (Android, iOS, desktop).
  final int puertoNativo;

  /// Puerto WebSocket (Chrome).
  final int puertoWeb;

  /// `true` = `wss://` (TLS), `false` = `ws://` (sin cifrar, solo diagnóstico).
  final bool seguroWeb;

  /// Esquema del WebSocket según el broker.
  String get esquemaWeb => seguroWeb ? 'wss' : 'ws';

  /// URL completa que espera `MqttBrowserClient`.
  String get urlWeb => '$esquemaWeb://$host:$puertoWeb/mqtt';
}

/// Orden de intento: primero el del firmware, después respaldos públicos.
const List<BrokerEndpoint> brokers = <BrokerEndpoint>[
  BrokerEndpoint(
    nombre: 'HiveMQ',
    host: 'broker.hivemq.com',
    puertoNativo: 1883,
    puertoWeb: 8884,
  ),
  // Prueba temporal: la red local bloquea WSS, así que se usa el WebSocket
  // SIN cifrar de EMQX (8083). Si la red también bloquea este puerto, el
  // problema es de egress y no del TLS.
  BrokerEndpoint(
    nombre: 'EMQX',
    host: 'broker.emqx.io',
    puertoNativo: 1883,
    puertoWeb: 8083,
    seguroWeb: false,
  ),
  BrokerEndpoint(
    nombre: 'Mosquitto',
    host: 'test.mosquitto.org',
    puertoNativo: 1883,
    puertoWeb: 8081,
  ),
];
