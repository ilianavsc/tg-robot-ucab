import 'dart:math' as math;
import 'dart:ui' show PathMetric, Tangent;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/demo/simulacion_pista.dart';
import '../../core/models/estado.dart';
import '../../core/models/ultrasonido.dart';
import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';
import 'cockpit_datos.dart';
import 'cockpit_ui.dart';

/// Geometría del circuito cerrado (rectángulo de esquinas redondeadas) para un
/// tamaño dado. Sale del mismo recorrido que usa la simulación: la fracción 0
/// es la BASE y el sentido de marcha es el de las agujas del reloj.
class PistaGeometria {
  PistaGeometria(this.tamano) {
    final double lado = math.min(tamano.width, tamano.height);
    final double margenX = math.max(28, tamano.width * 0.11);
    final double margenArriba = math.max(58, tamano.height * 0.17);
    final double margenAbajo = math.max(44, tamano.height * 0.14);
    final Rect r = Rect.fromLTRB(
      margenX,
      margenArriba,
      tamano.width - margenX,
      tamano.height - margenAbajo,
    );
    final double radio = math.min(r.width, r.height) * 0.28;
    camino = Path()
      ..moveTo(r.left, r.bottom - radio)
      ..lineTo(r.left, r.top + radio)
      ..arcToPoint(
        Offset(r.left + radio, r.top),
        radius: Radius.circular(radio),
      )
      ..lineTo(r.right - radio, r.top)
      ..arcToPoint(
        Offset(r.right, r.top + radio),
        radius: Radius.circular(radio),
      )
      ..lineTo(r.right, r.bottom - radio)
      ..arcToPoint(
        Offset(r.right - radio, r.bottom),
        radius: Radius.circular(radio),
      )
      ..lineTo(r.left + radio, r.bottom)
      ..arcToPoint(
        Offset(r.left, r.bottom - radio),
        radius: Radius.circular(radio),
      )
      ..close();
    _metrica = camino.computeMetrics().first;
    escala = lado;
  }

  final Size tamano;
  late final Path camino;
  late final PathMetric _metrica;

  /// Lado menor del lienzo (px): sirve para escalar trazos y textos.
  late final double escala;

  double get longitud => _metrica.length;

  Tangent _en(double fraccion) {
    final double f = fraccion - fraccion.floorToDouble();
    return _metrica.getTangentForOffset(f * _metrica.length)!;
  }

  /// Punto del circuito en la fracción [fraccion] (0..1, 0 = BASE).
  Offset puntoEn(double fraccion) => _en(fraccion).position;

  /// Ángulo (rad) de avance en esa fracción.
  double anguloEn(double fraccion) => _en(fraccion).angle;
}

/// Fracción del circuito de cada nodo.
double fraccionDeDestino(DestinoPista d) =>
    SimulacionPista.posiciones[d]! / SimulacionPista.longitudM;

Color colorDeZona(ZonaSonar z) {
  switch (z) {
    case ZonaSonar.libre:
      return CockpitColors.ok;
    case ZonaSonar.precaucion:
      return CockpitColors.warning;
    case ZonaSonar.parada:
      return CockpitColors.hazard;
    case ZonaSonar.fallo:
    case ZonaSonar.sinSenal:
    case ZonaSonar.sinDatos:
      return CockpitColors.outline;
  }
}

/// Dibuja el circuito, los 3 nodos, el robot con su flecha y el cono del
/// ultrasonido frontal. Sin robot (`fraccionRobot == null`) solo pinta la pista.
class PintorPista extends CustomPainter {
  const PintorPista({
    required this.destino,
    this.fraccionRobot,
    this.obstaculo,
    this.frenteCm,
    this.zona = ZonaSonar.sinDatos,
  });

  final DestinoPista destino;
  final double? fraccionRobot;
  final double? obstaculo;
  final double? frenteCm;
  final ZonaSonar zona;

