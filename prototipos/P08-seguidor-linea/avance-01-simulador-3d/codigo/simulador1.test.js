/* Pruebas del Simulador 1 de aprendizaje progresivo (P08): las dos pistas, la lectura de la línea, los modos manual/automático
 * y los datos en vivo. Solo la parte sin three.js: no necesita navegador ni dependencias.
 * Uso:  node prototipos/P08-seguidor-linea/avance-01-simulador-3d/codigo/simulador1.test.js */
import assert from 'node:assert';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crearGranito} from './granito.js';
import {leerSensores, binarios} from './linea.js';
import {R} from './model.js';
import {IDS_PISTA, PISTAS, ZONA, ZONA_B, crearPista, ocultarTramo, tramoEn} from './pista.js';
import {GEOM, crearSim} from './sim.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const leer = (f) => readFileSync(join(aqui, f), 'utf8');
const especificacion = JSON.parse(readFileSync(join(aqui, '../../../../specs/pista_canonica.json'), 'utf8'));
let ok = 0;
const prueba = (nombre, f) => {
  f();
  ok++;
  console.log('  OK   ' + nombre);
};
const conGranito = (P) => crearGranito(P).gran;
const correr = (sim, seg) => {
  for (let t = 0; t < seg; t += 0.05) sim.avanzar(0.05);
};

prueba('hay dos pistas seleccionables, A y B', () => {
  assert.deepStrictEqual(IDS_PISTA, ['A', 'B']);
  assert.ok(PISTAS.A.nombre.includes('histórico') && PISTAS.B.nombre.includes('canónica'));
  assert.throws(() => crearPista('Z'));
});

prueba('Pista A conserva el circuito histórico de 8,05 m y su curva de 22 cm', () => {
  const P = crearPista('A');
  assert.ok(Math.abs(P.largo - 8.05) < 0.006, `largo ${P.largo}`);
  assert.ok(Math.abs(P.rmin - 0.22) < 0.005, `rmin ${P.rmin}`);
  assert.strictEqual(P.tramos.length, 1);
});

prueba('Pista B mide 9,0 m como la pista canónica y sus tramos son los de specs/pista_canonica.json', () => {
  const P = crearPista('B');
  assert.strictEqual(especificacion.longitudTotalM, 9.0);
  assert.ok(Math.abs(P.largo - especificacion.longitudTotalM) < 0.006, `largo ${P.largo}`);
  assert.strictEqual(P.tramos.length, especificacion.tramos.length);
  especificacion.tramos.forEach((t, i) => {
    assert.strictEqual(P.tramos[i].id, t.id);
    assert.strictEqual(P.tramos[i].desdeM, t.desdeM);
    assert.strictEqual(P.tramos[i].hastaM, t.hastaM);
  });
  assert.strictEqual(especificacion.anchoCintaMm, 19);
  assert.ok(Math.hypot(P.X[0] - P.X[P.N - 1], P.Z[0] - P.Z[P.N - 1]) < 0.0075); // circuito cerrado
});

prueba('Pista B tiene otra geometría: rectas largas, curvas técnicas y cabe en su zona del piso', () => {
  const A = crearPista('A');
  const B = crearPista('B');
  assert.ok(B.largo > A.largo);
  assert.ok(B.rmin >= 0.25 && B.rmin < 0.3, `rmin ${B.rmin}`); // curvas cerradas, pero más suaves que las de 22 cm
  // la recta más larga (radio enorme seguido) supera 3,4 m
  let mejor = 0;
  let cur = 0;
  for (let k = 0; k < 2 * B.N; k++) {
    if (B.RAD[k % B.N] > 20) cur++;
    else cur = 0;
    mejor = Math.max(mejor, cur);
  }
  assert.ok(mejor * B.paso >= 3.4, `recta ${mejor * B.paso}`);
  for (let i = 0; i < B.N; i++) {
    assert.ok(B.X[i] > ZONA_B.x0 && B.X[i] < ZONA_B.x0 + ZONA_B.ancho && B.Z[i] > ZONA_B.z0 && B.Z[i] < ZONA_B.z0 + ZONA_B.alto);
  }
  assert.ok(A.X.every((x, i) => x > ZONA.x0 && x < ZONA.x0 + ZONA.ancho && A.Z[i] > ZONA.z0 && A.Z[i] < ZONA.z0 + ZONA.alto));
});

prueba('el tramo T2 de la pista B es recto (listo para retirar la cinta con heading hold)', () => {
  const B = crearPista('B');
  for (let m = 3.0; m < 4.5; m += B.paso) assert.ok(B.RAD[Math.round(m / B.paso)] > 20, `curva en ${m} m`);
  assert.strictEqual(tramoEn(B, Math.round(3.5 / B.paso)).id, 'T2');
  assert.strictEqual(tramoEn(B, Math.round(8.0 / B.paso)).id, 'T4');
});

