import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/mqtt/mqtt_service.dart';
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
    return ChangeNotifierProvider<MqttService>(
      create: (_) => MqttService()..conectar(),
      child: MaterialApp(
        title: 'Robot UCAB',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: const Color(0xFF0F9D84)),
        home: const TelemetriaScreen(),
      ),
    );
  }
}