  @override
  void paint(Canvas canvas, Size size) {
    final PistaGeometria g = PistaGeometria(size);

    // Retícula tenue de fondo
    final Paint rejilla = Paint()
      ..color = CockpitColors.outlineVariant.withValues(alpha: 0.16)
      ..strokeWidth = 1;
    for (double x = 0; x <= size.width; x += 28) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), rejilla);
    }
    for (double y = 0; y <= size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), rejilla);
    }

    // Pista: resplandor, cuerpo y línea central
    canvas.drawPath(
      g.camino,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 16
        ..color = CockpitColors.primary.withValues(alpha: 0.13)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7),
    );
    canvas.drawPath(
      g.camino,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7
        ..color = CockpitColors.primary.withValues(alpha: 0.30),
    );
    canvas.drawPath(
      g.camino,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..color = CockpitColors.primary,
    );

    // Nodos
    for (final DestinoPista d in DestinoPista.values) {
      _nodo(canvas, size, g, d);
    }

    // Obstáculo simulado
    final double? o = obstaculo;
    if (o != null) {
      final Offset p = g.puntoEn(o);
      canvas.drawCircle(
        p,
        11,
        Paint()..color = CockpitColors.hazard.withValues(alpha: 0.25),
      );
      canvas.drawCircle(p, 6, Paint()..color = CockpitColors.hazard);
    }

    // Cono del ultrasonido y robot
    final double? f = fraccionRobot;
    if (f != null) {
      final Offset p = g.puntoEn(f);
      final double ang = g.anguloEn(f);
      _cono(canvas, p, ang);
      _robot(canvas, p, ang);
    }
  }

  void _nodo(Canvas canvas, Size size, PistaGeometria g, DestinoPista d) {
    final Offset p = g.puntoEn(fraccionDeDestino(d));
    final bool activo = d == destino;
    final Color color = d == DestinoPista.base
        ? CockpitColors.ok
        : (d == DestinoPista.estacionA
              ? CockpitColors.primary
              : CockpitColors.secondary);
    if (activo) {
      canvas.drawCircle(
        p,
        17,
        Paint()
          ..color = CockpitColors.primary.withValues(alpha: 0.28)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );
    }
    canvas.drawCircle(p, 13, Paint()..color = CockpitColors.surface);
    canvas.drawCircle(
      p,
      13,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = activo ? 3 : 2
        ..color = activo ? CockpitColors.primary : color.withValues(alpha: 0.7),
    );
    canvas.drawCircle(p, 5, Paint()..color = color);

    // Etiqueta dentro del lazo (BASE a la derecha, ESTACIÓN A debajo) o fuera
    // por debajo (ESTACIÓN B), para no chocar con los chips ni con la pista.
    final TextPainter tp = TextPainter(
      text: TextSpan(
        text: d.nombre,
        style: mono(
          size: 11,
          peso: FontWeight.w600,
          color: activo ? CockpitColors.primary : CockpitColors.onSurface,
          espaciado: 0.4,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    double x;
    double y;
    switch (d) {
      case DestinoPista.base:
        x = p.dx + 20;
        y = p.dy - tp.height / 2;
        break;
      case DestinoPista.estacionA:
        x = p.dx - tp.width / 2;
        y = p.dy + 20;
        break;
      case DestinoPista.estacionB:
        x = p.dx - tp.width / 2;
        y = p.dy + 20;
        break;
    }
    x = x.clamp(4.0, size.width - tp.width - 4);
    tp.paint(canvas, Offset(x, y));
  }

  void _cono(Canvas canvas, Offset p, double ang) {
    final double? d = frenteCm;
    if (d == null || zona == ZonaSonar.fallo || zona == ZonaSonar.sinDatos) {
      return;
    }
    final Color c = colorDeZona(zona);
    // Largo del cono: proporcional a la lectura, entre 34 y 84 px.
    final double largo = (34 + (d.clamp(0.0, 150.0) / 150.0) * 50);
    const double abertura = 0.30;
    final Offset a = p + Offset.fromDirection(ang - abertura, largo);
    final Offset b = p + Offset.fromDirection(ang + abertura, largo);
    final Path cono = Path()
      ..moveTo(p.dx, p.dy)
      ..lineTo(a.dx, a.dy)
      ..lineTo(b.dx, b.dy)
      ..close();
    canvas.drawPath(cono, Paint()..color = c.withValues(alpha: 0.28));
    canvas.drawPath(
      cono,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = c.withValues(alpha: 0.75),
    );
    final TextPainter tp = TextPainter(
      text: TextSpan(
        text: '${d.toStringAsFixed(0)} cm',
        style: mono(size: 11, peso: FontWeight.w700, color: c, espaciado: 0.3),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final Offset punta = p + Offset.fromDirection(ang, largo + 6);
    tp.paint(canvas, punta + const Offset(-4, -22));
  }

  void _robot(Canvas canvas, Offset p, double ang) {
    canvas.save();
    canvas.translate(p.dx, p.dy);
    canvas.rotate(ang);
    final RRect cuerpo = RRect.fromRectAndRadius(
      const Rect.fromLTWH(-15, -10, 30, 20),
      const Radius.circular(5),
    );
    canvas.drawRRect(cuerpo, Paint()..color = CockpitColors.surfaceHigh);
    canvas.drawRRect(
      cuerpo,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = CockpitColors.primary,
    );
    // Flecha de avance (hacia +x)
    final Path flecha = Path()
      ..moveTo(7, 0)
      ..lineTo(-4, -6)
      ..lineTo(-1, 0)
      ..lineTo(-4, 6)
      ..close();
    canvas.drawPath(flecha, Paint()..color = CockpitColors.primary);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant PintorPista v) =>
      v.destino != destino ||
      v.fraccionRobot != fraccionRobot ||
      v.obstaculo != obstaculo ||
      v.frenteCm != frenteCm ||
      v.zona != zona;
}

/// Texto de la seguridad frontal para la tarjeta de misión.
String textoSeguridad(ZonaSonar z) {
  switch (z) {
    case ZonaSonar.libre:
      return 'OK';
    case ZonaSonar.precaucion:
      return 'PRECAUCIÓN';
    case ZonaSonar.parada:
      return 'PARADA';
    case ZonaSonar.fallo:
      return 'FALLO SENSOR';
    case ZonaSonar.sinSenal:
      return 'SIN SEÑAL';
    case ZonaSonar.sinDatos:
      return '—';
  }
}

/// **Mapa de Pista** (vista principal del Dashboard): circuito con el robot,
/// el cono del ultrasonido frontal, tarjeta de misión, destinos y pausa.
///
/// En **Modo Demo** todo sale de la simulación física (`MqttService.pista`).
/// Con el robot real NO se inventa nada: el robot no tiene localización
/// absoluta (solo 4× TCRT5000 y 2× HC-SR04P), así que no se dibuja su posición
/// ni se ofrecen destinos; sí se muestran velocidad, batería y distancia
/// frontal reales, y Pausar/Reanudar envían `frenar` / `auto`.
class TarjetaMapaPista extends StatelessWidget {
  const TarjetaMapaPista({super.key});

  @override
  Widget build(BuildContext context) {
    final MqttService servicio = context.watch<MqttService>();
    final SimulacionPista? sim = servicio.pista;
    final Estado? estado = servicio.ultimoEstado;
    final Ultrasonido? us = servicio.ultimoUltrasonido;
    final bool sinSenal = estadoSinSenal(estado);
    final Estado? e = sinSenal ? null : estado;
    final ZonaSonar zona = zonaFrente(us);
    final bool demo = sim != null;
    final enlace = _enlace(servicio);

    return CockpitCard(
      key: const Key('mapa-pista'),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _Cabecera(demo: demo, enlace: enlace),
          const SizedBox(height: 12),
          _Mapa(sim: sim, us: us, zona: zona, hayDatos: e != null),
          const SizedBox(height: 12),
          _TarjetaMision(sim: sim, estado: e, zona: zona),
          const SizedBox(height: 14),
          _SelectorDestino(servicio: servicio, sim: sim),
          const SizedBox(height: 12),
          _BotonPausa(servicio: servicio, sim: sim, estado: e),
          if (sim?.ultimoEvento != null) ...<Widget>[
            const SizedBox(height: 10),
            _UltimoEvento(evento: sim!.ultimoEvento!),
          ],
        ],
      ),
    );
  }

  ({String texto, Color color}) _enlace(MqttService s) {
    if (s.simulando) {
      return (texto: 'Modo Demo', color: CockpitColors.secondary);
    }
    if (s.conectado) {
      return s.recibiendoDatos
          ? (texto: 'Online', color: CockpitColors.ok)
          : (texto: 'Sin datos', color: CockpitColors.warning);
    }
    return (texto: 'Sin enlace', color: CockpitColors.outline);
  }
}

class _Cabecera extends StatelessWidget {
  const _Cabecera({required this.demo, required this.enlace});

  final bool demo;
  final ({String texto, Color color}) enlace;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: CockpitColors.surfaceContainer,
            borderRadius: BorderRadius.circular(CockpitRadius.lg),
          ),
          child: const Icon(
            Icons.smart_toy_outlined,
            color: CockpitColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'MAPA DE PISTA',
                style: CockpitText.labelMd.copyWith(
                  fontSize: 14,
                  color: Colors.white,
                ),
              ),
              Text(
                demo
                    ? 'Circuito simulado · AGV-01'
                    : 'Circuito cerrado · AGV-01',
                style: CockpitText.telemetrySm.copyWith(
                  color: CockpitColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 8),
        StatusPill(texto: enlace.texto, color: enlace.color),
      ],
    );
  }
}

