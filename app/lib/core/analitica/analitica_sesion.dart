import '../models/estado.dart';
import '../models/ultrasonido.dart';

/// Muestra de telemetría guardada para el reporte CSV (una por `estado`).
class MuestraSesion {
  const MuestraSesion({
    required this.hora,
    required this.numero,
    required this.modo,
    required this.bateriaV,
    required this.velocidad,
    required this.lineaMm,
    required this.frenteCm,
    required this.atrasCm,
    required this.frenteOk,
    required this.atrasOk,
    required this.parada,
  });

  final DateTime hora;
  final int numero;
  final String modo;
  final double bateriaV;
  final double velocidad;
  final double lineaMm;
  final double? frenteCm;
  final double? atrasCm;
  final bool frenteOk;
  final bool atrasOk;
  final String parada;
}

/// Analítica de la sesión (P12). Dart puro: se prueba sin Flutter.
///
/// Acumula desde el último [reiniciar] (al detener el Modo Demo o al pulsar
/// "Reiniciar"):
///  * velocidad media y máxima (m/s) — velocidad lineal `|v_izq + v_der| / 2`;
///  * distancia frontal mínima **válida** (cm) — ignora 0 cm y sensor en fallo;
///  * error medio absoluto de línea (mm) — solo con la línea a la vista;
///  * total de paquetes (estado + ultrasonido + alertas);
///  * paradas de emergencia (obstáculo o fallo de sensor que se activa).
class AnaliticaSesion {
  /// Tope de muestras para el CSV (a una muestra cada 2 s son ≈ 66 min).
  /// Las métricas siguen acumulando aunque se llene.
  static const int maxMuestras = 2000;

  DateTime? _inicio;
  int _muestrasVel = 0;
  double _sumaVel = 0;
  double _velMax = 0;
  double? _frenteMin;
  int _muestrasLinea = 0;
  double _sumaErrLinea = 0;
  int _paquetesEstado = 0;
  int _paquetesUltrasonido = 0;
  int _paquetesAlertas = 0;
  int _paradasEmergencia = 0;
  Ultrasonido? _ultimoUltrasonido;
  final List<MuestraSesion> _muestras = <MuestraSesion>[];

  // ------------------------------------------------------------ métricas

  DateTime? get inicio => _inicio;
  double get velocidadMedia => _muestrasVel == 0 ? 0 : _sumaVel / _muestrasVel;
  double get velocidadMaxima => _velMax;

  /// `null` si todavía no hubo ninguna lectura frontal válida.
  double? get distanciaFrontalMinima => _frenteMin;

  double get errorMedioLinea =>
      _muestrasLinea == 0 ? 0 : _sumaErrLinea / _muestrasLinea;
  int get paquetesEstado => _paquetesEstado;
  int get paquetesUltrasonido => _paquetesUltrasonido;
  int get paquetesAlertas => _paquetesAlertas;
  int get totalPaquetes =>
      _paquetesEstado + _paquetesUltrasonido + _paquetesAlertas;
  int get paradasEmergencia => _paradasEmergencia;
  int get muestras => _muestrasVel;
  List<MuestraSesion> get historial =>
      List<MuestraSesion>.unmodifiable(_muestras);

  /// Duración desde el primer paquete de la sesión.
  Duration duracion([DateTime? ahora]) {
    final i = _inicio;
    if (i == null) return Duration.zero;
    return (ahora ?? DateTime.now()).difference(i);
  }

  // ------------------------------------------------------------ registro

  void registrarEstado(Estado e, {DateTime? ahora}) {
    final t = ahora ?? DateTime.now();
    _inicio ??= t;
    _paquetesEstado++;

    final v = e.velocidadMedia.abs();
    _muestrasVel++;
    _sumaVel += v;
    if (v > _velMax) _velMax = v;

    if (e.veLaLinea) {
      _muestrasLinea++;
      _sumaErrLinea += e.lineaMm.abs();
    }

    if (_muestras.length < maxMuestras) {
      final u = _ultimoUltrasonido;
      _muestras.add(MuestraSesion(
        hora: t,
        numero: e.numero,
        modo: e.modo,
        bateriaV: e.bateriaV,
        velocidad: v,
        lineaMm: e.lineaMm,
        frenteCm: u?.frenteCm,
        atrasCm: u?.atrasCm,
        frenteOk: u?.frenteOk ?? true,
        atrasOk: u?.atrasOk ?? true,
        parada: e.parada,
      ));
    }
  }

