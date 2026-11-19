import 'dart:math' as math;

import '../../core/alertas/centro_alertas.dart';
import '../../core/models/estado.dart';
import '../../core/models/ultrasonido.dart';

/// Cálculos derivados que muestra el Cockpit. Dart puro (sin Flutter): se
/// prueba con `flutter test` y no toca la lógica de MQTT ni del Modo Demo.
///
/// Regla de oro de esta capa: **nunca inventar datos**. Si el robot no manda
/// un valor (corriente, temperatura, RPM, PWM, celdas), la pantalla muestra una
/// estimación marcada como tal o directamente no lo muestra.

/// Diámetro de la rueda (m): el mismo `RUEDA_D` del firmware.
const double ruedaDiametroM = 0.065;

/// Separación entre los 4 TCRT5000 (mm) y su posición respecto al centro.
const double separacionIrMm = 18.0;
const List<double> posicionesIrMm = <double>[27, 9, -9, -27];

/// Rango de la escala del radar y de las barras (cm): 2 m.
const double rangoRadarCm = 200;

/// RPM de la rueda a partir de su velocidad lineal (m/s, con signo).
/// Es un cálculo: el firmware publica m/s (`v_izq`, `v_der`), no RPM.
double rpmDeVelocidad(double v) => v * 60 / (math.pi * ruedaDiametroM);

/// Qué sensores de línea ven la cinta (S1..S4, de izquierda a derecha), según
/// `linea_mm`. La cinta de 19 mm cubre un sensor cuando está a menos de media
/// separación (9 mm) del centro de ese sensor.
List<bool> canalesIr(double lineaMm) {
  // El firmware informa ±32,4 mm cuando pierde la línea (`Estado.veLaLinea`
  // es `|linea_mm| < 32`): en ese caso ningún sensor la ve.
  if (lineaMm.abs() >= 32)
    return List<bool>.filled(posicionesIrMm.length, false);
  return List<bool>.generate(
    posicionesIrMm.length,
    (int i) => (lineaMm - posicionesIrMm[i]).abs() <= separacionIrMm / 2,
  );
}

/// Posición horizontal (0 = extremo izquierdo, 1 = extremo derecho) de la
/// línea en la pista de ±32 mm. `linea_mm` es **positivo hacia la izquierda**,
/// así que el signo se invierte para dibujar.
double fraccionPistaLinea(double lineaMm) =>
    (1 - lineaMm.clamp(-32.0, 32.0) / 32.0) / 2;

/// Estimación de la tensión de cada celda de la 3S (V del pack / 3). El robot
/// solo mide el pack completo, así que se muestra marcada como estimada.
double celdaEstimadaV(double packV) => packV / 3;

/// Fracción de carga de una celda Li-Ion entre 3,30 V (corte) y 4,20 V (llena).
double fraccionCelda(double v) => ((v - 3.30) / (4.20 - 3.30)).clamp(0.0, 1.0);

/// `true` si el estado es el "cero base" que deja `detenerSimulacion()` o aún
/// no hay telemetría: la pantalla lo muestra apagado (sin señal).
bool estadoSinSenal(Estado? e) =>
    e == null || (e.numero == 0 && e.bateria == 0 && e.bateriaV == 0.0);

/// Zonas de un sensor ultrasónico (RF-05): 20 cm parada, 50 cm aviso.
enum ZonaSonar { libre, precaucion, parada, fallo, sinSenal, sinDatos }

/// Frescura máxima de una lectura ultrasónica antes de marcarla "sin señal".
const Duration frescuraUltrasonido = Duration(seconds: 3);

/// Clasifica una lectura. [cm] es la distancia del sensor, [ok] su bandera
/// `*_ok` del firmware y [llegada] la hora de la última lectura.
ZonaSonar zonaSonar({
  required double? cm,
  required bool ok,
  required DateTime? llegada,
  DateTime? ahora,
}) {
  if (llegada == null || cm == null) return ZonaSonar.sinDatos;
  final ahoraReal = ahora ?? DateTime.now();
  if (ahoraReal.difference(llegada) > frescuraUltrasonido)
    return ZonaSonar.sinSenal;
  if (!ok) return ZonaSonar.fallo;
  if (cm > 0 && cm < CentroAlertas.umbralParadaCm) return ZonaSonar.parada;
  if (cm > 0 && cm < CentroAlertas.umbralAvisoCm) return ZonaSonar.precaucion;
  return ZonaSonar.libre; // 0 cm con sensor sano = nada en rango
}