prueba('automático: da vueltas en la pista A con los resultados históricos (≈ 19,7 s, 0,41 m/s, 0 salidas)', () => {
  const s = crearSim({pistaId: 'A', modo: 'auto', fabricaGran: conGranito});
  correr(s, 62);
  const L = s.lectura();
  assert.ok(L.vueltas >= 3, `vueltas ${L.vueltas}`);
  assert.ok(Math.abs(L.ultimaVuelta - 19.7) < 0.6, `vuelta ${L.ultimaVuelta}`);
  assert.strictEqual(L.salidas, 0);
  const r = s.resumen()[0];
  assert.ok(r.vmedia > R.meta[0] && r.vmedia < R.meta[1], `vel ${r.vmedia}`);
  assert.ok(r.emax < 25, `emax ${r.emax}`);
});

prueba('automático: da vueltas en la pista B (9,0 m) sin salirse y dentro de 0,35–0,6 m/s', () => {
  const s = crearSim({pistaId: 'B', modo: 'auto', fabricaGran: conGranito});
  correr(s, 70);
  const L = s.lectura();
  assert.ok(L.vueltas >= 3, `vueltas ${L.vueltas}`);
  assert.strictEqual(L.salidas, 0);
  const r = s.resumen()[0];
  assert.ok(r.vmedia > R.meta[0] && r.vmedia < R.meta[1], `vel ${r.vmedia}`);
  assert.ok(r.emax < 45, `emax ${r.emax}`);
  // recorrió los cuatro tramos y midió su tiempo
  assert.deepStrictEqual(Object.keys(s.tiemposTramo).sort(), ['T1', 'T2', 'T3', 'T4']);
});

prueba('los 4 TCRT5000 muestran [0/1,0/1,0/1,0/1]: centrado en la cinta lee [0,1,1,0] y el error lateral cambia con el lado', () => {
  const s = crearSim({pistaId: 'A', modo: 'auto'}); // piso liso
  const L0 = s.lectura();
  assert.strictEqual(L0.bin.length, 4);
  assert.ok(L0.bin.every((b) => b === 0 || b === 1));
  assert.ok(L0.bin.some((b) => b === 1)); // en la salida ya ve la cinta
  const vistos = new Set();
  for (let t = 0; t < 12; t += 0.05) {
    s.avanzar(0.05);
    vistos.add(s.lectura().bin.join(''));
  }
  assert.ok(vistos.has('0110'), [...vistos].join()); // centrado en la cinta: [0,1,1,0]
  s.reiniciar();
  s.avanzar(0.02);
  assert.ok(Math.abs(s.lectura().eMedido) < 12);
  // si el robot se corre a un lado, el error medido cambia de signo con el lado
  s.eje.x += Math.cos(s.eje.th) * 0.012;
  s.eje.z -= Math.sin(s.eje.th) * 0.012; // 12 mm a la izquierda: la línea queda a la derecha
  s.avanzar(0.011);
  const izq = s.lectura();
  assert.ok(izq.eMedido < -3, `e ${izq.eMedido}`);
  assert.ok(izq.eReal < -8, `real ${izq.eReal}`);
});

prueba('la lectura de la línea respeta la máscara de cinta: retirar T2 deja los sensores en piso (base de los simuladores futuros)', () => {
  const B = crearPista('B');
  const i = Math.round(3.75 / B.paso);
  const eje = {x: B.X[i] - B.TX[i] * GEOM.adelante, z: B.Z[i] - B.TZ[i] * GEOM.adelante, th: Math.atan2(B.TX[i], B.TZ[i])};
  const rnd = () => 0.5;
  const lee = () => binarios(leerSensores(B, eje, GEOM.sep, GEOM.adelante, null, rnd, i).map((l) => ({...l})).map((l) => (l.raw - R.adcPiso) / (R.adcCinta - R.adcPiso)).map((v) => (v < R.umbral ? 0 : v)));
  assert.ok(lee().some((b) => b === 1));
  ocultarTramo(B, 3.0, 4.5);
  assert.deepStrictEqual(lee(), [0, 0, 0, 0]);
  assert.strictEqual(B.tramos[1].linea, false);
  assert.strictEqual(B.cinta[Math.round(2.9 / B.paso)], 1); // fuera del tramo sigue la cinta
  ocultarTramo(B, 3.0, 4.5, true);
  assert.ok(lee().some((b) => b === 1));
});

prueba('manual: W/↑ avanza, A/D giran, S retrocede y Espacio frena de inmediato', () => {
  const s = crearSim({pistaId: 'A', modo: 'manual'});
  s.entrada.f = 1;
  correr(s, 2);
  assert.ok(s.v > 0.4 && s.v < 0.5, `v ${s.v}`);
  s.entrada.t = 1;
  const th0 = s.eje.th;
  correr(s, 0.5);
  assert.ok(s.eje.th > th0, 'gira a la izquierda');
  s.entrada.t = -1;
  correr(s, 1);
  assert.ok(s.pwm.izq > s.pwm.der, 'a la derecha la rueda izquierda va más rápido');
  s.entrada.t = 0;
  s.entrada.f = -1;
  correr(s, 2);
  assert.ok(s.v < -0.3, `v ${s.v}`);
  s.entrada.f = 1;
  correr(s, 1.5);
  s.entrada.freno = true;
  correr(s, 0.3);
  assert.ok(Math.abs(s.v) < 0.01, `v tras frenar ${s.v}`);
});

