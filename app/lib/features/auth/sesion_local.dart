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

/// Cuentas de demostración que ofrece la pantalla de acceso. No existen en
/// ningún servidor: son solo el correo que se rellena según el rol elegido.
const Map<RolUsuario, String> correoDemoPorRol = <RolUsuario, String>{
  RolUsuario.operador: 'operador@ucab.edu.ve',
  RolUsuario.administrador: 'admin@ucab.edu.ve',
};

/// **Autenticación local (mock).** Guarda en memoria quién entró y con qué rol.
///
/// No hay backend: no se verifica ninguna contraseña, no se guarda nada en el
/// dispositivo y la sesión se pierde al cerrar la app. Sirve para mostrar el
/// flujo Login → Telemetría → Perfil → Cerrar sesión y para separar la vista de
/// Operador de la de Administrador.
class SesionLocal extends ChangeNotifier {
  RolUsuario? _rol;
  String _correo = '';
  bool _demo = false;
  DateTime? _inicio;

  /// `null` mientras no haya iniciado sesión (se muestra el Login).
  RolUsuario? get rol => _rol;
  bool get activa => _rol != null;
  String get correo => _correo;

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
    required String correo,
    bool demo = false,
    DateTime? ahora,
  }) {
    _rol = rol;
    _correo = correo.trim();
    _demo = demo;
    _inicio = ahora ?? DateTime.now();
    notifyListeners();
  }

  void cerrar() {
    if (_rol == null) return;
    _rol = null;
    _correo = '';
    _demo = false;
    _inicio = null;
    notifyListeners();
  }
}
