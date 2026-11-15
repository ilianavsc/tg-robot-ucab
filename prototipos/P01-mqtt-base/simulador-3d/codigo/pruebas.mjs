import assert from 'node:assert/strict';
import {ESPERA_LWT_S, TOPICOS, publicar, qosEfectivo, tramo} from './protocolo.js';
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
console.log('protocolo: todo bien');