prueba('manual y automático se alternan; manual fuera de la cinta cuenta una salida de línea', () => {
  const s = crearSim({pistaId: 'A', modo: 'auto', fabricaGran: conGranito});
  correr(s, 3);
  assert.strictEqual(s.modo, 'auto');
  s.setModo('manual');
  s.entrada.f = 1;
  s.entrada.t = 1;
  correr(s, 3);
  assert.strictEqual(s.modo, 'manual');
  assert.ok(s.salidas >= 1, `salidas ${s.salidas}`);
  s.entrada.f = s.entrada.t = 0;
  s.setModo('auto');
  assert.strictEqual(s.modo, 'auto');
  const claves = s.resumen().map((r) => `${r.pista}·${r.modo}`).sort();
  assert.deepStrictEqual(claves, ['A·auto', 'A·manual']);
});

prueba('la comparación guarda datos separados por pista y modo, y reiniciar vuelve a la salida', () => {
  const s = crearSim({pistaId: 'A', modo: 'auto'});
  correr(s, 5);
  s.setPista('B');
  assert.strictEqual(s.pistaId, 'B');
  correr(s, 5);
  const claves = s.resumen().map((r) => `${r.pista}·${r.modo}`).sort();
  assert.deepStrictEqual(claves, ['A·auto', 'B·auto']);
  s.reiniciar();
  assert.ok(Math.hypot(s.eje.x - s.P.X[0], s.eje.z - s.P.Z[0]) < 1e-9);
  assert.strictEqual(s.salidas, 0);
  assert.strictEqual(s.resumen().length, 2); // lo acumulado no se pierde al reiniciar
});

prueba('el panel tiene todos los datos: lectura, error, velocidad, distancia, rumbo, vuelta/tramo y salidas', () => {
  const s = crearSim({pistaId: 'B', modo: 'auto'});
  correr(s, 4);
  const L = s.lectura();
  for (const k of ['bin', 'raw', 'eMedido', 'eReal', 'v', 'distancia', 'rumbo', 'tVuelta', 'vuelta', 'tramo', 'salidas', 'pwm']) assert.ok(k in L, k);
  assert.ok(L.distancia > 1 && L.v > 0.3);
  assert.ok(L.rumbo >= -180 && L.rumbo <= 180);
  assert.strictEqual(L.tramo.id, 'T1');
});

prueba('la definición de la pista, la lectura de la línea y el motor están separados', () => {
  const pista = leer('pista.js');
  const linea = leer('linea.js');
  const modelo = leer('model.js');
  assert.ok(!/from '\.\/(linea|model|sim)\.js'/.test(pista), 'pista.js no depende de la lectura ni del motor');
  assert.ok(!/from '\.\/(sim|pista)\.js'/.test(modelo) && !/from 'three'/.test(modelo), 'model.js solo es física');
  assert.ok(/from '\.\/pista\.js'/.test(linea) && !/from 'three'/.test(linea), 'linea.js lee la línea sobre la pista');
  assert.ok(/P\.cinta/.test(linea), 'linea.js respeta la máscara de cinta');
  assert.ok(/export function ocultarTramo/.test(pista));
});

prueba('control: teclado (W A S D, flechas, Espacio), D-Pad táctil (pointerdown, touchstart, touchend) y botón STOP', () => {
  const main = leer('main.js');
  for (const c of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']) assert.ok(main.includes(c), c);
  for (const e of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) assert.ok(main.includes(`'${e}'`), e);
  const html = leer('plantilla.html');
  for (const d of ['arriba', 'abajo', 'izq', 'der', 'stop']) assert.ok(html.includes(`data-dp="${d}"`), d);
  assert.ok(/data-modo="manual"/.test(html) && /data-modo="auto"/.test(html));
  assert.ok(/data-pista="A"/.test(html) && /data-pista="B"/.test(html));
});

prueba('terminología: aprendizaje progresivo y teach-and-repeat; sin términos de otras tecnologías', () => {
  const todo = ['main.js', 'sim.js', 'pista.js', 'plantilla.html', 'linea.js'].map(leer).join('\n');
  assert.ok(/aprendizaje progresivo/i.test(todo));
  const prohibido = new RegExp(['\\bI', 'A\\b|inteligencia ', 'artificial'].join(''), 'i'); // sin escribir la sigla completa
  assert.ok(!prohibido.test(todo));
  assert.ok(!/FOLLOW_LINE|HEADING_HOLD|WAIT_BEACON|REACQUIRE_LINE/.test(todo), 'no copia la máquina de estados de teach-and-repeat');
});

console.log(`\nP08 Simulador 1: ${ok}/${ok} pruebas pasaron`);