/// Zona del sensor delantero / trasero del último mensaje.
ZonaSonar zonaFrente(Ultrasonido? u, {DateTime? ahora}) => zonaSonar(
  cm: u?.frenteCm,
  ok: u?.frenteOk ?? true,
  llegada: u?.llegada,
  ahora: ahora,
);

ZonaSonar zonaAtras(Ultrasonido? u, {DateTime? ahora}) => zonaSonar(
  cm: u?.atrasCm,
  ok: u?.atrasOk ?? true,
  llegada: u?.llegada,
  ahora: ahora,
);

/// Texto corto de cada zona para las tarjetas de sonar.
String textoZona(ZonaSonar z) {
  switch (z) {
    case ZonaSonar.libre:
      return 'DESPEJADO (> 50 cm)';
    case ZonaSonar.precaucion:
      return 'PRECAUCIÓN (20–50 cm)';
    case ZonaSonar.parada:
      return 'PARADA (< 20 cm)';
    case ZonaSonar.fallo:
      return 'FALLO · SIN ECO';
    case ZonaSonar.sinSenal:
      return 'SIN SEÑAL (> 3 s)';
    case ZonaSonar.sinDatos:
      return 'ESPERANDO LECTURA';
  }
}

/// Motivo de parada que informa el firmware en el campo `parada`.
class ParadaInfo {
  const ParadaInfo(this.etiqueta, this.nivel, {this.corta = ''});

  /// Texto para la pantalla (mayúsculas).
  final String etiqueta;

  /// Versión breve para pastillas estrechas.
  final String corta;

  /// `null` si el robot puede moverse.
  final NivelAlerta? nivel;

  bool get detenido => nivel != null;
}

/// Traduce el campo `parada` del estado (ver `docs/arquitectura/topicos-mqtt.md`).
ParadaInfo describirParada(String parada) {
  switch (parada) {
    case 'obstaculo_frente':
      return const ParadaInfo(
        'PARADA · OBSTÁCULO FRONTAL',
        NivelAlerta.critica,
        corta: 'PARADA',
      );
    case 'obstaculo_atras':
      return const ParadaInfo(
        'RETROCESO BLOQUEADO · OBSTÁCULO TRASERO',
        NivelAlerta.aviso,
        corta: 'ATRÁS BLOQ.',
      );
    case 'fallo_sensor_frente':
      return const ParadaInfo(
        'PARADA · FALLO DE SENSOR FRONTAL',
        NivelAlerta.critica,
        corta: 'FALLO SENSOR',
      );
    case 'fallo_sensor_atras':
      return const ParadaInfo(
        'RETROCESO BLOQUEADO · FALLO DE SENSOR TRASERO',
        NivelAlerta.aviso,
        corta: 'ATRÁS BLOQ.',
      );
    case 'corte_bateria':
      return const ParadaInfo(
        'CORTE POR BATERÍA (≤ 9,90 V)',
        NivelAlerta.critica,
        corta: 'CORTE BATERÍA',
      );
    case 'timeout':
      return const ParadaInfo(
        'DETENIDO · 5 s SIN ÓRDENES',
        NivelAlerta.aviso,
        corta: 'SIN ÓRDENES',
      );
    case 'red':
      return const ParadaInfo(
        'DETENIDO · SIN RED',
        NivelAlerta.aviso,
        corta: 'SIN RED',
      );
    case 'arranque':
      return const ParadaInfo(
        'ARRANQUE (1,5 s)',
        NivelAlerta.aviso,
        corta: 'ARRANQUE',
      );
    default:
      return const ParadaInfo('LIBRE', null);
  }
}

/// Estado de la batería según los umbrales del firmware.
enum NivelBateria { nominal, aviso, corte, sinMedida }

NivelBateria nivelBateria(Estado? e) {
  if (e == null || !e.hayBateriaMedida) return NivelBateria.sinMedida;
  if (e.bateriaV <= 9.90) return NivelBateria.corte;
  if (e.bateriaV <= 10.30) return NivelBateria.aviso;
  return NivelBateria.nominal;
}

/// Formatos
String metros(double cm) => (cm / 100).toStringAsFixed(2);

String signo(double v, {int decimales = 1}) =>
    '${v >= 0 ? '+' : '−'}${v.abs().toStringAsFixed(decimales)}';

String horaCorta(DateTime d) {
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${dos(d.hour)}:${dos(d.minute)}:${dos(d.second)}';
}
