import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/mqtt/mqtt_service.dart';
import '../../core/theme/cockpit_theme.dart';

/// Primitivas visuales del sistema de diseño **Autonomous Laboratory Cockpit**
/// (`DESIGN.md`): tarjeta, celda de métrica, pastilla de estado, barra de
/// progreso, botón Freno Remoto. Solo presentación: ninguna toca MQTT salvo
/// [enviarOrden], que delega en `MqttService.publicarOrden` sin cambiarlo.

/// Estilo monoespaciado de telemetría (JetBrains Mono).
TextStyle mono({
  double size = 12,
  FontWeight peso = FontWeight.w600,
  Color color = CockpitColors.onSurface,
  double espaciado = 0.6,
  double? altura,
}) => TextStyle(
  fontFamily: CockpitText.mono,
  fontSize: size,
  fontWeight: peso,
  color: color,
  letterSpacing: espaciado,
  height: altura,
);

/// Estilo de cifras grandes con figuras tabulares (sin saltos al actualizar).
TextStyle cifra({double size = 22, Color color = CockpitColors.onSurface}) =>
    TextStyle(
      fontFamily: CockpitText.mono,
      fontSize: size,
      height: 28 / 22,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.01 * size,
      color: color,
      fontFeatures: CockpitText.tabular,
    );

/// Envía una orden con la lógica de siempre (`publicarOrden`, QoS 1) y avisa
/// con un SnackBar si no hay conexión. Es la misma regla que tenía la pantalla
/// anterior: no cambia el protocolo ni el contrato de las órdenes.
void enviarOrden(BuildContext context, MqttService servicio, String comando) {
  final bool enviada = servicio.publicarOrden(comando);
  if (!enviada) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: CockpitColors.errorContainer,
          content: Text(
            servicio.ultimoError ?? 'No se pudo enviar la orden.',
            style: const TextStyle(color: CockpitColors.onErrorContainer),
          ),
        ),
      );
  }
}

/// Tarjeta del cockpit: nivel 1 (`#181C22`), borde de 1 px y esquina de 12 px.
/// [resplandor] añade el brillo de borde de un estado activo o de peligro.
class CockpitCard extends StatelessWidget {
  const CockpitCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.borde,
    this.resplandor,
    this.degradado,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? borde;
  final Color? resplandor;
  final Gradient? degradado;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: degradado == null ? CockpitColors.surfaceLow : null,
        gradient: degradado,
        borderRadius: BorderRadius.circular(CockpitRadius.lg),
        border: Border.all(
          color: borde ?? CockpitColors.outlineVariant.withValues(alpha: 0.55),
        ),
        boxShadow: resplandor == null
            ? null
            : <BoxShadow>[
                BoxShadow(
                  color: resplandor!.withValues(alpha: 0.20),
                  blurRadius: 12,
                ),
              ],
      ),
      child: child,
    );
  }
}

/// Celda de métrica: etiqueta en mayúsculas, lectura grande y unidad.
class CockpitCell extends StatelessWidget {
  const CockpitCell({
    super.key,
    required this.etiqueta,
    required this.valor,
    this.unidad,
    this.color = CockpitColors.onSurface,
    this.pie,
    this.pieColor = CockpitColors.onSurfaceVariant,
    this.tamano = 22,
    this.extra,
  });

  final String etiqueta;
  final String valor;
  final String? unidad;
  final Color color;
  final String? pie;
  final Color pieColor;
  final double tamano;

  /// Widget opcional al pie de la celda (por ejemplo, una barra).
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: CockpitColors.surfaceContainer,
        borderRadius: BorderRadius.circular(CockpitRadius.md),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            etiqueta.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: CockpitText.telemetrySm.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: <Widget>[
                Text(
                  valor,
                  style: cifra(size: tamano, color: color),
                ),
                if (unidad != null) ...<Widget>[
                  const SizedBox(width: 3),
                  Text(
                    unidad!,
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
          if (pie != null) ...<Widget>[
            const SizedBox(height: 2),
            Text(
              pie!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: CockpitText.telemetrySm.copyWith(color: pieColor),
            ),
          ],
          if (extra != null) ...<Widget>[const SizedBox(height: 8), extra!],
        ],
      ),
    );
  }
}

