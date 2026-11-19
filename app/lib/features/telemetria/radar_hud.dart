import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/alertas/centro_alertas.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';

/// Color de cada zona de un sensor ultrasónico (verde / ámbar / rojo, como en
/// el radar P13 y en RF-05; gris cuando no hay lectura fiable).
Color colorZona(ZonaSonar z) {
  switch (z) {
    case ZonaSonar.libre:
      return CockpitColors.ok;
    case ZonaSonar.precaucion:
      return CockpitColors.warning;
    case ZonaSonar.parada:
      return CockpitColors.hazard;
    case ZonaSonar.fallo:
      return CockpitColors.hazard;
    case ZonaSonar.sinSenal:
    case ZonaSonar.sinDatos:
      return CockpitColors.outline;
  }
}

/// Radar polar de los 2 HC-SR04P (frente y atrás). Escala de 2 m; anillos
/// discontinuos en los umbrales reales del firmware (20 cm parada, 50 cm aviso).
/// Los conos y marcadores toman el color de su zona.
class RadarHud extends StatefulWidget {
  const RadarHud({
    super.key,
    required this.frenteCm,
    required this.atrasCm,
    required this.zonaFrente,
    required this.zonaAtras,
  });

  final double? frenteCm;
  final double? atrasCm;
  final ZonaSonar zonaFrente;
  final ZonaSonar zonaAtras;

  /// `true` si algún sensor tiene lectura vigente (el barrido gira).
  bool get activo => _vigente(zonaFrente) || _vigente(zonaAtras);

  static bool _vigente(ZonaSonar z) =>
      z != ZonaSonar.sinSenal && z != ZonaSonar.sinDatos;

  @override
  State<RadarHud> createState() => _RadarHudState();
}

