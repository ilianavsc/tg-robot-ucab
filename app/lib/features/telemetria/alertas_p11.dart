import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';

/// Color de relleno / contorno de un nivel de alerta (rojo peligro / ámbar).
Color colorNivel(NivelAlerta n) =>
    n == NivelAlerta.critica ? CockpitColors.hazard : CockpitColors.warning;

/// Color del texto de un nivel de alerta sobre fondo oscuro.
Color textoNivel(NivelAlerta n) =>
    n == NivelAlerta.critica ? CockpitColors.error : CockpitColors.warning;

/// **P11 · Banner de Alerta Activa.** Aparece bajo la barra de app en las 4
/// secciones: rojo si es crítica y ámbar si es un aviso. Muestra el motivo, la
/// hora y el botón "Reconocer". Sin alertas pendientes no ocupa espacio.
///
/// La lógica (qué es una alerta y cuándo se reconoce) vive en
/// `core/alertas/centro_alertas.dart`; aquí solo se dibuja.
class BannerAlertaActiva extends StatelessWidget {
  const BannerAlertaActiva({super.key});

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final AlertaActiva? a = servicio.centroAlertas.principal;
    final int pendientes = servicio.centroAlertas.pendientes;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 220),
      switchInCurve: Curves.easeOutCubic,
      child: a == null
          ? const SizedBox(
              key: ValueKey<String>('sin-alerta'),
              width: double.infinity,
            )
          : _ContenidoBanner(
              key: ValueKey<String>(
                '${a.clave}-${a.desde.millisecondsSinceEpoch}',
              ),
              alerta: a,
              otras: pendientes - 1,
              alReconocer: () => servicio.reconocerAlerta(a.clave),
            ),
    );
  }
}

class _ContenidoBanner extends StatelessWidget {
  const _ContenidoBanner({
    super.key,
    required this.alerta,
    required this.otras,
    required this.alReconocer,
  });

  final AlertaActiva alerta;
  final int otras;
  final VoidCallback alReconocer;

  @override
  Widget build(BuildContext context) {
    final bool critica = alerta.nivel == NivelAlerta.critica;
    final Color color = colorNivel(alerta.nivel);
    final Color texto = textoNivel(alerta.nivel);

    final Widget boton = Material(
      color: CockpitColors.surfaceHigh,
      borderRadius: BorderRadius.circular(CockpitRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(CockpitRadius.md),
        onTap: alReconocer,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44, minWidth: 48),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          child: Text(
            'RECONOCER',
            style: CockpitText.labelMd.copyWith(color: CockpitColors.onSurface),
          ),
        ),
      ),
    );

    return Semantics(
      liveRegion: true,
      label:
          'Alerta ${critica ? 'crítica' : 'de aviso'}: ${alerta.titulo}. ${alerta.detalle}',
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(CockpitRadius.lg),
          border: Border.all(color: color.withValues(alpha: 0.55)),
          boxShadow: <BoxShadow>[
            BoxShadow(color: color.withValues(alpha: 0.25), blurRadius: 16),
          ],
        ),
        child: LayoutBuilder(
          builder: (BuildContext context, BoxConstraints c) {
            final Widget info = Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: critica
                        ? CockpitColors.errorContainer
                        : CockpitColors.warning.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(CockpitRadius.md),
                  ),
                  child: Icon(
                    Icons.warning_amber_rounded,
                    color: texto,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          Text(
                            alerta.titulo.toUpperCase(),
                            style: CockpitText.labelMd.copyWith(
                              fontWeight: FontWeight.w700,
                              color: texto,
                            ),
                          ),
                          CockpitTag(
                            texto: horaCorta(alerta.desde),
                            fondo: texto.withValues(alpha: 0.85),
                            color: CockpitColors.surfaceLowest,
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        alerta.detalle,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: CockpitText.bodySm.copyWith(
                          color: CockpitColors.onSurface.withValues(
                            alpha: 0.85,
                          ),
                        ),
                      ),
                      if (alerta.confirmadaPorRobot || otras > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            <String>[
                              if (alerta.confirmadaPorRobot)
                                'CONFIRMADA POR EL ROBOT',
                              if (otras > 0)
                                '+$otras ALERTA${otras == 1 ? '' : 'S'} MÁS',
                            ].join(' · '),
                            style: CockpitText.telemetrySm.copyWith(
                              color: texto,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            );
            if (c.maxWidth < 340) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[info, const SizedBox(height: 10), boton],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: <Widget>[
                Expanded(child: info),
                const SizedBox(width: 12),
                boton,
              ],
            );
          },
        ),
      ),
    );
  }
}
