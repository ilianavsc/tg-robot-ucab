import 'package:flutter/foundation.dart';

import '../../core/demo/simulacion_pista.dart';
import '../auth/sesion_local.dart';

/// Punto de la ruta guardada (estación o punto de control).
class PuntoRuta {
  const PuntoRuta({
    required this.nombre,
    required this.metros,
    this.estacion = false,
  });

  final String nombre;

  /// Posición sobre el circuito (m desde el Cuarto de Componentes).
  final double metros;

  /// `true` en las estaciones del trayecto (no se borran al aprender).
  final bool estacion;
}

/// **Aprendizaje de Ruta (solo Administrador).** Pasada virtual en la que el
/// Administrador marca puntos de control (*landmarks*) y guarda la ruta que
/// luego usa el Operador, más una vista previa de la **reducción progresiva de
/// cinta**.
///
/// Todo es SIL y en memoria. Una ruta aprendida solo guarda posiciones: el
/// robot real no recibe rutas (el firmware solo entiende `adelante`, `atras`,
/// giros, `frenar` y `auto`). La lectura de la MPU-6050 para mantener el rumbo
/// (*heading hold*) y el escaneo BLE de las balizas **[PENDIENTE DE
/// INTEGRACIÓN EN FIRMWARE]**: la vista previa solo muestra el principio.
///
/// Cada acción que cambia algo exige un [RolUsuario.administrador]; con
/// cualquier otro actor devuelve `false` y no modifica nada.
class AprendizajeRuta extends ChangeNotifier {
  AprendizajeRuta() {
    _guardada = _porDefecto();
  }

  /// Velocidad de la pasada virtual (m/s).
  static const double velocidadPasadaMs = 0.40;

  /// Largo del circuito simulado (m).
  static double get longitudM => SimulacionPista.longitudM;

  /// Separación mínima entre dos puntos (m) y máximo de puntos de control.
  static const double separacionMinimaM = 0.5;
  static const int maxPuntosControl = 6;

  static List<PuntoRuta> _porDefecto() {
    final Map<DestinoPista, double> p = SimulacionPista.posiciones;
    return <PuntoRuta>[
      PuntoRuta(
        nombre: DestinoPista.cuartoComponentes.nombre,
        metros: p[DestinoPista.cuartoComponentes]!,
        estacion: true,
      ),
      PuntoRuta(
        nombre: DestinoPista.puntoControl.nombre,
        metros: p[DestinoPista.puntoControl]!,
      ),
      PuntoRuta(
        nombre: DestinoPista.laboratorio1.nombre,
        metros: p[DestinoPista.laboratorio1]!,
        estacion: true,
      ),
    ];
  }

  late List<PuntoRuta> _guardada;
  List<PuntoRuta> _borrador = <PuntoRuta>[];
  bool _aprendiendo = false;
  double _posicionM = 0;
  int _nivelReduccion = 0;
  bool _vistaReduccion = false;

  /// Ruta guardada (la que usa el Operador), ordenada por posición.
  List<PuntoRuta> get guardada => List<PuntoRuta>.unmodifiable(_guardada);

  /// Puntos de control de la ruta guardada (sin las estaciones).
  List<PuntoRuta> get puntosDeControl => List<PuntoRuta>.unmodifiable(
    _guardada.where((PuntoRuta p) => !p.estacion),
  );

  bool get aprendiendo => _aprendiendo;
  double get posicionM => _posicionM;
  double get progreso => (_posicionM / longitudM).clamp(0.0, 1.0);
  bool get pasadaCompleta => _aprendiendo && _posicionM >= longitudM;

  /// Puntos marcados en la pasada en curso.
  List<PuntoRuta> get borrador => List<PuntoRuta>.unmodifiable(_borrador);

  /// Posiciones de los puntos de control como fracción del circuito (el mapa
  /// del Operador las dibuja).
  List<double> get fraccionesControl =>
      puntosDeControl.map((PuntoRuta p) => p.metros / longitudM).toList();

  // --------------------------------------------------- reducción de cinta

  bool get vistaReduccion => _vistaReduccion;

  /// Tramos entre puntos consecutivos de la ruta guardada.
  int get tramos => _guardada.length - 1;

  /// Cuántos tramos (desde la salida) se muestran **sin cinta**.
  int get nivelReduccion => _nivelReduccion;

  /// Tramos que conservan la cinta.
  int get tramosConCinta => tramos - _nivelReduccion;

