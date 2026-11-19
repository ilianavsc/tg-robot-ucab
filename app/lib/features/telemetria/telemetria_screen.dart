import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/estado.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import '../perfil/pantalla_perfil.dart';
import 'alertas_p11.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';
import 'conexion_cockpit.dart';
import 'pantalla_alertas.dart';
import 'pantalla_controles.dart';
import 'pantalla_dashboard.dart';
import 'pantalla_radar.dart';

/// Pantalla principal de la app (P09) con el sistema de diseño
/// **Autonomous Laboratory Cockpit**: barra de app con estado y batería,
/// 4 secciones con barra de navegación inferior (Dashboard, Controles, Radar y
/// Alertas) y un botón E-STOP siempre a mano.
///
/// Es solo la capa visual: toda la lógica (MQTT, Modo Demo, órdenes, alertas
/// P11 y analítica P12) sigue en `MqttService` y en `core/`.
class TelemetriaScreen extends StatefulWidget {
  const TelemetriaScreen({super.key});

  /// Ancho máximo del contenido en pantallas grandes.
  static const double anchoMaximo = 960;

  @override
  State<TelemetriaScreen> createState() => _TelemetriaScreenState();
}

class _Seccion {
  const _Seccion(this.nombre, this.icono, this.iconoActivo);

  final String nombre;
  final IconData icono;
  final IconData iconoActivo;
}

const List<_Seccion> _secciones = <_Seccion>[
  _Seccion('DASHBOARD', Icons.speed_outlined, Icons.speed),
  _Seccion('CONTROLES', Icons.gamepad_outlined, Icons.gamepad),
  _Seccion('RADAR', Icons.radar_outlined, Icons.radar),
  _Seccion('ALERTAS', Icons.notifications_outlined, Icons.notifications),
];

class _TelemetriaScreenState extends State<TelemetriaScreen> {
  int _indice = 0;
  Timer? _reloj;

  @override
  void initState() {
    super.initState();
    // Reevalúa la frescura de los datos ("hace X s", sensores sin señal).
    _reloj = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _reloj?.cancel();
    super.dispose();
  }

  Widget _cuerpo() {
    switch (_indice) {
      case 0:
        return const PantallaDashboard(key: ValueKey<int>(0));
      case 1:
        return const PantallaControles(key: ValueKey<int>(1));
      case 2:
        return const PantallaRadar(key: ValueKey<int>(2));
      default:
        return const PantallaAlertas(key: ValueKey<int>(3));
    }
  }

