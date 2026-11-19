# robot_ucab_app

App móvil (Flutter) del robot de laboratorio UCAB: telemetría, pedidos y alertas por MQTT.

## Diseño: Autonomous Laboratory Cockpit

La interfaz sigue el sistema de diseño de [`DESIGN.md`](DESIGN.md) (generado en
Google Stitch): modo oscuro, **Inter** para texto y **JetBrains Mono** para toda la
telemetría. Las fuentes van incrustadas en `assets/fonts/` (subconjunto Latin,
licencias OFL incluidas), así que el Modo Demo se ve igual sin internet.

- 4 secciones con barra de navegación inferior: **Dashboard**, **Controles**,
  **Radar** y **Alertas**, más un botón **Freno Remoto** siempre visible.
- Es solo la capa visual: MQTT, Modo Demo, órdenes, alertas (P11) y analítica
  (P12) siguen en `lib/core/` sin cambios.
- Lo que el robot no mide no se inventa: las RPM y la tensión de cada celda se
  muestran como **estimadas** (`≈`), y no hay cámara ni sensores laterales.
- **Freno Remoto** envía `frenar` por MQTT (un toque, sin confirmar, para no retrasar
  la parada). No es un corte eléctrico: no sustituye el interruptor físico.

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
    demo/simulacion_pista.dart # Modo Demo físico: robot sobre un circuito (PID, batería 3S, obstáculo, órdenes)
    mqtt/mqtt_service.dart     # cliente MQTT + reconexión + Modo Demo + P11/P12
    mqtt/mqtt_client_platform_*.dart  # fábrica por plataforma (TCP vs WebSocket)
    theme/cockpit_theme.dart   # tokens de color, tipografía y ThemeData del Cockpit
  features/
    auth/
      sesion_local.dart        # sesión local (mock, sin backend): rol, usuario y nombre
      registro_usuarios.dart   # RBAC local en memoria: usuario/usuario, admin/admin y operadores creados
      pantalla_login.dart      # Login (Stitch v2): usuario/contraseña, acceso rápido, Modo Demo (Offline)
    perfil/
      pantalla_perfil.dart     # Perfil (Operador/Admin): sesión, enlace MQTT, cerrar sesión
      perfil_admin.dart        # solo Admin: Fail-Safe (solo lectura), acceso a usuarios, CSV de P12
      gestion_usuarios.dart    # solo Admin: crear y eliminar Operadores (en memoria, sin backend)
    telemetria/
      telemetria_screen.dart   # armazón: app bar, 4 secciones, Freno Remoto
      mapa_pista.dart          # Mapa de Pista: circuito, cono del ultrasonido, misión, destinos y pausa
      pantalla_dashboard.dart  # Mapa de Pista + estado, enlace MQTT, energía 3S, IR, motores, P12
      pantalla_controles.dart  # matriz táctil, Auto, ACK, núcleo de seguridad
      pantalla_radar.dart      # radar polar (radar_hud.dart) y evitación
      pantalla_alertas.dart    # watchdog, activas y registro de eventos (P11)
      alertas_p11.dart         # Banner de Alerta Activa (P11)
      analitica_p12.dart       # Analítica de Sesión + "Exportar Reporte CSV" (P12)
      cockpit_ui.dart          # tarjeta, celda, pastilla, Freno Remoto y demás primitivas
      cockpit_datos.dart       # cálculos derivados (Dart puro, con tests)
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
flutter test        # P11, P12, modelos, Modo Demo, interfaz Cockpit (4 pantallas) y Login/Perfiles
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
