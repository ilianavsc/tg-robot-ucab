import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import '../../shared/widgets/pastilla_mqtt.dart';
import '../auth/sesion_local.dart';
import '../telemetria/cockpit_ui.dart';
import 'perfil_admin.dart';

/// Cierra la sesión local y vuelve al Login. Si la sesión usaba el Modo Demo,
/// lo detiene (la telemetría simulada no debe seguir corriendo sin sesión).
void cerrarSesionLocal(BuildContext context) {
  final MqttService servicio = context.read<MqttService>();
  final SesionLocal sesion = context.read<SesionLocal>();
  final NavigatorState navegador = Navigator.of(context);
  if (servicio.simulando) servicio.detenerSimulacion();
  navegador.popUntil((Route<dynamic> r) => r.isFirst);
  sesion.cerrar();
}

/// Tiempo de sesión legible: `42m 05s` o, pasada la hora, `03h 42m`.
String formatoDuracion(Duration d) {
  final int h = d.inHours;
  final int m = d.inMinutes % 60;
  final int s = d.inSeconds % 60;
  String dos(int n) => n.toString().padLeft(2, '0');
  if (h > 0) return '${dos(h)}h ${dos(m)}m';
  return '${dos(m)}m ${dos(s)}s';
}

/// Vista de **Perfil** (Stitch v2). La misma pantalla sirve a los dos roles:
/// el Operador ve su sesión y el enlace; el Administrador añade los parámetros
/// Fail-Safe (solo lectura), la gestión de usuarios (demostración) y la
/// exportación del CSV de P12.
///
/// Todo lo que muestra sale de `SesionLocal`, `MqttService` o de la analítica
/// P12. No hay misiones ni kilómetros porque el robot no los mide.
class PantallaPerfil extends StatefulWidget {
  const PantallaPerfil({super.key});

  @override
  State<PantallaPerfil> createState() => _PantallaPerfilState();
}