/// Encabezado de sección: icono en pozo circular + etiqueta en mayúsculas.
class SectionLabel extends StatelessWidget {
  const SectionLabel({
    super.key,
    required this.icono,
    required this.etiqueta,
    this.trailing,
    this.colorIcono = CockpitColors.primary,
  });

  final IconData icono;
  final String etiqueta;
  final Widget? trailing;
  final Color colorIcono;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(
            color: CockpitColors.surfaceContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(icono, size: 16, color: colorIcono),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            etiqueta.toUpperCase(),
            // Hasta 2 líneas: "EVITACIÓN DE COLISIONES" no se corta a 390 px.
            maxLines: 2,
            softWrap: true,
            overflow: TextOverflow.ellipsis,
            style: CockpitText.labelMd.copyWith(
              color: CockpitColors.onSurfaceVariant,
            ),
          ),
        ),
        if (trailing != null) ...<Widget>[
          const SizedBox(width: 8),
          Flexible(child: trailing!),
        ],
      ],
    );
  }
}

/// Pastilla de estado: nodo luminoso de 6 px + texto mono, tinte al 15 % y
/// contorno al 40 % del color del estado.
class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.texto,
    required this.color,
    this.punto = true,
    this.icono,
  });

  final String texto;
  final Color color;
  final bool punto;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.40)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (punto)
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
                boxShadow: <BoxShadow>[
                  BoxShadow(color: color.withValues(alpha: 0.7), blurRadius: 4),
                ],
              ),
            ),
          if (icono != null) Icon(icono, size: 13, color: color),
          if (punto || icono != null) const SizedBox(width: 6),
          Flexible(
            child: Text(
              texto.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: CockpitText.labelMd.copyWith(fontSize: 11, color: color),
            ),
          ),
        ],
      ),
    );
  }
}

/// Etiqueta rectangular sólida (CRÍTICA / AVISO) de las tarjetas de evento.
class CockpitTag extends StatelessWidget {
  const CockpitTag({
    super.key,
    required this.texto,
    required this.fondo,
    required this.color,
  });

  final String texto;
  final Color fondo;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: fondo,
        borderRadius: BorderRadius.circular(CockpitRadius.sm),
      ),
      child: Text(
        texto.toUpperCase(),
        style: CockpitText.labelMd.copyWith(fontSize: 11, color: color),
      ),
    );
  }
}

/// Barra de progreso gruesa (8 px) con relleno energizado y brillo suave.
class ProgressTrack extends StatelessWidget {
  const ProgressTrack({
    super.key,
    required this.fraccion,
    this.color = CockpitColors.primary,
    this.alto = 8,
  });

  final double fraccion;
  final Color color;
  final double alto;

