import 'package:flutter/foundation.dart';

/// Rol de la sesión local.
enum RolUsuario {
  operador('OPERADOR', 'Operador'),
  administrador('ADMIN', 'Administrador');

  const RolUsuario(this.etiqueta, this.nombre);

  /// Texto corto en mayúsculas para chips y etiquetas.
  final String etiqueta;

  /// Nombre legible del rol.
  final String nombre;
}

/// **Autenticación local (mock).** Guarda en memoria quién entró y con qué rol.
///
/// No hay backend: las cuentas viven en `RegistroUsuarios` (memoria), no se
/// guarda nada en el dispositivo y la sesión se pierde al cerrar la app. Sirve para mostrar el
/// flujo Login → Telemetría → Perfil → Cerrar sesión y para separar la vista de
/// Operador de la de Administrador.
class SesionLocal extends ChangeNotifier {
  RolUsuario? _rol;
  String _usuario = '';
  String _nombre = '';
  bool _demo = false;
  DateTime? _inicio;

  /// `null` mientras no haya iniciado sesión (se muestra el Login).
  RolUsuario? get rol => _rol;
  bool get activa => _rol != null;

  /// Nombre de usuario con el que se entró (`admin`, `usuario`, ...).
  String get usuario => _usuario;

  /// Nombre para mostrar (`Administrador demo`, `Ana Pérez`, ...).
  String get nombre => _nombre;

  /// `true` si se entró con el botón "Modo Demo (Offline)".
  bool get demo => _demo;

  /// Momento en que se inició la sesión local.
  DateTime? get inicio => _inicio;

  /// Tiempo transcurrido desde el inicio de sesión.
  Duration duracion([DateTime? ahora]) {
    final DateTime? i = _inicio;
    if (i == null) return Duration.zero;
    return (ahora ?? DateTime.now()).difference(i);
  }

  void iniciar(
    RolUsuario rol, {
    required String usuario,
    String? nombre,
    bool demo = false,
    DateTime? ahora,
  }) {
    _rol = rol;
    _usuario = usuario.trim();
    _nombre = (nombre ?? '').trim().isEmpty ? rol.nombre : nombre!.trim();
    _demo = demo;
    _inicio = ahora ?? DateTime.now();
    notifyListeners();
  }

  void cerrar() {
    if (_rol == null) return;
    _rol = null;
    _usuario = '';
    _nombre = '';
    _demo = false;
    _inicio = null;
    notifyListeners();
  }
}