class _RadarHudState extends State<RadarHud>
    with SingleTickerProviderStateMixin {
  late final AnimationController _barrido = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  );

  void _sincronizar() {
    final bool reducir = MediaQuery.of(context).disableAnimations;
    final bool girar = widget.activo && !reducir;
    if (girar && !_barrido.isAnimating) {
      _barrido.repeat();
    } else if (!girar && _barrido.isAnimating) {
      _barrido.stop();
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sincronizar();
  }

  @override
  void didUpdateWidget(RadarHud old) {
    super.didUpdateWidget(old);
    _sincronizar();
  }

  @override
  void dispose() {
    _barrido.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final String etiqueta =
        'Radar polar. Frente: ${_leer(widget.frenteCm, widget.zonaFrente)}. '
        'Atrás: ${_leer(widget.atrasCm, widget.zonaAtras)}.';
    return Semantics(
      label: etiqueta,
      image: true,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: AspectRatio(
            aspectRatio: 1,
            child: AnimatedBuilder(
              animation: _barrido,
              builder: (BuildContext context, Widget? _) {
                return CustomPaint(
                  painter: _RadarPainter(
                    frenteCm: widget.frenteCm,
                    atrasCm: widget.atrasCm,
                    zf: widget.zonaFrente,
                    za: widget.zonaAtras,
                    barrido: _barrido.value,
                    activo: widget.activo,
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  static String _leer(double? cm, ZonaSonar z) {
    if (z == ZonaSonar.fallo) return 'fallo, sin eco';
    if (z == ZonaSonar.sinSenal || z == ZonaSonar.sinDatos || cm == null) {
      return 'sin señal';
    }
    return cm > 0 ? '${cm.toStringAsFixed(0)} centímetros' : 'despejado';
  }
}

class _RadarPainter extends CustomPainter {
  _RadarPainter({
    required this.frenteCm,
    required this.atrasCm,
    required this.zf,
    required this.za,
    required this.barrido,
    required this.activo,
  });

  final double? frenteCm;
  final double? atrasCm;
  final ZonaSonar zf;
  final ZonaSonar za;
  final double barrido;
  final bool activo;

  static const double _semiFrente = 30 * math.pi / 180; // cono de 60°
  static const double _semiAtras = 22.5 * math.pi / 180; // cono de 45°

  @override
  void paint(Canvas canvas, Size size) {
    final Offset c = size.center(Offset.zero);
    final double r = math.min(size.width, size.height) / 2 - 4;
    final double r0 = r * 0.20; // semilado del robot
    double rad(double cm) =>
        r0 + (cm.clamp(0, rangoRadarCm) / rangoRadarCm) * (r - r0);
    Offset polar(double radio, double ang) =>
        c + Offset(math.cos(ang) * radio, math.sin(ang) * radio);

    // Disco de fondo (pozo recesado)
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = const RadialGradient(
          colors: <Color>[Color(0xFF102029), Color(0xFF0A0E14)],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    // Anillos de rango: 0,5 / 1,0 / 1,5 / 2,0 m
    final Paint anillo = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = CockpitColors.primary.withValues(alpha: 0.16);
    for (final double cm in <double>[50, 100, 150, 200]) {
      canvas.drawCircle(c, rad(cm), anillo);
      _texto(
        canvas,
        '${(cm / 100).toStringAsFixed(1)} m',
        c + Offset(5, -rad(cm) + 2),
        mono(
          size: 9,
          peso: FontWeight.w500,
          color: CockpitColors.onSurfaceVariant.withValues(alpha: 0.8),
          espaciado: 0,
        ),
      );
    }

    // Umbrales reales del firmware: 20 cm parada (rojo), 50 cm aviso (ámbar)
    _anilloDiscontinuo(
      canvas,
      c,
      rad(CentroAlertas.umbralParadaCm),
      CockpitColors.hazard.withValues(alpha: 0.75),
    );
    _anilloDiscontinuo(
      canvas,
      c,
      rad(CentroAlertas.umbralAvisoCm),
      CockpitColors.warning.withValues(alpha: 0.65),
    );

    // Ejes
    final Paint eje = Paint()
      ..strokeWidth = 1
      ..color = CockpitColors.primary.withValues(alpha: 0.10);
    canvas.drawLine(Offset(c.dx - r, c.dy), Offset(c.dx + r, c.dy), eje);
    canvas.drawLine(Offset(c.dx, c.dy - r), Offset(c.dx, c.dy + r), eje);

    // Conos de los sensores (frente hacia arriba, atrás hacia abajo)
    _cono(canvas, c, r0, r, -math.pi / 2, _semiFrente, colorZona(zf));
    _cono(canvas, c, r0, r, math.pi / 2, _semiAtras, colorZona(za));

    // Barrido
    if (activo) {
      final double ang = barrido * 2 * math.pi;
      canvas.save();
      canvas.clipPath(Path()..addOval(Rect.fromCircle(center: c, radius: r)));
      canvas.drawCircle(
        c,
        r,
        Paint()
          ..shader = SweepGradient(
            colors: <Color>[
              Colors.transparent,
              Colors.transparent,
              CockpitColors.primary.withValues(alpha: 0.26),
            ],
            stops: const <double>[0, 0.88, 1],
            transform: GradientRotation(ang),
          ).createShader(Rect.fromCircle(center: c, radius: r)),
      );
      canvas.drawLine(
        c,
        polar(r, ang),
        Paint()
          ..strokeWidth = 1.5
          ..color = CockpitColors.primary.withValues(alpha: 0.7),
      );
      canvas.restore();
    }

    // Contorno exterior
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = CockpitColors.primary.withValues(alpha: 0.28),
    );

    // Robot al centro
    final double lado = r0 * 1.55;
    final RRect cuerpo = RRect.fromRectAndRadius(
      Rect.fromCenter(center: c, width: lado, height: lado),
      const Radius.circular(8),
    );
    canvas.drawRRect(cuerpo, Paint()..color = CockpitColors.surfaceHigh);
    canvas.drawRRect(
      cuerpo,
      Paint()
        ..style = PaintingStyle.stroke
        ..color = CockpitColors.outlineVariant,
    );
    final Path flecha = Path()
      ..moveTo(c.dx, c.dy - lado * 0.30)
      ..lineTo(c.dx + lado * 0.17, c.dy + lado * 0.06)
      ..lineTo(c.dx, c.dy - lado * 0.02)
      ..lineTo(c.dx - lado * 0.17, c.dy + lado * 0.06)
      ..close();
    canvas.drawPath(flecha, Paint()..color = CockpitColors.primary);
    _texto(
      canvas,
      'ROBOT',
      Offset(c.dx, c.dy + lado * 0.24),
      mono(
        size: 8,
        peso: FontWeight.w700,
        color: CockpitColors.onSurfaceVariant,
        espaciado: 0.6,
      ),
      centrado: true,
    );

    // Marcadores y etiquetas
    _marcador(canvas, c, rad, frenteCm, zf, 'FRENTE', true, r0);
    _marcador(canvas, c, rad, atrasCm, za, 'ATRÁS', false, r0);
  }

  void _marcador(
    Canvas canvas,
    Offset c,
    double Function(double) rad,
    double? cm,
    ZonaSonar z,
    String nombre,
    bool arriba,
    double r0,
  ) {
    final double signo = arriba ? -1 : 1;
    final Color color = colorZona(z);
    if (z == ZonaSonar.fallo) {
      _etiqueta(
        canvas,
        '$nombre · SIN ECO',
        Offset(c.dx + 8, c.dy + signo * (r0 + 22)),
        CockpitColors.error,
        CockpitColors.errorContainer,
      );
      return;
    }
    if (z == ZonaSonar.sinSenal || z == ZonaSonar.sinDatos || cm == null) {
      _etiqueta(
        canvas,
        '$nombre · SIN SEÑAL',
        Offset(c.dx + 8, c.dy + signo * (r0 + 22)),
        CockpitColors.onSurfaceVariant,
        CockpitColors.surfaceHigh,
      );
      return;
    }
    if (cm <= 0) return; // sensor sano sin objeto en rango: el cono verde basta
    final Offset p = Offset(c.dx, c.dy + signo * rad(cm));
    canvas.drawCircle(p, 11, Paint()..color = color.withValues(alpha: 0.20));
    canvas.drawCircle(p, 6.5, Paint()..color = color);
    final String texto = cm >= rangoRadarCm
        ? '$nombre · > 2.00 m'
        : '$nombre · ${metros(cm)} m${z == ZonaSonar.parada ? '!' : ''}';
    _etiqueta(
      canvas,
      texto,
      p + const Offset(14, -8),
      z == ZonaSonar.parada ? CockpitColors.error : color,
      CockpitColors.surfaceLowest.withValues(alpha: 0.85),
    );
  }

  void _cono(
    Canvas canvas,
    Offset c,
    double r0,
    double r,
    double centro,
    double semi,
    Color color,
  ) {
    final double a1 = centro - semi;
    final double barrido = semi * 2;
    final Path p = Path()
      ..moveTo(c.dx + math.cos(a1) * r0, c.dy + math.sin(a1) * r0)
      ..lineTo(c.dx + math.cos(a1) * r, c.dy + math.sin(a1) * r)
      ..arcTo(Rect.fromCircle(center: c, radius: r), a1, barrido, false)
      ..lineTo(
        c.dx + math.cos(a1 + barrido) * r0,
        c.dy + math.sin(a1 + barrido) * r0,
      )
      ..arcTo(
        Rect.fromCircle(center: c, radius: r0),
        a1 + barrido,
        -barrido,
        false,
      )
      ..close();
    canvas.drawPath(
      p,
      Paint()
        ..shader = RadialGradient(
          colors: <Color>[
            color.withValues(alpha: 0.28),
            color.withValues(alpha: 0.05),
          ],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    canvas.drawPath(
      p,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = color.withValues(alpha: 0.30),
    );
  }

  void _anilloDiscontinuo(Canvas canvas, Offset c, double radio, Color color) {
    final Paint p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = color;
    const int tramos = 36;
    final double paso = 2 * math.pi / tramos;
    for (int i = 0; i < tramos; i += 2) {
      canvas.drawArc(
        Rect.fromCircle(center: c, radius: radio),
        i * paso,
        paso,
        false,
        p,
      );
    }
  }

  void _texto(
    Canvas canvas,
    String texto,
    Offset pos,
    TextStyle estilo, {
    bool centrado = false,
  }) {
    final TextPainter tp = TextPainter(
      text: TextSpan(text: texto, style: estilo),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, centrado ? pos - Offset(tp.width / 2, 0) : pos);
  }

  void _etiqueta(
    Canvas canvas,
    String texto,
    Offset pos,
    Color color,
    Color fondo,
  ) {
    final TextPainter tp = TextPainter(
      text: TextSpan(
        text: texto,
        style: mono(
          size: 10,
          peso: FontWeight.w600,
          color: color,
          espaciado: 0.3,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final Rect caja = Rect.fromLTWH(
      pos.dx,
      pos.dy,
      tp.width + 10,
      tp.height + 6,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(caja, const Radius.circular(4)),
      Paint()..color = fondo,
    );
    tp.paint(canvas, Offset(pos.dx + 5, pos.dy + 3));
  }

  @override
  bool shouldRepaint(_RadarPainter old) =>
      old.frenteCm != frenteCm ||
      old.atrasCm != atrasCm ||
      old.zf != zf ||
      old.za != za ||
      old.barrido != barrido ||
      old.activo != activo;
}

/// Mosaico de un canal del arreglo acústico (frente o atrás): distancia, zona y
/// barra de 0 a 2 m. Lo usan el Dashboard (HUD de obstáculos) y el Radar.
class TileSonar extends StatelessWidget {
  const TileSonar({
    super.key,
    required this.etiqueta,
    required this.icono,
    required this.cm,
    required this.zona,
  });

  final String etiqueta;
  final IconData icono;
  final double? cm;
  final ZonaSonar zona;

  @override
  Widget build(BuildContext context) {
    final Color color = colorZona(zona);
    final bool alerta = zona == ZonaSonar.parada || zona == ZonaSonar.fallo;
    final bool aviso = zona == ZonaSonar.precaucion;
    final bool apagado =
        zona == ZonaSonar.sinSenal || zona == ZonaSonar.sinDatos;
    final double? valor = cm;

    final String lectura;
    String? unidad = 'cm';
    if (zona == ZonaSonar.fallo) {
      lectura = 'SIN ECO';
      unidad = null;
    } else if (apagado || valor == null) {
      lectura = '—';
      unidad = null;
    } else if (valor <= 0) {
      lectura = '> 200';
    } else {
      lectura = valor.toStringAsFixed(0);
    }
    final Color colorTexto = alerta
        ? CockpitColors.error
        : (apagado ? CockpitColors.outline : color);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: (alerta || aviso)
            ? color.withValues(alpha: 0.10)
            : CockpitColors.surfaceLow,
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        border: Border.all(
          color: (alerta || aviso)
              ? color.withValues(alpha: 0.45)
              : CockpitColors.outlineVariant.withValues(alpha: 0.55),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icono, size: 14, color: CockpitColors.onSurfaceVariant),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  etiqueta.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: CockpitText.telemetrySm.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ),
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  boxShadow: apagado
                      ? null
                      : <BoxShadow>[
                          BoxShadow(
                            color: color.withValues(alpha: 0.7),
                            blurRadius: 5,
                          ),
                        ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: <Widget>[
                Text(lectura, style: cifra(size: 26, color: colorTexto)),
                if (unidad != null) ...<Widget>[
                  const SizedBox(width: 4),
                  Text(
                    unidad,
                    style: mono(
                      size: 12,
                      peso: FontWeight.w500,
                      color: CockpitColors.onSurfaceVariant,
                      espaciado: 0,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 2),
          Text(
            textoZona(zona),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: CockpitText.telemetrySm.copyWith(color: colorTexto),
          ),
          const SizedBox(height: 8),
          ProgressTrack(
            fraccion: (apagado || zona == ZonaSonar.fallo)
                ? 0
                : ((valor == null || valor <= 0) ? 1 : valor / rangoRadarCm),
            color: color,
          ),
        ],
      ),
    );
  }
}