  void registrarUltrasonido(Ultrasonido u, {DateTime? ahora}) {
    _inicio ??= ahora ?? DateTime.now();
    _paquetesUltrasonido++;
    _ultimoUltrasonido = u;
    final f = u.frenteValido;
    if (f != null && (_frenteMin == null || f < _frenteMin!)) _frenteMin = f;
  }

  void registrarAlerta({DateTime? ahora}) {
    _inicio ??= ahora ?? DateTime.now();
    _paquetesAlertas++;
  }

  void registrarParadaEmergencia() => _paradasEmergencia++;

  /// Todo a cero.
  void reiniciar() {
    _inicio = null;
    _muestrasVel = 0;
    _sumaVel = 0;
    _velMax = 0;
    _frenteMin = null;
    _muestrasLinea = 0;
    _sumaErrLinea = 0;
    _paquetesEstado = 0;
    _paquetesUltrasonido = 0;
    _paquetesAlertas = 0;
    _paradasEmergencia = 0;
    _ultimoUltrasonido = null;
    _muestras.clear();
  }

  // ------------------------------------------------------------ CSV

  /// Reporte CSV: separador `;` y punto decimal (lo leen igual Excel,
  /// LibreOffice y pandas con `sep=';'`). Primero un bloque de resumen y luego
  /// una fila por muestra de `estado`.
  String toCsv({String origen = 'MQTT', DateTime? ahora}) {
    final t = ahora ?? DateTime.now();
    final b = StringBuffer()
      ..writeln('# Reporte de sesion · TG Robot UCAB (P12)')
      ..writeln('metrica;valor;unidad')
      ..writeln('generado;${_iso(t)};')
      ..writeln('origen;$origen;')
      ..writeln('inicio_sesion;${_inicio == null ? '' : _iso(_inicio!)};')
      ..writeln('duracion;${duracion(t).inSeconds};s')
      ..writeln('velocidad_media;${velocidadMedia.toStringAsFixed(3)};m/s')
      ..writeln('velocidad_maxima;${velocidadMaxima.toStringAsFixed(3)};m/s')
      ..writeln('distancia_frontal_minima;'
          '${_frenteMin == null ? '' : _frenteMin!.toStringAsFixed(1)};cm')
      ..writeln('error_medio_abs_linea;${errorMedioLinea.toStringAsFixed(2)};mm')
      ..writeln('paquetes_estado;$_paquetesEstado;')
      ..writeln('paquetes_ultrasonido;$_paquetesUltrasonido;')
      ..writeln('paquetes_alertas;$_paquetesAlertas;')
      ..writeln('paquetes_total;$totalPaquetes;')
      ..writeln('paradas_emergencia;$_paradasEmergencia;')
      ..writeln()
      ..writeln('hora;n;modo;bateria_v;velocidad_ms;linea_mm;frente_cm;'
          'atras_cm;frente_ok;atras_ok;parada');
    for (final m in _muestras) {
      b.writeln(<String>[
        _iso(m.hora),
        '${m.numero}',
        m.modo,
        m.bateriaV.toStringAsFixed(2),
        m.velocidad.toStringAsFixed(3),
        m.lineaMm.toStringAsFixed(1),
        m.frenteCm == null ? '' : m.frenteCm!.toStringAsFixed(1),
        m.atrasCm == null ? '' : m.atrasCm!.toStringAsFixed(1),
        '${m.frenteOk}',
        '${m.atrasOk}',
        m.parada,
      ].join(';'));
    }
    return b.toString();
  }

  static String _iso(DateTime d) => d.toIso8601String();
}
