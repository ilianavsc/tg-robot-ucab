import 'package:flutter/foundation.dart';

/// Estado de entrega de una solicitud activa.
enum EstadoEntrega {
  enRuta('En ruta'),
  enDestino('En destino');

  const EstadoEntrega(this.etiqueta);

  /// Etiqueta legible para la tarjeta de misión.
  final String etiqueta;
}

/// Solicitud de transporte activa (pasos "Solicitud" y "Cierre" del flujo).
///
/// Estado local de UI: lo comparten el Dashboard y el formulario. No toca
/// `core/` ni el protocolo MQTT; solo guarda qué se pidió y adónde.
class SolicitudActiva extends ChangeNotifier {
  String? _componente;
  String? _destino;
  EstadoEntrega _estado = EstadoEntrega.enRuta;

  bool get haySolicitud => _componente != null && _destino != null;
  String? get componente => _componente;
  String? get destino => _destino;
  EstadoEntrega get estado => _estado;

  /// Crea una solicitud (Solicitud) y la deja "en ruta".
  void crear({required String componente, required String destino}) {
    _componente = componente;
    _destino = destino;
    _estado = EstadoEntrega.enRuta;
    notifyListeners();
  }

  /// Confirma la entrega (Cierre) y limpia la misión para una nueva solicitud.
  void confirmarEntrega() {
    _componente = null;
    _destino = null;
    _estado = EstadoEntrega.enRuta;
    notifyListeners();
  }
}