class _Mapa extends StatelessWidget {
  const _Mapa({
    required this.sim,
    required this.us,
    required this.zona,
    required this.hayDatos,
  });

  final SimulacionPista? sim;
  final Ultrasonido? us;
  final ZonaSonar zona;
  final bool hayDatos;

  @override
  Widget build(BuildContext context) {
    final SimulacionPista? s = sim;
    final Color cz = colorDeZona(zona);
    final String textoUs = zona == ZonaSonar.libre
        ? 'US LIBRE'
        : (zona == ZonaSonar.precaucion
              ? 'US PRECAUCIÓN'
              : (zona == ZonaSonar.parada
                    ? 'US PARADA'
                    : (zona == ZonaSonar.fallo
                          ? 'US FALLO'
                          : (zona == ZonaSonar.sinSenal
                                ? 'US SIN SEÑAL'
                                : 'US —'))));

    return Semantics(
      label: s == null
          ? 'Mapa de pista sin posición del robot'
          : 'Mapa de pista: robot hacia ${s.destino.nombre}, '
                'frente a ${s.frenteCm.toStringAsFixed(0)} centímetros',
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints c) {
          final double alto = math.min(c.maxWidth * 0.86, 330);
          return Container(
            height: alto,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: CockpitColors.surfaceLowest,
              borderRadius: BorderRadius.circular(CockpitRadius.lg),
              border: Border.all(
                color: CockpitColors.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            child: Stack(
              children: <Widget>[
                Positioned.fill(
                  child: CustomPaint(
                    key: const Key('mapa-pista-lienzo'),
                    painter: PintorPista(
                      destino: s?.destino ?? DestinoPista.estacionA,
                      fraccionRobot: s?.fraccion,
                      obstaculo: s?.obstaculoFraccion,
                      frenteCm: s != null ? s.frenteCm : us?.frenteValido,
                      zona: zona,
                    ),
                  ),
                ),
                Positioned(
                  left: 10,
                  top: 10,
                  child: _Chip(
                    texto: s == null
                        ? 'SIN POSICIÓN'
                        : '${SimulacionPista.longitudM.toStringAsFixed(0)} m · SIMULADO',
                    color: CockpitColors.primary,
                    icono: s == null
                        ? Icons.location_off_outlined
                        : Icons.route,
                  ),
                ),
                Positioned(
                  right: 10,
                  top: 10,
                  child: _Chip(texto: textoUs, color: cz, icono: Icons.sensors),
                ),
                if (s == null)
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: 12,
                    child: Text(
                      'El robot solo mide la línea (4× IR) y la distancia (2× '
                      'ultrasonido): no hay localización absoluta. El mapa se '
                      'anima en el Modo Demo.',
                      textAlign: TextAlign.center,
                      style: CockpitText.bodySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.texto, required this.color, required this.icono});

  final String texto;
  final Color color;
  final IconData icono;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: CockpitColors.surface.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(CockpitRadius.md),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(icono, size: 14, color: color),
          const SizedBox(width: 6),
          Text(
            texto,
            style: CockpitText.labelMd.copyWith(fontSize: 11, color: color),
          ),
        ],
      ),
    );
  }
}

/// Tarjeta de misión: fase, seguridad y 3 lecturas.
class _TarjetaMision extends StatelessWidget {
  const _TarjetaMision({
    required this.sim,
    required this.estado,
    required this.zona,
  });

