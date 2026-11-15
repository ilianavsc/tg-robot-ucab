// La lógica de MQTT del P01, sin three.js (se prueba en Node).
// Tópicos y QoS: los del sketch del robot y del banco de pruebas del P01.
export const BASE = 'ucab-tg-sf/robot/';
export const TOPICOS = {
  estado: {nombre: BASE + 'estado', qos: 0, de: 'robot', a: 'app', color: '#0F9D84', nota: 'cómo está el robot'},
  ordenes: {nombre: BASE + 'ordenes', qos: 1, de: 'app', a: 'robot', color: '#F2603D', nota: 'pedidos de componentes'},
  ack: {nombre: BASE + 'ordenes/ack', qos: 1, de: 'robot', a: 'app', color: '#0F9D84', nota: '"recibí tu pedido"'},
  alertas: {nombre: BASE + 'alertas', qos: 2, de: 'robot', a: 'app', color: '#6B4EE6', nota: 'alarmas'},
  conexion: {nombre: BASE + 'conexion', qos: 1, de: 'robot', a: 'app', color: '#F2B33D', nota: '"en línea" o "desconectado"'},
};

// Con qué QoS se suscribe cada uno (sketch: el robot a ordenes con 1; banco: la app a todo con 2).
export const SUSCRIPCION = {robot: 1, app: 2};
// MQTT entrega con el menor de los dos QoS: el del que publica y el de quien se suscribió.
export const qosEfectivo = (qosPublica, qosSuscribe) => Math.min(qosPublica, qosSuscribe);

export const PAQUETES = {
  0: [['PUBLISH', 'ida']],
  1: [['PUBLISH', 'ida'], ['PUBACK', 'vuelta']],
  2: [['PUBLISH', 'ida'], ['PUBREC', 'vuelta'], ['PUBREL', 'ida'], ['PUBCOMP', 'vuelta']],
};

// Un tramo (A -> B) con un QoS: la lista de paquetes que viajan, con su sentido.
export function tramo(a, b, qos) {
  return PAQUETES[qos].map(([paquete, sentido]) => ({paquete, de: sentido === 'ida' ? a : b, a: sentido === 'ida' ? b : a}));
}

// Publicar un mensaje: tramo 1 (quien publica -> broker) y tramo 2 (broker -> quien se suscribió).
export function publicar(topico, origen, destino, qos) {
  const q2 = qosEfectivo(qos, SUSCRIPCION[destino]);
  return {
    topico,
    qos1: qos,
    qos2: q2,
    tramos: [
      {qos: qos, paquetes: tramo(origen, 'broker', qos)},
      {qos: q2, paquetes: tramo('broker', destino, q2)},
    ],
  };
}

// Tiempo que el broker espera antes de dar al robot por caído: 1,5 × keepAlive (regla de MQTT).
export const KEEPALIVE_S = 15; // el del sketch
export const ESPERA_LWT_S = KEEPALIVE_S * 1.5;

export const pedido = (n) => ({id: 'P-' + String(n).padStart(4, '0'), componente: 'Resistencia 1k', cantidad: 5, estante: 'A3'});
export const confirmacion = (id, recibidas, t) => ({id, recibidas, t});
export const alarma = (n, t) => ({n, tipo: 'antirrobo', prueba: true, t});
