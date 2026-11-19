import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:provider/single_child_widget.dart';

import 'core/mqtt/mqtt_service.dart';
import 'core/theme/cockpit_theme.dart';
import 'features/auth/pantalla_login.dart';
import 'features/auth/registro_usuarios.dart';
import 'features/auth/sesion_local.dart';
import 'features/telemetria/telemetria_screen.dart';

/// Punto de entrada de la app.
///
/// `MqttService` se crea una sola vez y vive en el árbol: cualquier pantalla
/// puede escucharlo con `context.watch<MqttService>()`. El `..conectar()` del
/// cascade dispara la conexión al abrir la app; no bloquea el arranque porque
/// internamente es asíncrono y no lanza excepciones.
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AppRobotUcab());
}

class AppRobotUcab extends StatelessWidget {
  const AppRobotUcab({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: <SingleChildWidget>[
        ChangeNotifierProvider<MqttService>(
          create: (_) => MqttService()..conectar(),
        ),
        // Autenticación local (mock, sin backend): rol de la sesión.
        ChangeNotifierProvider<SesionLocal>(create: (_) => SesionLocal()),
        ChangeNotifierProvider<RegistroUsuarios>(
          create: (_) => RegistroUsuarios(),
        ),
      ],
      child: MaterialApp(
        title: 'TG Robot UCAB',
        debugShowCheckedModeBanner: false,
        // Sistema de diseño "Autonomous Laboratory Cockpit" (DESIGN.md):
        // es un cockpit oscuro, así que se fuerza el modo oscuro.
        theme: buildCockpitTheme(),
        darkTheme: buildCockpitTheme(),
        themeMode: ThemeMode.dark,
        home: const PuertaAcceso(),
      ),
    );
  }
}

/// Muestra el Login mientras no haya sesión local y la telemetría cuando la
/// hay. Cerrar sesión (`SesionLocal.cerrar`) devuelve al Login.
class PuertaAcceso extends StatelessWidget {
  const PuertaAcceso({super.key});

  @override
  Widget build(BuildContext context) {
    final bool activa = context.select<SesionLocal, bool>((s) => s.activa);
    return activa ? const TelemetriaScreen() : const PantallaLogin();
  }
}
