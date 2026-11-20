import 'package:flutter/material.dart';

import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_ui.dart';

/// Texto y color del estado del enlace, para la barra de app y las pastillas.
({String texto, Color color}) estadoEnlace(MqttService s) {
  if (s.simulando) return (texto: 'DEMO', color: CockpitColors.secondary);
  switch (s.conexion) {
    case EstadoConexion.conectado:
      return s.recibiendoDatos
          ? (texto: 'ONLINE', color: CockpitColors.ok)
          : (texto: 'SIN DATOS', color: CockpitColors.warning);
    case EstadoConexion.conectando:
      return (texto: 'CONECTANDO', color: CockpitColors.warning);
    case EstadoConexion.error:
      return (texto: 'ERROR', color: CockpitColors.hazard);
    case EstadoConexion.desconectado:
      return (texto: 'OFFLINE', color: CockpitColors.outline);
  }
}

/// Controles de conexión del Cockpit: selector de broker (HiveMQ / EMQX /
/// Mosquitto) y botón de conexión de 3 estados.
///
/// El Modo Demo **no** se activa desde aquí: tiene un único punto de entrada,
/// el botón "Modo Demo (Offline)" de la pantalla de acceso (Login).
///
/// Es la misma lógica de la pantalla anterior (mismas llamadas a
/// `seleccionarBroker`, `conectar` y `desconectar`); solo cambia el aspecto.
class ConexionControles extends StatelessWidget {
  const ConexionControles({super.key, required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _SelectorBroker(servicio: servicio),
        const SizedBox(height: 10),
        _BotonConexion(servicio: servicio),
      ],
    );
  }
}

/// Selector segmentado de 3 opciones. Se bloquea mientras la conexión está
/// activa o en curso para evitar cambios en caliente.
class _SelectorBroker extends StatelessWidget {
  const _SelectorBroker({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final bool bloqueado =
        servicio.conectado || servicio.conexion == EstadoConexion.conectando;
    return Tooltip(
      message: bloqueado
          ? 'Desconéctate primero para cambiar de broker'
          : 'Selecciona el broker MQTT',
      child: SegmentedButton<int>(
        showSelectedIcon: false,
        segments: List<ButtonSegment<int>>.generate(
          servicio.listaBrokers.length,
          (int i) => ButtonSegment<int>(
            value: i,
            label: Text(
              servicio.listaBrokers[i].nombre.toUpperCase(),
              style: CockpitText.labelMd.copyWith(fontSize: 11),
            ),
          ),
        ),
        selected: <int>{servicio.indiceBroker},
        onSelectionChanged: bloqueado
            ? null
            : (Set<int> seleccion) {
                if (seleccion.isNotEmpty) {
                  servicio.seleccionarBroker(seleccion.first);
                }
              },
      ),
    );
  }
}

/// Botón único de conexión con 3 estados: Conectar / Conectando… / Conectado
/// (con el cursor encima cambia a Desconectar).
class _BotonConexion extends StatefulWidget {
  const _BotonConexion({required this.servicio});

  final MqttService servicio;

  @override
  State<_BotonConexion> createState() => _BotonConexionState();
}

class _BotonConexionState extends State<_BotonConexion> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final EstadoConexion estado = widget.servicio.conexion;
    final bool conectado = estado == EstadoConexion.conectado;
    final bool conectando = estado == EstadoConexion.conectando;

    final Color fondo;
    final Color texto;
    final Widget icono;
    final String etiqueta;
    final VoidCallback? accion;

    if (conectando) {
      fondo = CockpitColors.warning.withValues(alpha: 0.25);
      texto = CockpitColors.warning;
      icono = const SizedBox(
        width: 16,
        height: 16,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          valueColor: AlwaysStoppedAnimation<Color>(CockpitColors.warning),
        ),
      );
      etiqueta = 'CONECTANDO';
      accion = null;
    } else if (conectado) {
      fondo = _hover ? CockpitColors.errorContainer : CockpitColors.ok;
      texto = _hover ? CockpitColors.onErrorContainer : const Color(0xFF003824);
      icono = Icon(_hover ? Icons.link_off : Icons.check_circle, size: 18);
      etiqueta = _hover ? 'DESCONECTAR' : 'CONECTADO';
      accion = widget.servicio.desconectar;
    } else {
      fondo = CockpitColors.primary;
      texto = CockpitColors.onPrimary;
      icono = const Icon(Icons.wifi_tethering, size: 18);
      etiqueta = 'CONECTAR';
      accion = widget.servicio.conectar;
    }

    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: Pressable(
        habilitado: accion != null,
        child: FilledButton.icon(
          onPressed: accion,
          style: FilledButton.styleFrom(
            backgroundColor: fondo,
            foregroundColor: texto,
            disabledBackgroundColor: fondo,
            disabledForegroundColor: texto,
            minimumSize: const Size(0, 48),
          ),
          icon: icono,
          label: FittedBox(fit: BoxFit.scaleDown, child: Text(etiqueta)),
        ),
      ),
    );
  }
}