  void _abrirConexion() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext contextoHoja) {
        final MqttService s = contextoHoja.watch<MqttService>();
        final enlace = estadoEnlace(s);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                SectionLabel(
                  icono: Icons.hub_outlined,
                  etiqueta: 'Conexión MQTT',
                  trailing: StatusPill(
                    texto: enlace.texto,
                    color: enlace.color,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  s.simulando
                      ? 'Simulación local: sin red ni broker.'
                      : '${s.host}:${s.puertoEfectivo} · ${s.topicoEstado}',
                  style: CockpitText.telemetrySm.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 14),
                ConexionControles(servicio: s),
              ],
            ),
          ),
        );
      },
    );
  }

  /// Abre el Perfil (Operador o Administrador, según la sesión local).
  void _abrirPerfil() {
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => const PantallaPerfil()));
  }

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final int pendientes = servicio.centroAlertas.pendientes;

    return Scaffold(
      appBar: CockpitAppBar(
        servicio: servicio,
        seccion: _secciones[_indice].nombre,
        alAjustes: _abrirConexion,
        alPerfil: _abrirPerfil,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            maxWidth: TelemetriaScreen.anchoMaximo,
          ),
          child: Column(
            children: <Widget>[
              if (servicio.simulando) const _FranjaDemo(),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: BannerAlertaActiva(),
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: MediaQuery.of(context).disableAnimations
                      ? Duration.zero
                      : const Duration(milliseconds: 220),
                  switchInCurve: Curves.easeOutCubic,
                  transitionBuilder: (Widget hijo, Animation<double> anim) =>
                      FadeTransition(opacity: anim, child: hijo),
                  child: _cuerpo(),
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: EstopButton(
        alPulsar: () => enviarOrden(context, servicio, 'frenar'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: CockpitColors.surfaceLowest,
          border: Border(top: BorderSide(color: CockpitColors.outlineVariant)),
        ),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: TelemetriaScreen.anchoMaximo,
            ),
            child: NavigationBar(
              selectedIndex: _indice,
              onDestinationSelected: (int i) => setState(() => _indice = i),
              destinations: <Widget>[
                for (int i = 0; i < _secciones.length; i++)
                  NavigationDestination(
                    icon: _icono(_secciones[i].icono, i == 3 ? pendientes : 0),
                    selectedIcon: _icono(
                      _secciones[i].iconoActivo,
                      i == 3 ? pendientes : 0,
                    ),
                    label: _secciones[i].nombre,
                    tooltip: '',
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Icono de la barra; en Alertas lleva el contador de alertas sin reconocer.
  Widget _icono(IconData icono, int contador) {
    if (contador <= 0) return Icon(icono);
    return Badge(
      label: Text('$contador'),
      backgroundColor: CockpitColors.error,
      textColor: const Color(0xFF690005),
      textStyle: CockpitText.telemetrySm.copyWith(fontWeight: FontWeight.w700),
      child: Icon(icono),
    );
  }
}

/// Barra superior: marca, estado del enlace, batería y acceso a la conexión.
class CockpitAppBar extends StatelessWidget implements PreferredSizeWidget {
  const CockpitAppBar({
    super.key,
    required this.servicio,
    required this.seccion,
    required this.alAjustes,
    this.alPerfil,
  });

  final MqttService servicio;
  final String seccion;
  final VoidCallback alAjustes;

  /// Abre el Perfil; si es `null` el botón no se muestra.
  final VoidCallback? alPerfil;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final enlace = estadoEnlace(servicio);
    final Estado? e = servicio.ultimoEstado;
    final bool sinSenal = estadoSinSenal(e);

    return Material(
      color: CockpitColors.surfaceLowest,
      child: SafeArea(
        bottom: false,
        child: SizedBox(
          height: 64,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: TelemetriaScreen.anchoMaximo,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: CockpitColors.primaryTonal,
                        borderRadius: BorderRadius.circular(CockpitRadius.lg),
                        border: Border.all(
                          color: CockpitColors.primary.withValues(alpha: 0.5),
                        ),
                      ),
                      child: const Icon(
                        Icons.smart_toy_outlined,
                        size: 20,
                        color: CockpitColors.primary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          const Text(
                            'TG ROBOT UCAB',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: CockpitText.sans,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: <Widget>[
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: enlace.color,
                                  shape: BoxShape.circle,
                                  boxShadow: <BoxShadow>[
                                    BoxShadow(
                                      color: enlace.color.withValues(
                                        alpha: 0.6,
                                      ),
                                      blurRadius: 5,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  '${enlace.texto} · $seccion',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: CockpitText.telemetrySm.copyWith(
                                    color: CockpitColors.onSurfaceVariant,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    _PildoraBateria(estado: sinSenal ? null : e),
                    const SizedBox(width: 6),
                    _BotonBarra(
                      etiqueta: 'Conexión y broker MQTT',
                      icono: Icons.tune,
                      alPulsar: alAjustes,
                    ),
                    if (alPerfil != null) ...<Widget>[
                      const SizedBox(width: 6),
                      _BotonBarra(
                        etiqueta: 'Perfil',
                        icono: Icons.person_outline,
                        alPulsar: alPerfil!,
                        clave: const Key('boton-perfil'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Botón cuadrado de 44 px de la barra superior (conexión y perfil).
class _BotonBarra extends StatelessWidget {
  const _BotonBarra({
    required this.etiqueta,
    required this.icono,
    required this.alPulsar,
    this.clave,
  });

  final String etiqueta;
  final IconData icono;
  final VoidCallback alPulsar;
  final Key? clave;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: etiqueta,
      child: Material(
        color: CockpitColors.surfaceHigh,
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        child: InkWell(
          key: clave,
          borderRadius: BorderRadius.circular(CockpitRadius.lg),
          onTap: alPulsar,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Icon(icono, color: CockpitColors.onSurface),
          ),
        ),
      ),
    );
  }
}

/// Pastilla de batería de la barra superior (`94 %`).
class _PildoraBateria extends StatelessWidget {
  const _PildoraBateria({required this.estado});

  final Estado? estado;

  @override
  Widget build(BuildContext context) {
    final Estado? e = estado;
    final NivelBateria nivel = nivelBateria(e);
    final Color color = e == null
        ? CockpitColors.outline
        : (nivel == NivelBateria.corte ||
                  nivel == NivelBateria.aviso ||
                  e.bateriaBaja
              ? CockpitColors.hazard
              : (e.bateria <= 40 ? CockpitColors.warning : CockpitColors.ok));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            e == null ? Icons.battery_unknown : Icons.battery_charging_full,
            size: 16,
            color: color,
          ),
          const SizedBox(width: 4),
          Text(
            e == null ? '—' : '${e.bateria}%',
            style: CockpitText.labelMd.copyWith(
              color: CockpitColors.onSurface,
              fontFeatures: CockpitText.tabular,
            ),
          ),
        ],
      ),
    );
  }
}

/// Franja visible mientras el Modo Demo está activo, para no confundir los
/// datos simulados con telemetría real.
class _FranjaDemo extends StatelessWidget {
  const _FranjaDemo();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: CockpitColors.secondaryContainer.withValues(alpha: 0.22),
      child: Row(
        children: <Widget>[
          const Icon(
            Icons.science_outlined,
            size: 16,
            color: CockpitColors.secondary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'MODO DEMO · datos simulados, sin red ni robot',
              style: CockpitText.telemetrySm.copyWith(
                color: CockpitColors.secondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
