import 'package:flutter/material.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import '../auth/sesion_local.dart';
import '../telemetria/analitica_p12.dart';
import '../telemetria/cockpit_ui.dart';

String _cm(double v) => v.toStringAsFixed(0);

/// **Parámetros Fail-Safe** — estrictamente de solo lectura.
///
/// Los umbrales salen de `CentroAlertas` (los mismos del firmware: parada
/// < 20 cm y aviso hasta 50 cm). No hay interruptores, campos ni botones de
/// edición ni de anulación: la app solo informa lo que hace el robot.
class TarjetaFailSafe extends StatelessWidget {
  const TarjetaFailSafe({super.key});

  @override
  Widget build(BuildContext context) {
    final String parada = '< ${_cm(CentroAlertas.umbralParadaCm)} cm';
    final String aviso =
        '${_cm(CentroAlertas.umbralParadaCm)}–${_cm(CentroAlertas.umbralAvisoCm)} cm';
    return Semantics(
      label:
          'Parámetros Fail-Safe, solo lectura. Parada crítica frontal $parada. '
          'Zona de precaución $aviso.',
      container: true,
      child: CockpitCard(
        key: const Key('perfil-failsafe'),
        child: ExcludeSemantics(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: CockpitColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(CockpitRadius.lg),
                    ),
                    child: const Icon(
                      Icons.lock_outline,
                      size: 22,
                      color: CockpitColors.warning,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'Parámetros Fail-Safe',
                          style: CockpitText.titleMd.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'Solo lectura · definidos en el firmware',
                          style: CockpitText.telemetrySm.copyWith(
                            color: CockpitColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _FilaFailSafe(
                titulo: 'Parada crítica frontal',
                detalle: 'Frenado automático del firmware',
                valor: parada,
                fondo: CockpitColors.errorContainer.withValues(alpha: 0.55),
                color: CockpitColors.error,
                clave: const Key('failsafe-parada'),
              ),
              const SizedBox(height: 8),
              _FilaFailSafe(
                titulo: 'Zona de precaución',
                detalle: 'Aviso al operador (alerta P11)',
                valor: aviso,
                fondo: CockpitColors.primaryTonal.withValues(alpha: 0.55),
                color: CockpitColors.primary,
                clave: const Key('failsafe-precaucion'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilaFailSafe extends StatelessWidget {
  const _FilaFailSafe({
    required this.titulo,
    required this.detalle,
    required this.valor,
    required this.fondo,
    required this.color,
    required this.clave,
  });

  final String titulo;
  final String detalle;
  final String valor;
  final Color fondo;
  final Color color;
  final Key clave;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer,
        borderRadius: BorderRadius.circular(CockpitRadius.md),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  titulo,
                  style: CockpitText.bodyMd.copyWith(
                    color: CockpitColors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detalle,
                  style: CockpitText.telemetrySm.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: fondo,
              borderRadius: BorderRadius.circular(CockpitRadius.sm),
            ),
            child: Text(
              valor,
              key: clave,
              style: cifra(size: 15, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

/// **Gestión de Usuarios** — solo vista previa de demostración (sin backend).
class TarjetaGestionUsuarios extends StatelessWidget {
  const TarjetaGestionUsuarios({super.key});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: CockpitColors.surfaceLow,
      borderRadius: BorderRadius.circular(CockpitRadius.lg),
      child: InkWell(
        key: const Key('perfil-usuarios'),
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        onTap: () => _abrirVistaPrevia(context),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(CockpitRadius.lg),
            border: Border.all(
              color: CockpitColors.outlineVariant.withValues(alpha: 0.55),
            ),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: CockpitColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(CockpitRadius.lg),
                ),
                child: const Icon(
                  Icons.manage_accounts_outlined,
                  size: 22,
                  color: CockpitColors.onSurfaceVariant,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Gestión de Usuarios',
                      style: CockpitText.titleMd.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      'Vista previa de demostración · sin backend',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: CockpitColors.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _abrirVistaPrevia(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext _) => const _VistaPreviaUsuarios(),
    );
  }
}

class _VistaPreviaUsuarios extends StatelessWidget {
  const _VistaPreviaUsuarios();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        child: Column(
          key: const Key('usuarios-vista-previa'),
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            const SectionLabel(
              icono: Icons.manage_accounts_outlined,
              etiqueta: 'Gestión de usuarios',
              trailing: StatusPill(
                texto: 'Demostración',
                color: CockpitColors.secondary,
                punto: false,
                icono: Icons.science_outlined,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Solo se muestran las dos cuentas locales de demostración. No hay '
              'servidor: no se crean, editan ni eliminan usuarios.',
              style: CockpitText.bodySm.copyWith(
                color: CockpitColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 12),
            for (final RolUsuario r in RolUsuario.values) ...<Widget>[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: CockpitColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(CockpitRadius.md),
                ),
                child: Row(
                  children: <Widget>[
                    Icon(
                      r == RolUsuario.operador
                          ? Icons.engineering_outlined
                          : Icons.admin_panel_settings_outlined,
                      color: CockpitColors.onSurfaceVariant,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        correoDemoPorRol[r]!,
                        overflow: TextOverflow.ellipsis,
                        style: CockpitText.telemetryMd.copyWith(
                          color: CockpitColors.onSurface,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    CockpitTag(
                      texto: r.etiqueta,
                      fondo: CockpitColors.surfaceHigh,
                      color: CockpitColors.onSurfaceVariant,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 4),
            const OutlinedButton(
              onPressed: null,
              child: Text('Invitar usuario (requiere backend)'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Exporta el CSV real de la analítica P12 (`MqttService.reporteCsv()`).
class BotonExportarSesion extends StatelessWidget {
  const BotonExportarSesion({super.key, required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    final bool hayDatos = servicio.analitica.muestras > 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        OutlinedButton.icon(
          key: const Key('perfil-exportar'),
          style: OutlinedButton.styleFrom(
            backgroundColor: CockpitColors.primaryTonal.withValues(alpha: 0.35),
            foregroundColor: CockpitColors.primary,
            side: BorderSide(
              color: CockpitColors.primary.withValues(alpha: 0.35),
            ),
            minimumSize: const Size.fromHeight(52),
            textStyle: const TextStyle(
              fontFamily: CockpitText.sans,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          onPressed: hayDatos
              ? () => exportarReporteCsv(context, servicio)
              : null,
          icon: const Icon(Icons.download, size: 20),
          label: const Text('Exportar Sesión (CSV)'),
        ),
        if (!hayDatos)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              'Sin datos de sesión: conecta al robot o activa el Modo Demo.',
              textAlign: TextAlign.center,
              style: CockpitText.bodySm.copyWith(color: CockpitColors.outline),
            ),
          ),
      ],
    );
  }
}