  bool activarVistaReduccion(RolUsuario? actor, bool activa) {
    if (actor != RolUsuario.administrador) return false;
    _vistaReduccion = activa;
    notifyListeners();
    return true;
  }

  /// Fija cuántos tramos van sin cinta (0 = cinta completa). Se acota entre
  /// 0 y el número de tramos.
  bool fijarNivelReduccion(RolUsuario? actor, int nivel) {
    if (actor != RolUsuario.administrador) return false;
    _nivelReduccion = nivel.clamp(0, tramos);
    notifyListeners();
    return true;
  }

  /// `true` si el tramo [i] (0 = el primero desde la salida) va sin cinta.
  bool tramoSinCinta(int i) => i < _nivelReduccion;

  // ------------------------------------------------------------- pasada

  /// Empieza una pasada virtual desde el Cuarto de Componentes.
  bool iniciarPasada(RolUsuario? actor) {
    if (actor != RolUsuario.administrador) return false;
    _aprendiendo = true;
    _posicionM = 0;
    _borrador = <PuntoRuta>[
      PuntoRuta(
        nombre: DestinoPista.cuartoComponentes.nombre,
        metros: 0,
        estacion: true,
      ),
    ];
    notifyListeners();
    return true;
  }

  /// Avanza la pasada [dt] segundos a [velocidadPasadaMs].
  void avanzar(double dt) {
    if (!_aprendiendo || _posicionM >= longitudM) return;
    _posicionM = (_posicionM + velocidadPasadaMs * dt).clamp(0.0, longitudM);
    notifyListeners();
  }

  /// Marca un punto de control en la posición actual. Devuelve `false` si no
  /// hay pasada, si está muy cerca de otro punto o si ya hay el máximo.
  bool marcarPunto(RolUsuario? actor, {String? nombre}) {
    if (actor != RolUsuario.administrador || !_aprendiendo) return false;
    final int controles = _borrador.where((PuntoRuta p) => !p.estacion).length;
    if (controles >= maxPuntosControl) return false;
    if (_borrador.any(
      (PuntoRuta p) => (p.metros - _posicionM).abs() < separacionMinimaM,
    )) {
      return false;
    }
    final String n = (nombre ?? '').trim().isEmpty
        ? 'Punto de control ${controles + 1}'
        : nombre!.trim();
    _borrador.add(PuntoRuta(nombre: n, metros: _posicionM));
    notifyListeners();
    return true;
  }

  /// Termina la pasada y guarda la ruta: el Cuarto de Componentes, los puntos
  /// marcados (al menos uno) y el Laboratorio 1 al final del recorrido.
  bool finalizarYGuardar(RolUsuario? actor) {
    if (actor != RolUsuario.administrador || !_aprendiendo) return false;
    final List<PuntoRuta> controles = _borrador
        .where((PuntoRuta p) => !p.estacion)
        .toList();
    if (controles.isEmpty) return false;
    final double fin = _posicionM < separacionMinimaM
        ? longitudM
        : _posicionM.clamp(0.0, longitudM);
    final List<PuntoRuta> nueva = <PuntoRuta>[
      _borrador.first,
      ...controles
        ..sort((PuntoRuta a, PuntoRuta b) => a.metros.compareTo(b.metros)),
      PuntoRuta(
        nombre: DestinoPista.laboratorio1.nombre,
        metros: fin,
        estacion: true,
      ),
    ];
    _guardada = nueva;
    _aprendiendo = false;
    _borrador = <PuntoRuta>[];
    _posicionM = 0;
    _nivelReduccion = _nivelReduccion.clamp(0, tramos);
    notifyListeners();
    return true;
  }

  /// Descarta la pasada en curso sin tocar la ruta guardada.
  bool descartarPasada(RolUsuario? actor) {
    if (actor != RolUsuario.administrador || !_aprendiendo) return false;
    _aprendiendo = false;
    _borrador = <PuntoRuta>[];
    _posicionM = 0;
    notifyListeners();
    return true;
  }

  /// Vuelve a la ruta por defecto (Cuarto → Punto de Control → Laboratorio 1).
  bool restablecer(RolUsuario? actor) {
    if (actor != RolUsuario.administrador) return false;
    _guardada = _porDefecto();
    _aprendiendo = false;
    _borrador = <PuntoRuta>[];
    _posicionM = 0;
    _nivelReduccion = 0;
    notifyListeners();
    return true;
  }
}
