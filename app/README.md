# robot_ucab_app

App móvil (Flutter) del robot de laboratorio UCAB: telemetría, pedidos y alertas por MQTT.

## Estructura

```
lib/
  main.dart                    # ChangeNotifierProvider + MaterialApp
  core/
    config/                    # configuración (broker, tópicos)
    models/estado.dart         # modelo de la telemetría (JSON del firmware)
    mqtt/mqtt_service.dart     # cliente MQTT + reconexión automática
    mqtt/mqtt_client_platform_*.dart  # fábrica por plataforma (TCP vs WebSocket)
    theme/
  features/
    telemetria/                # pantalla de telemetría en vivo
    pedidos/                   # (Fase V) crear pedidos y ver ACK
    alertas/                   # (Fase V) historial de alertas QoS 2
    conexion/                  # (Fase V) estado del broker
  shared/widgets/
tool/telemetria_pc.dart        # diagnóstico MQTT por consola (sin Flutter)
```

## Correr en Chrome (demo)

```bash
flutter run -d chrome
```

El cliente web se conecta por WebSocket seguro a `wss://broker.hivemq.com:8884/mqtt`.
En nativo (Android/Windows) se conecta por TCP a `broker.hivemq.com:1883`.

## Probar la conexión sin Flutter

```bash
dart run tool/telemetria_pc.dart --simular --seg=15
```
