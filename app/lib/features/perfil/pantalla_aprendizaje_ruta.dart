import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show listEquals;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/cockpit_theme.dart';
import '../auth/sesion_local.dart';
import '../telemetria/cockpit_ui.dart';
import 'aprendizaje_ruta.dart';

/// **Aprendizaje de Ruta (Admin).** Pasada virtual con puntos de control y
/// vista previa de la reducción progresiva de cinta. Solo Administrador: con
/// otro rol muestra "Acceso restringido" y ningún control.
///
/// Es una simulación (SIL) en memoria. La lectura de la MPU-6050 y el escaneo
/// BLE de las balizas [PENDIENTE DE INTEGRACIÓN EN FIRMWARE].
class PantallaAprendizajeRuta extends StatefulWidget {
  const PantallaAprendizajeRuta({super.key});

  @override
  State<PantallaAprendizajeRuta> createState() =>
      _PantallaAprendizajeRutaState();
}

class _PantallaAprendizajeRutaState extends State<PantallaAprendizajeRuta> {
  Timer? _reloj;
  String? _mensaje;
  bool _exito = false;

  @override
  void initState() {
    super.initState();
    // La pasada virtual avanza sola a 0,40 m/s.
    _reloj = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!mounted) return;
      final AprendizajeRuta a = context.read<AprendizajeRuta>();
      if (a.aprendiendo && !a.pasadaCompleta) a.avanzar(0.2);
    });
  }

  @override
  void dispose() {
    _reloj?.cancel();
    super.dispose();
  }

  void _avisar(bool ok, String texto) => setState(() {
    _exito = ok;
    _mensaje = texto;
  });

  @override
  Widget build(BuildContext context) {
    final RolUsuario? rol = context.watch<SesionLocal>().rol;
    final AprendizajeRuta a = context.watch<AprendizajeRuta>();
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
          'APRENDIZAJE DE RUTA',
          style: CockpitText.labelMd.copyWith(
            fontSize: 14,
            color: CockpitColors.onSurface,
          ),
        ),
      ),
      body: !admin
          ? const _Restringido()
          : Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                  children: <Widget>[
                    _Nota(),
                    const SizedBox(height: 14),
                    _TarjetaPasada(
                      a: a,
                      rol: rol,
                      mensaje: _mensaje,
                      exito: _exito,
                      avisar: _avisar,
                    ),
                    const SizedBox(height: 12),
                    _TarjetaRutaGuardada(a: a, rol: rol, avisar: _avisar),
                    const SizedBox(height: 12),
                    _TarjetaReduccion(a: a, rol: rol),
                  ],
                ),
              ),
            ),
    );
  }
}

