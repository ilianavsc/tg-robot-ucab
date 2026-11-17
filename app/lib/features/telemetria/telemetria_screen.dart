import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/models/estado.dart';
import '../../core/mqtt/mqtt_service.dart';

/// Pantalla de telemetría con diseño Material 3 de nivel portafolio.
///
/// Agrupa la información en tarjetas temáticas (Enlace MQTT, Batería 3S con
/// barra de progreso, Modo y Línea óptica, Cinemática y Sistema), usando
/// colores condicionales e iconografía clara.
class TelemetriaScreen extends StatelessWidget {
  const TelemetriaScreen({super.key});

  static const Color _verdePrimario = Color(0xFF0F9D84);
  static const Color _rojoError = Color(0xFFE11D48);
  static const Color _ambarAviso = Color(0xFFD97706);

  @override
  Widget build(BuildContext context) {
    final servicio = context.watch<MqttService>();
    final estado = servicio.ultimoEstado;
    final colorEstado = _colorConexion(servicio);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Row(
          children: <Widget>[
            Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: colorEstado,
                shape: BoxShape.circle,
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: colorEstado.withValues(alpha: 0.4),
                    blurRadius: 6,
                    spreadRadius: 1,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            const Text(
              'TG Robot UCAB · Telemetría',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 19),
            ),
          ],
        ),
        actions: <Widget>[
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(
              avatar: Icon(
                servicio.simulando
                    ? Icons.science
                    : (servicio.conectado ? Icons.cloud_done : Icons.cloud_off),
                size: 16,
                color: Colors.white,
              ),
              label: Text(
                servicio.simulando
                    ? 'MODO DEMO'
                    : _textoConexion(servicio.conexion).toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              backgroundColor: colorEstado,
              side: BorderSide.none,
            ),
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 860),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: <Widget>[
              _TarjetaConexionYControles(
                servicio: servicio,
                colorEstado: colorEstado,
              ),
              const SizedBox(height: 16),
              if (estado == null)
                _TarjetaEsperandoDatos(servicio: servicio)
              else ...<Widget>[
                _TarjetaBateria(estado: estado),
                const SizedBox(height: 16),
                _TarjetaModoYLinea(estado: estado),
                const SizedBox(height: 16),
                _TarjetaTraccionYSistema(estado: estado),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static Color _colorConexion(MqttService servicio) {
    if (servicio.simulando) return _verdePrimario;
    switch (servicio.conexion) {
      case EstadoConexion.conectado:
        return _verdePrimario;
      case EstadoConexion.conectando:
        return _ambarAviso;
      case EstadoConexion.error:
        return _rojoError;
      case EstadoConexion.desconectado:
        return const Color(0xFF64748B);
    }
  }

  static String _textoConexion(EstadoConexion c) {
    switch (c) {
      case EstadoConexion.desconectado:
        return 'desconectado';
      case EstadoConexion.conectando:
        return 'conectando…';
      case EstadoConexion.conectado:
        return 'conectado';
      case EstadoConexion.error:
        return 'error';
    }
  }
}

/// Tarjeta principal con estado del enlace MQTT y los botones de acción.
class _TarjetaConexionYControles extends StatelessWidget {
  const _TarjetaConexionYControles({
    required this.servicio,
    required this.colorEstado,
  });

  final MqttService servicio;
  final Color colorEstado;

  @override
  Widget build(BuildContext context) {
    final bool tieneError =
        !servicio.simulando &&
        (servicio.conexion == EstadoConexion.error ||
            servicio.ultimoError != null);

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: tieneError
              ? TelemetriaScreen._rojoError
              : const Color(0xFFCBD5E1),
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(
                  servicio.simulando
                      ? Icons.bolt
                      : (tieneError ? Icons.error_outline : Icons.router),
                  color: colorEstado,
                  size: 26,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        servicio.simulando
                            ? 'Simulación Local Activa (Modo Demo)'
                            : 'Enlace MQTT · ${servicio.nombreBroker}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 17,
                        ),
                      ),
                      Text(
                        '${servicio.host}:${servicio.puertoEfectivo} · Tópico: ${servicio.topicoEstado}',
                        style: const TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: colorEstado.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: colorEstado),
                  ),
                  child: Text(
                    servicio.recibiendoDatos
                        ? 'Recibiendo (${servicio.segundosSinDatos} s)'
                        : servicio.ultimoMensaje == null
                        ? 'Esperando datos'
                        : 'Sin datos (${servicio.segundosSinDatos} s)',
                    style: TextStyle(
                      color: colorEstado,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: List<Widget>.generate(servicio.listaBrokers.length, (int i) {
                final b = servicio.listaBrokers[i];
                final bool activo = i == servicio.indiceBroker;
                return InkWell(
                  onTap: () => servicio.seleccionarBroker(i),
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: activo ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: activo ? const Color(0xFF0F172A) : const Color(0xFFCBD5E1),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        if (activo && servicio.conectado) ...<Widget>[
                          Container(
                            width: 7,
                            height: 7,
                            decoration: const BoxDecoration(
                              color: Color(0xFF22C55E),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Text(
                          '${b.nombre} (:${kIsWeb ? b.puertoWeb : b.puertoNativo})',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: activo ? Colors.white : const Color(0xFF475569),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ),
            if (servicio.ultimoError != null && !servicio.simulando) ...<Widget>[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  border: Border.all(color: const Color(0xFFFECDD3)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    const Icon(
                      Icons.warning_amber_rounded,
                      color: TelemetriaScreen._rojoError,
                      size: 20,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        servicio.ultimoError!,
                        style: const TextStyle(
                          color: Color(0xFF9F1239),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (servicio.simulando) ...<Widget>[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  border: Border.all(color: const Color(0xFF6EE7B7)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Row(
                  children: <Widget>[
                    Icon(
                      Icons.check_circle,
                      color: TelemetriaScreen._verdePrimario,
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'MODO DEMO ACTIVO · Emitiendo los 6 perfiles de telemetría cada 2 s sin red.',
                        style: TextStyle(
                          color: Color(0xFF065F46),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: <Widget>[
                FilledButton.icon(
                  onPressed: servicio.conectar,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 12,
                    ),
                  ),
                  icon: const Icon(Icons.wifi_tethering, size: 18),
                  label: const Text('Conectar'),
                ),
                OutlinedButton.icon(
                  onPressed: servicio.desconectar,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                  ),
                  icon: const Icon(Icons.link_off, size: 18),
                  label: const Text('Desconectar'),
                ),
                FilledButton.icon(
                  onPressed: servicio.iniciarSimulacion,
                  style: FilledButton.styleFrom(
                    backgroundColor: TelemetriaScreen._verdePrimario,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 12,
                    ),
                  ),
                  icon: const Icon(Icons.play_circle_fill, size: 18),
                  label: const Text('Modo Demo'),
                ),
                if (servicio.simulando)
                  OutlinedButton.icon(
                    onPressed: servicio.detenerSimulacion,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: TelemetriaScreen._rojoError,
                      side: const BorderSide(color: TelemetriaScreen._rojoError),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                    ),
                    icon: const Icon(Icons.stop_circle_outlined, size: 18),
                    label: const Text('Detener Demo'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Estado vacío cuando aún no ha llegado el primer paquete de telemetría.
class _TarjetaEsperandoDatos extends StatelessWidget {
  const _TarjetaEsperandoDatos({required this.servicio});

  final MqttService servicio;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
        child: Column(
          children: <Widget>[
            const Icon(
              Icons.sensors,
              size: 48,
              color: TelemetriaScreen._verdePrimario,
            ),
            const SizedBox(height: 12),
            const Text(
              'Esperando telemetría del robot…',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
            ),
            const SizedBox(height: 6),
            const Text(
              'Enciende el ESP32 físico, abre el Simulador Web P10 o pulsa "Modo Demo" para visualizar los sensores en vivo.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF64748B), fontSize: 14),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: servicio.iniciarSimulacion,
              style: FilledButton.styleFrom(
                backgroundColor: TelemetriaScreen._verdePrimario,
              ),
              icon: const Icon(Icons.play_arrow),
              label: const Text('Activar Modo Demo ahora'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de Batería Li-Ion 3S con barra de progreso y alerta de voltaje bajo.
class _TarjetaBateria extends StatelessWidget {
  const _TarjetaBateria({required this.estado});

  final Estado estado;

  @override
  Widget build(BuildContext context) {
    final bool baja = estado.bateriaBaja;
    final Color colorBarra = baja
        ? TelemetriaScreen._rojoError
        : (estado.bateria <= 40
              ? TelemetriaScreen._ambarAviso
              : TelemetriaScreen._verdePrimario);

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: baja ? TelemetriaScreen._rojoError : const Color(0xFFCBD5E1),
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Icon(
                  baja ? Icons.battery_alert : Icons.battery_charging_full,
                  color: colorBarra,
                  size: 28,
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Text(
                    'Batería Li-Ion 3S (Nominal 11.1 V)',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
                Text(
                  '${estado.bateria} % · ${estado.bateriaV.toStringAsFixed(2)} V',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                    color: colorBarra,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: estado.bateria.clamp(0, 100) / 100.0,
                minHeight: 14,
                backgroundColor: const Color(0xFFE2E8F0),
                valueColor: AlwaysStoppedAnimation<Color>(colorBarra),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                const Text(
                  'Corte seguro: 9.90 V (0 %)',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                if (baja)
                  const Text(
                    '¡ALERTA: BATERÍA BAJA!',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: TelemetriaScreen._rojoError,
                    ),
                  )
                else
                  const Text(
                    'Carga máxima: 12.60 V (100 %)',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de Modo de Operación (Autónomo / Manual) y Seguimiento de Línea.
class _TarjetaModoYLinea extends StatelessWidget {
  const _TarjetaModoYLinea({required this.estado});

  final Estado estado;

  @override
  Widget build(BuildContext context) {
    final bool veLinea = estado.veLaLinea;
    final Color colorLinea = veLinea
        ? TelemetriaScreen._verdePrimario
        : TelemetriaScreen._rojoError;

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: _ItemMetricaIcono(
                    icono: estado.esAutonomo
                        ? Icons.smart_toy
                        : Icons.sports_esports,
                    colorIcono: estado.esAutonomo
                        ? TelemetriaScreen._verdePrimario
                        : const Color(0xFF7C3AED),
                    titulo: 'Modo de Operación',
                    valor: estado.esAutonomo
                        ? 'Autónomo (PD 100 Hz)'
                        : 'Manual (Control Remoto)',
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _ItemMetricaIcono(
                    icono: veLinea ? Icons.timeline : Icons.warning_amber,
                    colorIcono: colorLinea,
                    titulo: 'Posición de Línea (4× TCRT5000)',
                    valor:
                        '${estado.lineaMm.toStringAsFixed(1)} mm (${veLinea ? "En pista" : "Perdida"})',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Tarjeta de Velocidades de Ruedas (P03) y Contadores de Sistema (P01).
class _TarjetaTraccionYSistema extends StatelessWidget {
  const _TarjetaTraccionYSistema({required this.estado});

  final Estado estado;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFCBD5E1), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Row(
              children: <Widget>[
                Icon(Icons.speed, color: Color(0xFF0F172A), size: 22),
                SizedBox(width: 8),
                Text(
                  'Tracción Diferencial y Telemetría de Sistema',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
              ],
            ),
            const Divider(height: 24),
            Wrap(
              spacing: 16,
              runSpacing: 16,
              children: <Widget>[
                _ChipDato(
                  icono: Icons.tire_repair,
                  etiqueta: 'Rueda Izquierda',
                  valor: '${estado.vIzq.toStringAsFixed(2)} m/s',
                ),
                _ChipDato(
                  icono: Icons.tire_repair,
                  etiqueta: 'Rueda Derecha',
                  valor: '${estado.vDer.toStringAsFixed(2)} m/s',
                ),
                _ChipDato(
                  icono: Icons.moving,
                  etiqueta: 'Velocidad Media',
                  valor: '${estado.velocidadMedia.toStringAsFixed(2)} m/s',
                ),
                _ChipDato(
                  icono: Icons.inventory_2_outlined,
                  etiqueta: 'Órdenes Recibidas',
                  valor: '${estado.ordenes}',
                ),
                _ChipDato(
                  icono: Icons.tag,
                  etiqueta: 'Paquete Estado',
                  valor: '#${estado.numero}',
                ),
                _ChipDato(
                  icono: Icons.timer_outlined,
                  etiqueta: 'Tiempo Activo',
                  valor: estado.tiempoEncendido,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ItemMetricaIcono extends StatelessWidget {
  const _ItemMetricaIcono({
    required this.icono,
    required this.colorIcono,
    required this.titulo,
    required this.valor,
  });

  final IconData icono;
  final Color colorIcono;
  final String titulo;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: colorIcono.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icono, color: colorIcono, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  titulo,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  valor,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipDato extends StatelessWidget {
  const _ChipDato({
    required this.icono,
    required this.etiqueta,
    required this.valor,
  });

  final IconData icono;
  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: <Widget>[
          Icon(icono, size: 20, color: const Color(0xFF475569)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  etiqueta,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                ),
                Text(
                  valor,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