class _PantallaPerfilState extends State<PantallaPerfil> {
  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    // Refresca el tiempo de sesión y las métricas.
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _reloj?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final SesionLocal sesion = context.watch<SesionLocal>();
    final MqttService servicio = context.watch<MqttService>();
    final RolUsuario rol = sesion.rol ?? RolUsuario.operador;
    final bool admin = rol == RolUsuario.administrador;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: CockpitColors.surfaceLowest,
        titleSpacing: 0,
        leading: IconButton(
          tooltip: 'Volver',
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          'PERFIL · ${rol.etiqueta}',
          style: CockpitText.labelMd.copyWith(
            fontSize: 14,
            color: CockpitColors.onSurface,
          ),
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            children: <Widget>[
              CabeceraIdentidad(sesion: sesion, rol: rol),
              const SizedBox(height: 16),
              if (admin) ...<Widget>[
                const TarjetaFailSafe(),
                const SizedBox(height: 12),
                const TarjetaGestionUsuarios(),
                const SizedBox(height: 12),
              ],
              TarjetaSesionActual(sesion: sesion, servicio: servicio),
              const SizedBox(height: 12),
              TarjetaEnlaceMqtt(servicio: servicio),
              const SizedBox(height: 16),
              if (admin) ...<Widget>[
                BotonExportarSesion(servicio: servicio),
                const SizedBox(height: 10),
              ],
              OutlinedButton.icon(
                key: const Key('perfil-cerrar'),
                style: OutlinedButton.styleFrom(
                  backgroundColor: CockpitColors.errorContainer.withValues(
                    alpha: 0.28,
                  ),
                  foregroundColor: CockpitColors.error,
                  side: BorderSide(
                    color: CockpitColors.error.withValues(alpha: 0.35),
                  ),
                  minimumSize: const Size.fromHeight(52),
                  textStyle: const TextStyle(
                    fontFamily: CockpitText.sans,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onPressed: () => cerrarSesionLocal(context),
                icon: const Icon(Icons.logout, size: 20),
                label: const Text('Cerrar Sesión'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Avatar (icono, sin foto), rol y correo de la sesión local.
class CabeceraIdentidad extends StatelessWidget {
  const CabeceraIdentidad({super.key, required this.sesion, required this.rol});

  final SesionLocal sesion;
  final RolUsuario rol;

  @override
  Widget build(BuildContext context) {
    final bool admin = rol == RolUsuario.administrador;
    final Color acento = admin ? CockpitColors.warning : CockpitColors.primary;
    return Column(
      children: <Widget>[
        Container(
          width: 84,
          height: 84,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: CockpitColors.surfaceContainer,
            border: Border.all(color: acento.withValues(alpha: 0.7), width: 2),
          ),
          child: Icon(
            admin
                ? Icons.admin_panel_settings_outlined
                : Icons.engineering_outlined,
            size: 40,
            color: acento,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: acento.withValues(alpha: 0.14),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: acento.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(
                admin ? Icons.key : Icons.badge_outlined,
                size: 14,
                color: acento,
              ),
              const SizedBox(width: 6),
              Text(
                rol.etiqueta,
                key: const Key('perfil-rol'),
                style: CockpitText.labelMd.copyWith(color: acento),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Text(
          rol.nombre,
          style: CockpitText.headlineMd.copyWith(
            fontSize: 22,
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          sesion.correo.isEmpty ? '--' : sesion.correo,
          key: const Key('perfil-correo'),
          style: CockpitText.bodyMd.copyWith(
            color: CockpitColors.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'Cuenta local de demostración · sin servidor',
          style: CockpitText.bodySm.copyWith(color: CockpitColors.outline),
        ),
      ],
    );
  }
}

/// Tiempo de sesión y contadores reales de la analítica P12.
class TarjetaSesionActual extends StatelessWidget {
  const TarjetaSesionActual({
    super.key,
    required this.sesion,
    required this.servicio,
  });

  final SesionLocal sesion;
  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final a = servicio.analitica;
    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.query_stats,
            etiqueta: 'Sesión actual',
            trailing: StatusPill(
              texto: sesion.demo || servicio.simulando ? 'Modo Demo' : 'Activa',
              color: sesion.demo || servicio.simulando
                  ? CockpitColors.secondary
                  : CockpitColors.ok,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              Expanded(
                child: CockpitCell(
                  key: const Key('perfil-tiempo'),
                  etiqueta: 'Tiempo',
                  valor: formatoDuracion(sesion.duracion()),
                  tamano: 18,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  key: const Key('perfil-paquetes'),
                  etiqueta: 'Paquetes',
                  valor: '${a.totalPaquetes}',
                  color: CockpitColors.primary,
                  tamano: 18,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  key: const Key('perfil-paradas'),
                  etiqueta: 'Paradas',
                  valor: '${a.paradasEmergencia}',
                  color: a.paradasEmergencia > 0
                      ? CockpitColors.error
                      : CockpitColors.onSurface,
                  tamano: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Paquetes y paradas de emergencia vienen de la analítica P12 de la '
            'sesión de telemetría.',
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Estado real del enlace MQTT (`--` si no hay dato).
class TarjetaEnlaceMqtt extends StatelessWidget {
  const TarjetaEnlaceMqtt({super.key, required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final Duration? latencia = servicio.ultimoAck?.latencia;
    final String destino = servicio.simulando
        ? 'Local (demo)'
        : servicio.conectado
        ? '${servicio.host}:${servicio.puertoEfectivo}'
        : '--';
    return CockpitCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const SectionLabel(
            icono: Icons.hub_outlined,
            etiqueta: 'Enlace MQTT',
          ),
          const SizedBox(height: 12),
          const Align(alignment: Alignment.centerLeft, child: PastillaMqtt()),
          const SizedBox(height: 10),
          DatoPerfil(
            apilado: true,
            etiqueta: 'Broker',
            valor: destino,
            clave: const Key('perfil-broker'),
          ),
          const SizedBox(height: 4),
          DatoPerfil(
            etiqueta: 'Latencia del último ACK',
            valor: latencia == null ? '--' : '${latencia.inMilliseconds} ms',
            clave: const Key('perfil-latencia'),
          ),
        ],
      ),
    );
  }
}

/// Fila etiqueta/valor del Perfil. Con [apilado] el valor va debajo de la
/// etiqueta, a todo el ancho y con salto de línea (hosts largos como
/// `broker.hivemq.com:1883`); si no, va a la derecha en una sola línea.
class DatoPerfil extends StatelessWidget {
  const DatoPerfil({
    super.key,
    required this.etiqueta,
    required this.valor,
    this.clave,
    this.apilado = false,
  });

  final String etiqueta;
  final String valor;
  final Key? clave;
  final bool apilado;

  @override
  Widget build(BuildContext context) {
    final TextStyle estiloEtiqueta = CockpitText.bodySm.copyWith(
      color: CockpitColors.onSurfaceVariant,
    );
    final TextStyle estiloValor = CockpitText.telemetryMd.copyWith(
      color: CockpitColors.onSurface,
      fontFeatures: CockpitText.tabular,
    );
    if (apilado) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(etiqueta, style: estiloEtiqueta),
          const SizedBox(height: 2),
          Text(valor, key: clave, softWrap: true, style: estiloValor),
        ],
      );
    }
    return Row(
      children: <Widget>[
        Expanded(child: Text(etiqueta, style: estiloEtiqueta)),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            valor,
            key: clave,
            textAlign: TextAlign.right,
            softWrap: true,
            style: estiloValor,
          ),
        ),
      ],
    );
  }
}