  final SimulacionPista? sim;
  final Estado? estado;
  final ZonaSonar zona;

  ({String texto, Color color}) _fase() {
    final SimulacionPista? s = sim;
    if (s != null) {
      switch (s.fase) {
        case FaseMision.enRuta:
          return (
            texto: 'EN RUTA → ${s.destino.nombre}',
            color: CockpitColors.primary,
          );
        case FaseMision.enDestino:
          return (texto: 'EN ${s.destino.nombre}', color: CockpitColors.ok);
        case FaseMision.pausada:
          return (texto: 'MISIÓN PAUSADA', color: CockpitColors.warning);
        case FaseMision.bloqueada:
          return (texto: 'DETENIDO · OBSTÁCULO', color: CockpitColors.hazard);
        case FaseMision.manual:
          return (texto: 'CONTROL MANUAL', color: CockpitColors.secondary);
      }
    }
    final Estado? e = estado;
    if (e == null) {
      return (texto: 'SIN TELEMETRÍA', color: CockpitColors.outline);
    }
    final ParadaInfo p = describirParada(e.parada);
    if (p.detenido) return (texto: p.corta, color: CockpitColors.hazard);
    return e.modo == 'autonomo'
        ? (texto: 'SEGUIMIENTO AUTÓNOMO', color: CockpitColors.primary)
        : (texto: 'CONTROL MANUAL', color: CockpitColors.secondary);
  }