class _Restringido extends StatelessWidget {
  const _Restringido();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          key: const Key('aprendizaje-restringido'),
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(
              Icons.lock_outline,
              size: 40,
              color: CockpitColors.outline,
            ),
            const SizedBox(height: 12),
            Text(
              'Acceso restringido',
              style: CockpitText.headlineSm.copyWith(color: Colors.white),
            ),
            const SizedBox(height: 6),
            Text(
              'El aprendizaje de ruta es solo para el Administrador. El '
              'Operador usa la ruta ya guardada.',
              textAlign: TextAlign.center,
              style: CockpitText.bodyMd.copyWith(
                color: CockpitColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Nota extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(
            Icons.info_outline,
            size: 16,
            color: CockpitColors.secondary,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'Simulación (SIL) en memoria: no mueve el robot real ni le envía '
            'rutas. Las balizas BLE (2 ESP32 fijos) y la lectura de la '
            'MPU-6050 están [PENDIENTE DE INTEGRACIÓN EN FIRMWARE].',
            key: const Key('aprendizaje-nota'),
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}

/// Pasada virtual: inicia, marca puntos de control y guarda.
class _TarjetaPasada extends StatelessWidget {
  const _TarjetaPasada({
    required this.a,
    required this.rol,
    required this.mensaje,
    required this.exito,
    required this.avisar,
  });

  final AprendizajeRuta a;
  final RolUsuario? rol;
  final String? mensaje;
  final bool exito;
  final void Function(bool ok, String texto) avisar;

  @override
  Widget build(BuildContext context) {
    final bool activa = a.aprendiendo;
    return CockpitCard(
      key: const Key('aprendizaje-pasada'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.alt_route,
            etiqueta: 'Pasada de aprendizaje',
            trailing: StatusPill(
              texto: activa ? 'Aprendiendo' : 'En reposo',
              color: activa ? CockpitColors.primary : CockpitColors.outline,
              punto: activa,
            ),
          ),
          const SizedBox(height: 12),
          ProgressTrack(fraccion: a.progreso),
          const SizedBox(height: 6),
          Text(
            activa
                ? '${a.posicionM.toStringAsFixed(1)} / ${AprendizajeRuta.longitudM.toStringAsFixed(1)} m · '
                      '${a.borrador.where((PuntoRuta p) => !p.estacion).length} puntos marcados'
                : 'Inicia una pasada virtual desde el Cuarto de Componentes.',
            key: const Key('aprendizaje-estado'),
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
          if (activa)
            for (final PuntoRuta p in a.borrador.where(
              (PuntoRuta p) => !p.estacion,
            ))
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '◆ ${p.nombre} · ${p.metros.toStringAsFixed(1)} m',
                  softWrap: true,
                  style: CockpitText.bodySm.copyWith(
                    color: CockpitColors.secondary,
                  ),
                ),
              ),
          if (mensaje != null) ...<Widget>[
            const SizedBox(height: 8),
            Text(
              mensaje!,
              key: const Key('aprendizaje-mensaje'),
              style: CockpitText.bodySm.copyWith(
                color: exito ? CockpitColors.ok : CockpitColors.error,
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (!activa)
            FilledButton.icon(
              key: const Key('aprendizaje-iniciar'),
              onPressed: () {
                a.iniciarPasada(rol);
                avisar(true, 'Pasada iniciada: marca los puntos de control.');
              },
              icon: const Icon(Icons.play_arrow, size: 20),
              label: const Text('INICIAR PASADA'),
            )
          else ...<Widget>[
            FilledButton.icon(
              key: const Key('aprendizaje-marcar'),
              onPressed: () {
                final bool ok = a.marcarPunto(rol);
                avisar(
                  ok,
                  ok
                      ? 'Punto marcado a ${a.posicionM.toStringAsFixed(1)} m.'
                      : 'No se pudo marcar: muy cerca de otro punto o se '
                            'alcanzó el máximo (${AprendizajeRuta.maxPuntosControl}).',
                );
              },
              icon: const Icon(Icons.add_location_alt_outlined, size: 20),
              label: const FittedBox(
                fit: BoxFit.scaleDown,
                child: Text('MARCAR PUNTO DE CONTROL'),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton.icon(
                    key: const Key('aprendizaje-guardar'),
                    onPressed: () {
                      final bool ok = a.finalizarYGuardar(rol);
                      avisar(
                        ok,
                        ok
                            ? 'Ruta guardada: ${a.puntosDeControl.length} puntos de control.'
                            : 'Marca al menos un punto de control para guardar.',
                      );
                    },
                    icon: const Icon(Icons.save_outlined, size: 18),
                    label: const FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text('GUARDAR RUTA'),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                TextButton(
                  key: const Key('aprendizaje-descartar'),
                  onPressed: () {
                    a.descartarPasada(rol);
                    avisar(
                      true,
                      'Pasada descartada; la ruta guardada no cambió.',
                    );
                  },
                  child: const Text('DESCARTAR'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Ruta guardada, la que usa el Operador.
class _TarjetaRutaGuardada extends StatelessWidget {
  const _TarjetaRutaGuardada({
    required this.a,
    required this.rol,
    required this.avisar,
  });

  final AprendizajeRuta a;
  final RolUsuario? rol;
  final void Function(bool ok, String texto) avisar;

  @override
  Widget build(BuildContext context) {
    return CockpitCard(
      key: const Key('aprendizaje-guardada'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SectionLabel(
            icono: Icons.flag_outlined,
            etiqueta: 'Ruta guardada',
            trailing: StatusPill(
              texto: '${a.guardada.length} puntos',
              color: CockpitColors.primary,
              punto: false,
            ),
          ),
          const SizedBox(height: 10),
          for (final PuntoRuta p in a.guardada) ...<Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: CockpitColors.surfaceContainer,
                borderRadius: BorderRadius.circular(CockpitRadius.md),
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      p.nombre,
                      softWrap: true,
                      style: CockpitText.bodyMd.copyWith(
                        color: CockpitColors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${p.metros.toStringAsFixed(1)} m',
                    style: CockpitText.telemetryMd.copyWith(
                      color: CockpitColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(width: 8),
                  CockpitTag(
                    texto: p.estacion ? 'ESTACIÓN' : 'CONTROL',
                    fondo: CockpitColors.surfaceHigh,
                    color: p.estacion
                        ? CockpitColors.ok
                        : CockpitColors.secondary,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
          ],
          const SizedBox(height: 4),
          OutlinedButton.icon(
            key: const Key('aprendizaje-restablecer'),
            onPressed: () {
              a.restablecer(rol);
              avisar(true, 'Ruta restablecida a la de fábrica.');
            },
            icon: const Icon(Icons.restart_alt, size: 18),
            label: const Text('RESTABLECER RUTA'),
          ),
        ],
      ),
    );
  }
}

/// Vista previa de la reducción progresiva de cinta.
class _TarjetaReduccion extends StatelessWidget {
  const _TarjetaReduccion({required this.a, required this.rol});

  final AprendizajeRuta a;
  final RolUsuario? rol;

  @override
  Widget build(BuildContext context) {
    final bool vista = a.vistaReduccion;
    final int sin = a.nivelReduccion;
    return CockpitCard(
      key: const Key('aprendizaje-reduccion'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  color: CockpitColors.surfaceContainer,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.timeline,
                  size: 16,
                  color: CockpitColors.primary,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'REDUCCIÓN PROGRESIVA DE CINTA',
                  key: const Key('reduccion-titulo'),
                  softWrap: true,
                  style: CockpitText.labelMd.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
              ),
              Switch(
                key: const Key('reduccion-switch'),
                value: vista,
                onChanged: (bool v) => a.activarVistaReduccion(rol, v),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Vista previa: retira la cinta tramo a tramo, desde la salida.',
            style: CockpitText.bodySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
          if (vista) ...<Widget>[
            const SizedBox(height: 12),
            SizedBox(
              height: 100,
              child: CustomPaint(
                key: const Key('reduccion-lienzo'),
                painter: PintorReduccion(
                  nombres: <String>[
                    for (final PuntoRuta p in a.guardada) p.nombre,
                  ],
                  sinCinta: <bool>[
                    for (int i = 0; i < a.tramos; i++) a.tramoSinCinta(i),
                  ],
                ),
                child: const SizedBox.expand(),
              ),
            ),
            const SizedBox(height: 6),
            Row(
              children: <Widget>[
                Text(
                  'Tramos sin cinta',
                  style: CockpitText.labelMd.copyWith(
                    color: CockpitColors.onSurfaceVariant,
                  ),
                ),
                const Spacer(),
                Text(
                  '$sin de ${a.tramos}',
                  key: const Key('reduccion-nivel'),
                  style: CockpitText.labelMd.copyWith(
                    color: sin == 0 ? CockpitColors.ok : CockpitColors.warning,
                  ),
                ),
              ],
            ),
            Slider(
              key: const Key('reduccion-slider'),
              value: sin.toDouble(),
              min: 0,
              max: a.tramos.toDouble(),
              divisions: a.tramos,
              label: '$sin',
              onChanged: (double v) => a.fijarNivelReduccion(rol, v.round()),
            ),
            Text(
              sin == 0
                  ? 'Cinta completa: el robot sigue la línea con los 4 TCRT5000 en todos los tramos.'
                  : 'En los $sin tramos sin cinta el robot mantendría el rumbo '
                        'relativo con el giroscopio de la MPU-6050 (heading hold) '
                        'hasta confirmar el siguiente punto de control con la '
                        'baliza BLE (ESP32 fijo). Sin magnetómetro: no hay rumbo '
                        'absoluto. [PENDIENTE DE INTEGRACIÓN EN FIRMWARE]',
              key: const Key('reduccion-texto'),
              softWrap: true,
              style: CockpitText.bodySm.copyWith(
                color: CockpitColors.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Dibuja los tramos de la ruta: con cinta (turquesa continuo) o sin cinta
/// (ámbar punteado, con MPU al centro y BLE en el punto siguiente).
class PintorReduccion extends CustomPainter {
  const PintorReduccion({required this.nombres, required this.sinCinta});

  final List<String> nombres;
  final List<bool> sinCinta;

  @override
  void paint(Canvas canvas, Size size) {
    final int n = nombres.length;
    if (n < 2) return;
    const double margen = 22;
    final double y = size.height * 0.42;
    final double paso = (size.width - 2 * margen) / (n - 1);
    Offset pt(int i) => Offset(margen + paso * i, y);

    for (int i = 0; i < n - 1; i++) {
      final Offset a = pt(i), b = pt(i + 1);
      final bool sin = i < sinCinta.length && sinCinta[i];
      if (!sin) {
        canvas.drawLine(
          a,
          b,
          Paint()
            ..strokeWidth = 4
            ..strokeCap = StrokeCap.round
            ..color = CockpitColors.primary,
        );
      } else {
        final double largo = (b - a).distance;
        for (double d = 0; d < largo; d += 12) {
          final Offset p0 = a + (b - a) * (d / largo);
          final Offset p1 = a + (b - a) * (((d + 6).clamp(0.0, largo)) / largo);
          canvas.drawLine(
            p0,
            p1,
            Paint()
              ..strokeWidth = 3
              ..strokeCap = StrokeCap.round
              ..color = CockpitColors.warning.withValues(alpha: 0.85),
          );
        }
        _etiqueta(
          canvas,
          'MPU',
          (a + b) / 2 + const Offset(0, -16),
          CockpitColors.warning,
        );
      }
    }
    for (int i = 0; i < n; i++) {
      final Offset p = pt(i);
      final bool baliza = i > 0 && i - 1 < sinCinta.length && sinCinta[i - 1];
      canvas.drawCircle(p, 8, Paint()..color = CockpitColors.surface);
      canvas.drawCircle(
        p,
        8,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..color = baliza ? CockpitColors.secondary : CockpitColors.primary,
      );
      if (baliza)
        _etiqueta(
          canvas,
          'BLE',
          p + const Offset(0, -26),
          CockpitColors.secondary,
        );
      final TextPainter tp = TextPainter(
        text: TextSpan(
          text: nombres[i],
          style: mono(
            size: 9.5,
            peso: FontWeight.w600,
            color: CockpitColors.onSurface,
            espaciado: 0.2,
            altura: 1.2,
          ),
        ),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        maxLines: 3,
      )..layout(maxWidth: math.max(40, paso - 6));
      // Dentro del lienzo: la 1.ª y la última etiqueta no se salen por los lados
      final double x = (p.dx - tp.width / 2).clamp(
        2.0,
        math.max(2.0, size.width - tp.width - 2),
      );
      tp.paint(canvas, Offset(x, p.dy + 14));
    }
  }

  void _etiqueta(Canvas canvas, String texto, Offset centro, Color c) {
    final TextPainter tp = TextPainter(
      text: TextSpan(
        text: texto,
        style: mono(size: 10, peso: FontWeight.w700, color: c, espaciado: 0.4),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, centro - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant PintorReduccion v) =>
      !listEquals(v.nombres, nombres) || !listEquals(v.sinCinta, sinCinta);
}
