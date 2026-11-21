import assert from 'node:assert/strict';
import {ESPERA_LWT_S, PERDIDA, TELEMETRIA, TOPICOS, decidePerdida, entregaConPerdida, estadoRobot, proximaTelemetriaMs, publicar, qosEfectivo, tramo} from './protocolo.js';
const nombres = (t) => t.paquetes.map((p) => p.paquete).join(',');
let p = publicar('ordenes', 'app', 'robot', 0);
assert.equal(nombres(p.tramos[0]), 'PUBLISH'); assert.equal(nombres(p.tramos[1]), 'PUBLISH');
p = publicar('ordenes', 'app', 'robot', 1);
assert.equal(nombres(p.tramos[0]), 'PUBLISH,PUBACK'); assert.equal(nombres(p.tramos[1]), 'PUBLISH,PUBACK');
// QoS 2 publicado por la app: el robot se suscribió con QoS 1, el broker baja el segundo tramo a QoS 1
p = publicar('ordenes', 'app', 'robot', 2);
assert.equal(p.qos2, 1);
assert.equal(nombres(p.tramos[0]), 'PUBLISH,PUBREC,PUBREL,PUBCOMP'); assert.equal(nombres(p.tramos[1]), 'PUBLISH,PUBACK');
// alertas: el robot publica con 2 y la app se suscribe con 2: los dos tramos con 4 pasos
p = publicar('alertas', 'robot', 'app', 2);
assert.equal(p.qos2, 2); assert.equal(nombres(p.tramos[1]), 'PUBLISH,PUBREC,PUBREL,PUBCOMP');
// sentidos: PUBREC vuelve hacia quien publicó
const t = tramo('app', 'broker', 2);
assert.deepEqual(t.map((x) => x.de + '>' + x.a), ['app>broker', 'broker>app', 'app>broker', 'broker>app']);
assert.equal(qosEfectivo(0, 2), 0); assert.equal(ESPERA_LWT_S, 22.5);
assert.deepEqual(Object.fromEntries(Object.entries(TOPICOS).map(([k, v]) => [k, v.qos])), {estado: 0, ordenes: 1, ack: 1, alertas: 2, conexion: 1});
// telemetría: QoS 0 por el buzón estado, cada 1 a 1,5 s, un PUBLISH por tramo (sin confirmación)
assert.equal(TOPICOS[TELEMETRIA.clave].qos, 0); assert.equal(TELEMETRIA.qos, 0);
p = publicar('estado', 'robot', 'app', 0);
assert.equal(nombres(p.tramos[0]), 'PUBLISH'); assert.equal(nombres(p.tramos[1]), 'PUBLISH'); assert.equal(p.qos2, 0);
assert.equal(proximaTelemetriaMs(() => 0), 1000); assert.equal(proximaTelemetriaMs(() => 1), 1500); assert.equal(proximaTelemetriaMs(() => 0.5), 1250);
assert.equal(estadoRobot(3, 2).n, 3);
// pérdida de red: sin el interruptor nunca se pierde nada
assert.equal(decidePerdida(0, 0, () => 0, false), false); assert.equal(decidePerdida(2, 0, () => 0, false), false);
// con el interruptor: QoS 0 se pierde si el azar cae bajo la probabilidad, y no reintenta
assert.equal(decidePerdida(0, 0, () => PERDIDA.prob - 0.01, true), true); assert.equal(decidePerdida(0, 0, () => PERDIDA.prob + 0.01, true), false);
assert.deepEqual(entregaConPerdida(0, () => 0, true), {entregado: false, intentos: 1});
assert.deepEqual(entregaConPerdida(0, () => 0.99, true), {entregado: true, intentos: 1});
// QoS 1 y 2 reintentan hasta que llega: con el azar siempre en contra, pasa al cuarto intento
for (const q of [1, 2]) assert.deepEqual(entregaConPerdida(q, () => 0, true), {entregado: true, intentos: PERDIDA.maxSeguidas + 1});
assert.deepEqual(entregaConPerdida(1, () => 0.99, true), {entregado: true, intentos: 1});
// estadística: con 40 % de pérdida, QoS 0 entrega ≈ 60 % y QoS 1 y 2 entregan el 100 % (con reintentos)
let sem = 7; const azar = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
const prueba = (q) => { let ok = 0, ints = 0; for (let i = 0; i < 4000; i++) { const r = entregaConPerdida(q, azar, true); ok += r.entregado; ints += r.intentos; } return {tasa: ok / 4000, ints: ints / 4000}; };
const q0 = prueba(0), q1 = prueba(1), q2 = prueba(2);
assert.ok(q0.tasa > 0.55 && q0.tasa < 0.65, 'QoS 0 entrega ' + q0.tasa);
assert.equal(q1.tasa, 1); assert.equal(q2.tasa, 1);
assert.ok(q1.ints > 1.3 && q1.ints < 1.9, 'reintentos QoS 1: ' + q1.ints);
console.log('protocolo: todo bien');