  @override
  Widget build(BuildContext context) {
    final fase = _fase();
    final Estado? e = estado;
    final SimulacionPista? s = sim;
    final Color cs = colorDeZona(zona);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer,
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        border: Border.all(
          color: CockpitColors.outlineVariant.withValues(alpha: 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 4,
            children: <Widget>[
              Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: fase.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      fase.texto,
                      key: const Key('mision-fase'),
                      style: CockpitText.labelMd.copyWith(
                        fontSize: 13,
                        color: fase.color,
                      ),
                    ),
                  ),
                ],
              ),
              Text.rich(
                TextSpan(
                  children: <InlineSpan>[
                    TextSpan(
                      text: 'SEGURIDAD: ',
                      style: CockpitText.telemetrySm.copyWith(
                        color: CockpitColors.onSurfaceVariant,
                      ),
                    ),
                    TextSpan(
                      text: textoSeguridad(zona),
                      style: CockpitText.labelMd.copyWith(
                        fontSize: 11,
                        color: cs,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              Expanded(
                child: CockpitCell(
                  key: const Key('mision-velocidad'),
                  etiqueta: 'Velocidad',
                  valor: e == null
                      ? '—'
                      : e.velocidadMedia.abs().toStringAsFixed(2),
                  unidad: 'm/s',
                  tamano: 18,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  key: const Key('mision-bateria'),
                  etiqueta: 'Batería 3S',
                  valor: e == null ? '—' : '${e.bateria}',
                  unidad: e == null ? null : '%',
                  color: e == null
                      ? CockpitColors.onSurface
                      : (e.bateriaBaja
                            ? CockpitColors.warning
                            : CockpitColors.ok),
                  tamano: 18,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: CockpitCell(
                  key: const Key('mision-avance'),
                  etiqueta: 'Avance',
                  valor: s == null
                      ? '—'
                      : (s.progresoTramo * 100).toStringAsFixed(0),
                  unidad: s == null ? null : '% tramo',
                  color: CockpitColors.secondary,
                  tamano: 18,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Selector de destino. Solo existe en el Modo Demo: el firmware no recibe
/// destinos, así que con el robot real los botones quedan deshabilitados.
class _SelectorDestino extends StatelessWidget {
  const _SelectorDestino({required this.servicio, required this.sim});

  final MqttService servicio;
  final SimulacionPista? sim;

  static const Map<DestinoPista, IconData> _iconos = <DestinoPista, IconData>{
    DestinoPista.base: Icons.home_outlined,
    DestinoPista.estacionA: Icons.science_outlined,
    DestinoPista.estacionB: Icons.inventory_2_outlined,
  };

  static const Map<DestinoPista, String> _claves = <DestinoPista, String>{
    DestinoPista.base: 'destino-base',
    DestinoPista.estacionA: 'destino-a',
    DestinoPista.estacionB: 'destino-b',
  };

  @override
  Widget build(BuildContext context) {
    final SimulacionPista? s = sim;
    final bool activo = s != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                'PUNTO DE DESTINO',
                style: CockpitText.labelMd.copyWith(
                  color: CockpitColors.onSurfaceVariant,
                ),
              ),
            ),
            Text(
              s == null ? 'SOLO EN DEMO' : (s.autonomo ? 'AUTÓNOMO' : 'MANUAL'),
              style: CockpitText.labelMd.copyWith(
                fontSize: 11,
                color: s == null
                    ? CockpitColors.outline
                    : CockpitColors.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: <Widget>[
            for (final DestinoPista d in DestinoPista.values) ...<Widget>[
              if (d != DestinoPista.base) const SizedBox(width: 8),
              Expanded(
                child: _BotonDestino(
                  clave: Key(_claves[d]!),
                  texto: d.corto,
                  icono: _iconos[d]!,
                  seleccionado: activo && s.destino == d,
                  habilitado: activo,
                  alPulsar: () => servicio.elegirDestinoDemo(d),
                ),
              ),
            ],
          ],
        ),
        if (!activo)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              'El robot no recibe destinos: el firmware solo entiende '
              'adelante, atrás, giros, frenar y auto.',
              style: CockpitText.bodySm.copyWith(color: CockpitColors.outline),
            ),
          ),
      ],
    );
  }
}

class _BotonDestino extends StatelessWidget {
  const _BotonDestino({
    required this.clave,
    required this.texto,
    required this.icono,
    required this.seleccionado,
    required this.habilitado,
    required this.alPulsar,
  });

  final Key clave;
  final String texto;
  final IconData icono;
  final bool seleccionado;
  final bool habilitado;
  final VoidCallback alPulsar;

  @override
  Widget build(BuildContext context) {
    final Color fg = seleccionado
        ? CockpitColors.onPrimary
        : (habilitado ? CockpitColors.onSurface : CockpitColors.outline);
    return Semantics(
      button: true,
      selected: seleccionado,
      enabled: habilitado,
      label: 'Destino $texto',
      child: Material(
        color: seleccionado ? CockpitColors.primary : CockpitColors.surfaceHigh,
        borderRadius: BorderRadius.circular(CockpitRadius.md),
        child: InkWell(
          key: clave,
          borderRadius: BorderRadius.circular(CockpitRadius.md),
          onTap: habilitado ? alPulsar : null,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  Icon(icono, size: 18, color: fg),
                  const SizedBox(height: 2),
                  Text(
                    texto,
                    maxLines: 2,
                    textAlign: TextAlign.center,
                    softWrap: true,
                    style: CockpitText.labelMd.copyWith(
                      fontSize: 11,
                      color: fg,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Pausar / Reanudar la misión: usa las órdenes reales `frenar` y `auto`
/// (QoS 1), igual que ALTO y AUTO NAV de Controles.
class _BotonPausa extends StatelessWidget {
  const _BotonPausa({
    required this.servicio,
    required this.sim,
    required this.estado,
  });

  final MqttService servicio;
  final SimulacionPista? sim;
  final Estado? estado;

  @override
  Widget build(BuildContext context) {
    final SimulacionPista? s = sim;
    final bool autonomo = s != null ? s.autonomo : estado?.modo == 'autonomo';
    final bool puede = servicio.puedeEnviarOrdenes;
    return OutlinedButton.icon(
      key: const Key('mision-pausa'),
      style: OutlinedButton.styleFrom(
        foregroundColor: autonomo ? CockpitColors.primary : CockpitColors.ok,
        side: BorderSide(
          color: (autonomo ? CockpitColors.primary : CockpitColors.ok)
              .withValues(alpha: 0.4),
        ),
        minimumSize: const Size.fromHeight(52),
      ),
      onPressed: puede
          ? () => enviarOrden(context, servicio, autonomo ? 'frenar' : 'auto')
          : null,
      icon: Icon(autonomo ? Icons.pause : Icons.play_arrow, size: 20),
      label: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(autonomo ? 'PAUSAR MISIÓN' : 'REANUDAR MISIÓN'),
      ),
    );
  }
}

class _UltimoEvento extends StatelessWidget {
  const _UltimoEvento({required this.evento});

  final EventoSim evento;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Icon(Icons.history, size: 14, color: CockpitColors.outline),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            'ÚLTIMO EVENTO · ${evento.texto}',
            key: const Key('mision-evento'),
            softWrap: true,
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}
