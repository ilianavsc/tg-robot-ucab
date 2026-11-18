# robot_ucab_app

App móvil (Flutter) del robot de laboratorio UCAB: telemetría, pedidos y alertas por MQTT.

## Estructura

```
lib/
  main.dart                    # ChangeNotifierProvider + MaterialApp
  core/
    config/                    # configuración (broker, tópicos)
    models/                    # estado, ultrasonido (frente_ok/atras_ok), orden_ack
    alertas/centro_alertas.dart    # P11: motor de alertas (Dart puro, con tests)
    analitica/analitica_sesion.dart # P12: métricas de sesión + CSV (Dart puro)
    exportar/descarga_csv*.dart    # descarga del CSV en Web (portapapeles en nativo)
    mqtt/mqtt_service.dart     # cliente MQTT + reconexión + Modo Demo + P11/P12
    mqtt/mqtt_client_platform_*.dart  # fábrica por plataforma (TCP vs WebSocket)
    theme/
  features/
    telemetria/                # pantalla de telemetría en vivo
      alertas_p11.dart         # Banner de Alerta Activa + Centro de Alertas (P11)
      analitica_p12.dart       # Analítica de Sesión + "Exportar Reporte CSV" (P12)
    pedidos/                   # (Fase V) crear pedidos y ver ACK
    alertas/                   # (Fase V) notificaciones push de alertas QoS 2
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

## Pruebas y análisis

```bash
flutter analyze
flutter test        # P11 (alertas), P12 (analítica/CSV), modelos y Modo Demo
```

## P11 · Centro de Alertas y P12 · Analítica

- **P11** deduce en tiempo real (MQTT/P10 y Modo Demo): parada por obstáculo
  (`frente_cm < 20`), fallo de sensor sin eco (`frente_ok:false`), proximidad
  (20–50 cm) y batería crítica (≤ 10,3 V, ignorando 0,00 V). También escucha
  `ucab-tg-sf/robot/alertas` (QoS 2). Banner rojo/ámbar con "Reconocer".
- **P12** acumula velocidad media/máxima, distancia frontal mínima válida, error
  medio absoluto de línea, paquetes y paradas de emergencia. Se reinicia al
  detener el demo o con "Reiniciar". "Exportar Reporte CSV" descarga el archivo.

## Probar la conexión sin Flutter

```bash
dart run tool/telemetria_pc.dart --simular --seg=15
```