  @override
  Widget build(BuildContext context) {
    final double f = fraccion.isNaN ? 0 : fraccion.clamp(0.0, 1.0).toDouble();
    return ClipRRect(
      borderRadius: BorderRadius.circular(alto),
      child: Container(
        height: alto,
        color: CockpitColors.surfaceHigh,
        alignment: Alignment.centerLeft,
        child: TweenAnimationBuilder<double>(
          tween: Tween<double>(end: f),
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          builder: (BuildContext context, double valor, Widget? _) {
            return FractionallySizedBox(
              widthFactor: valor,
              heightFactor: 1,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(alto),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: color.withValues(alpha: 0.45),
                      blurRadius: 6,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Respuesta táctil: el control se encoge un 2 % mientras está presionado
/// (escala 0,98 del DESIGN.md). Usa [Listener] para no interferir con el toque.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.habilitado = true});

  final Widget child;
  final bool habilitado;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _abajo = false;

  void _poner(bool v) {
    if (_abajo != v && mounted) setState(() => _abajo = v);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _poner(widget.habilitado),
      onPointerUp: (_) => _poner(false),
      onPointerCancel: (_) => _poner(false),
      child: AnimatedScale(
        scale: _abajo ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}

/// Reparte las tarjetas en 1 columna (móvil) o en 2 (tableta/escritorio,
/// ≥ [umbral] px) como pide el DESIGN.md. Los hijos pares van a la izquierda.
class CockpitColumnas extends StatelessWidget {
  const CockpitColumnas({
    super.key,
    required this.children,
    this.separacion = 12,
    this.umbral = 720,
  });

  final List<Widget> children;
  final double separacion;
  final double umbral;

  Widget _pila(List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (int i = 0; i < items.length; i++) ...<Widget>[
          if (i > 0) SizedBox(height: separacion),
          items[i],
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints c) {
        if (c.maxWidth < umbral) return _pila(children);
        final List<Widget> izq = <Widget>[];
        final List<Widget> der = <Widget>[];
        for (int i = 0; i < children.length; i++) {
          (i.isEven ? izq : der).add(children[i]);
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(child: _pila(izq)),
            SizedBox(width: separacion),
            Expanded(child: _pila(der)),
          ],
        );
      },
    );
  }
}

/// Botón de **parada de emergencia** flotante.
///
/// Un toque envía `frenar` de inmediato (no hay "mantener para confirmar": una
/// parada que tarda no es una parada). Es una orden MQTT, **no** un corte
/// eléctrico: no sustituye el interruptor físico del robot.
class FrenoRemotoButton extends StatefulWidget {
  const FrenoRemotoButton({super.key, required this.alPulsar});

  final VoidCallback alPulsar;

  @override
  State<FrenoRemotoButton> createState() => _FrenoRemotoButtonState();
}

class _FrenoRemotoButtonState extends State<FrenoRemotoButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulso = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );
  bool _animando = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reducir = MediaQuery.of(context).disableAnimations;
    if (reducir && _animando) {
      _pulso.stop();
      _animando = false;
    } else if (!reducir && !_animando) {
      _pulso.repeat(reverse: true);
      _animando = true;
    }
  }

  @override
  void dispose() {
    _pulso.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Freno Remoto. Envía la orden frenar al robot por MQTT; no es una parada de emergencia cableada.',
      excludeSemantics: true,
      child: Tooltip(
        message: "Envía 'frenar' por MQTT. No es una parada de emergencia física: no sustituye el interruptor cableado.",
        child: Pressable(
          child: AnimatedBuilder(
            animation: _pulso,
            builder: (BuildContext context, Widget? hijo) {
              final double t = _animando ? _pulso.value : 0.5;
              return DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(CockpitRadius.xl),
                  boxShadow: <BoxShadow>[
                    BoxShadow(
                      color: CockpitColors.hazard.withValues(
                        alpha: 0.25 + 0.20 * t,
                      ),
                      blurRadius: 12 + 8 * t,
                    ),
                  ],
                ),
                child: hijo,
              );
            },
            child: Material(
              color: CockpitColors.errorContainer,
              borderRadius: BorderRadius.circular(CockpitRadius.xl),
              child: InkWell(
                borderRadius: BorderRadius.circular(CockpitRadius.xl),
                onTap: widget.alPulsar,
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: 56,
                    minWidth: 120,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(CockpitRadius.xl),
                    border: Border.all(
                      color: CockpitColors.hazard.withValues(alpha: 0.6),
                    ),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      DiamondAlertIcon(color: CockpitColors.onErrorContainer),
                      SizedBox(width: 8),
                      Text(
                        'Freno Remoto',
                        style: TextStyle(
                          fontFamily: CockpitText.mono,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                          color: CockpitColors.onErrorContainer,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Rombo de advertencia con signo de exclamación (el icono del Freno Remoto).
class DiamondAlertIcon extends StatelessWidget {
  const DiamondAlertIcon({super.key, required this.color, this.tamano = 28});

  final Color color;
  final double tamano;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(tamano),
      painter: _DiamondPainter(color),
    );
  }
}

class _DiamondPainter extends CustomPainter {
  const _DiamondPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset c = size.center(Offset.zero);
    final double lado = size.width * 0.66;
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(math.pi / 4);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: Offset.zero, width: lado, height: lado),
        Radius.circular(size.width * 0.12),
      ),
      Paint()..color = color,
    );
    canvas.restore();
    final Paint tinta = Paint()..color = CockpitColors.errorContainer;
    final double w = size.width * 0.10;
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(
          center: Offset(c.dx, c.dy - size.height * 0.07),
          width: w,
          height: size.height * 0.24,
        ),
        Radius.circular(w / 2),
      ),
      tinta,
    );
    canvas.drawCircle(Offset(c.dx, c.dy + size.height * 0.16), w * 0.62, tinta);
  }

  @override
  bool shouldRepaint(_DiamondPainter old) => old.color != color;
}
