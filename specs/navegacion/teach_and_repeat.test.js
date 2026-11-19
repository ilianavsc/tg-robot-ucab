'use strict';

/*
 * Harness determinista del núcleo "teach-and-repeat".
 * Sin dependencias: usa el módulo assert de Node y la spec canónica.
 *
 * Ejecutar:  node specs/navegacion/teach_and_repeat.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const nav = require('./teach_and_repeat.js');
const ESTADO = nav.ESTADO;
const NOMBRE_ESTADO = nav.NOMBRE_ESTADO;
const CFG = nav.CFG;
const nuevoNav = nav.nuevoNav;
const paso = nav.paso;

let total = 0;
let fallos = 0;

function caso(nombre, fn) {
  total++;
  try {
    fn();
    console.log('  \u2713 ' + nombre);
  } catch (e) {
    fallos++;
    console.error('  \u2717 ' + nombre + '\n      ' + e.message);
  }
}

/* Construye un paquete de entradas con valores por defecto cómodos. */
function entradas(over) {
  return {
    n: [0, 1, 1, 0],
    yaw: 0,
    rssi: -100,
    frenteCm: 200,
    dtMs: 100,
    tramoSinCinta: false,
    rumboTramo: 0,
    ...over
  };
}

console.log('Teach-and-repeat · test harness\n');

/* 1 · Recorrido nominal con línea + balizas SOLO en extremos */
caso('Nominal: sigue la línea y valida balizas solo en extremos', function () {
  const nav1 = nuevoNav();
  let o;

  // En B1 (inicio), RSSI alto: NO debe entrar en WAIT_BEACON.
  o = paso(nav1, entradas({ rssi: -50 }));
  assert.strictEqual(o.estado, ESTADO.FOLLOW_LINE);
  assert.strictEqual(o.evento, null);
  assert.strictEqual(o.llegada, false);
  assert.ok(Math.abs(o.vIzq - CFG.BASE_VEL) < 1e-9, 'centrado -> velocidad base');

  // Se aleja de B1: RSSI cae -> marca salida del inicio.
  o = paso(nav1, entradas({ rssi: -100 }));
  assert.strictEqual(nav1.haSalidoDeInicio, true);
  assert.strictEqual(o.estado, ESTADO.FOLLOW_LINE);

  // Desvío a la derecha (n=[0,0,1,0] -> linea_mm = -9): vIzq > vDer.
  o = paso(nav1, entradas({ n: [0, 0, 1, 0] }));
  assert.ok(o.vIzq > o.vDer, 'gira hacia la derecha');

  // Llega al extremo: RSSI -80 -> WAIT_BEACON.
  o = paso(nav1, entradas({ rssi: -80 }));
  assert.strictEqual(o.estado, ESTADO.WAIT_BEACON);
  assert.strictEqual(o.evento, 'beacon_detectado');

  // RSSI -52 -> llegada validada.
  o = paso(nav1, entradas({ rssi: -52 }));
  assert.strictEqual(o.llegada, true);
  assert.strictEqual(o.evento, 'llegada_validada');
  assert.strictEqual(nav1.llegada, true);
});

/* 2 · Tramo sin cinta: FOLLOW → LINE_LOST_CHECK → HEADING_HOLD → REACQUIRE → FOLLOW */
caso('Sin cinta: HEADING_HOLD mantiene rumbo y REACQUIRE reengancha', function () {
  const nav1 = nuevoNav();
  let o;

  o = paso(nav1, entradas({}));
  assert.strictEqual(o.estado, ESTADO.FOLLOW_LINE);

  // Pierde la línea (4 sensores a 0), ruta indica tramo sin cinta.
  o = paso(nav1, entradas({ n: [0, 0, 0, 0], tramoSinCinta: true, rumboTramo: 0 }));
  assert.strictEqual(o.estado, ESTADO.LINE_LOST_CHECK);
  assert.strictEqual(o.evento, 'linea_perdida');

  // Acumula 500 ms (5 ticks de 100 ms) para confirmar el hueco.
  for (let i = 0; i < 5; i++) {
    o = paso(nav1, entradas({ n: [0, 0, 0, 0], tramoSinCinta: true, rumboTramo: 0 }));
  }
  assert.strictEqual(o.estado, ESTADO.HEADING_HOLD);
  assert.strictEqual(o.evento, 'tramo_sin_cinta');

  // Deriva +2° -> corrige: vIzq = 0.80 - 0.04, vDer = 0.80 + 0.04.
  o = paso(nav1, entradas({ n: [0, 0, 0, 0], yaw: 2, tramoSinCinta: true, rumboTramo: 0 }));
  assert.strictEqual(o.estado, ESTADO.HEADING_HOLD);
  assert.ok(Math.abs(o.vIzq - (CFG.BASE_VEL - CFG.K_HEADING * 2)) < 1e-9, 'vIzq corregida');
  assert.ok(Math.abs(o.vDer - (CFG.BASE_VEL + CFG.K_HEADING * 2)) < 1e-9, 'vDer corregida');

  // Reaparece la línea -> REACQUIRE_LINE.
  o = paso(nav1, entradas({}));
  assert.strictEqual(o.estado, ESTADO.REACQUIRE_LINE);
  assert.strictEqual(o.evento, 'linea_reaparece');

  // Confirmación -> FOLLOW_LINE.
  o = paso(nav1, entradas({}));
  assert.strictEqual(o.estado, ESTADO.FOLLOW_LINE);
  assert.strictEqual(o.evento, 'linea_reenganchada');
});

/* 3 · WAIT_BEACON: rampa RSSI -80 → -52 */
caso('WAIT_BEACON: rampa RSSI -80 -> -52 valida llegada', function () {
  const nav1 = nuevoNav();
  nav1.estado = ESTADO.WAIT_BEACON;
  nav1.haSalidoDeInicio = true;
  let o;

  // Sin señal: espera quieto.
  o = paso(nav1, entradas({ rssi: -95 }));
  assert.strictEqual(o.estado, ESTADO.WAIT_BEACON);
  assert.strictEqual(o.vIzq, 0);
  assert.strictEqual(o.vDer, 0);

  // Detecta en -80: se acerca.
  o = paso(nav1, entradas({ rssi: -80 }));
  assert.strictEqual(o.evento, 'beacon_detectado');
  assert.ok(o.vIzq > 0);

  // Acercándose, aún no llega.
  o = paso(nav1, entradas({ rssi: -60 }));
  assert.strictEqual(o.estado, ESTADO.WAIT_BEACON);
  assert.strictEqual(o.llegada, false);

  // -52: llegada.
  o = paso(nav1, entradas({ rssi: -52 }));
  assert.strictEqual(o.llegada, true);
  assert.strictEqual(o.evento, 'llegada_validada');
});

/* 4 · Pérdida prolongada de línea (timeout de seguridad) */
caso('Pérdida prolongada: timeout de seguridad detiene el robot', function () {
  const nav1 = nuevoNav();
  let o = paso(nav1, entradas({})); // FOLLOW
  o = paso(nav1, entradas({ n: [0, 0, 0, 0] })); // LINE_LOST_CHECK
  assert.strictEqual(o.estado, ESTADO.LINE_LOST_CHECK);

  // 4000 ms = 40 ticks de 100 ms.
  for (let i = 0; i < 40; i++) {
    o = paso(nav1, entradas({ n: [0, 0, 0, 0] }));
    if (o.paradaSeguridad) break;
  }
  assert.strictEqual(o.paradaSeguridad, true);
  assert.strictEqual(o.evento, 'timeout_sin_linea');
  assert.strictEqual(o.vIzq, 0);
  assert.strictEqual(o.vDer, 0);
});

/* 5 · Deriva excesiva del giroscopio */
caso('Deriva excesiva (> 30°) detiene en HEADING_HOLD', function () {
  const nav1 = nuevoNav();
  nav1.estado = ESTADO.HEADING_HOLD;
  nav1.rumboObjetivo = 0;
  const o = paso(nav1, entradas({ n: [0, 0, 0, 0], yaw: 45 }));
  assert.strictEqual(o.paradaSeguridad, true);
  assert.strictEqual(o.evento, 'deriva_excesiva');
});

/* 6 · Obstáculo < 20 cm interrumpe FOLLOW_LINE y se reanuda */
caso('Obstáculo < 20 cm interrumpe FOLLOW_LINE', function () {
  const nav1 = nuevoNav();
  let o = paso(nav1, entradas({}));
  assert.ok(o.vIzq > 0);

  o = paso(nav1, entradas({ frenteCm: 15 }));
  assert.strictEqual(o.frenadoCritico, true);
  assert.strictEqual(o.vIzq, 0);
  assert.strictEqual(o.vDer, 0);
  assert.strictEqual(o.estado, ESTADO.FOLLOW_LINE); // estado sin cambiar

  o = paso(nav1, entradas({ frenteCm: 200 })); // despejado
  assert.strictEqual(o.frenadoCritico, false);
  assert.ok(o.vIzq > 0);
});

/* 7 · Obstáculo < 20 cm interrumpe HEADING_HOLD */
caso('Obstáculo < 20 cm interrumpe HEADING_HOLD', function () {
  const nav1 = nuevoNav();
  nav1.estado = ESTADO.HEADING_HOLD;
  nav1.rumboObjetivo = 0;
  const o = paso(nav1, entradas({ n: [0, 0, 0, 0], frenteCm: 10 }));
  assert.strictEqual(o.frenadoCritico, true);
  assert.strictEqual(o.estado, ESTADO.HEADING_HOLD);
  assert.strictEqual(o.vIzq, 0);
});

/* 8 · Precaución 20-50 cm reduce la velocidad a la mitad */
caso('Precaución (20-50 cm) reduce velocidad a la mitad', function () {
  const nav1 = nuevoNav();
  const o = paso(nav1, entradas({ frenteCm: 35 }));
  assert.strictEqual(o.precaucion, true);
  assert.ok(Math.abs(o.vIzq - CFG.BASE_VEL * 0.5) < 1e-9);
  assert.ok(Math.abs(o.vDer - CFG.BASE_VEL * 0.5) < 1e-9);
});

/* 9 · Consistencia con la fuente única de verdad */
caso('Consistencia con specs/pista_canonica.json', function () {
  const spec = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'pista_canonica.json'), 'utf8')
  );
  assert.strictEqual(spec.umbrales.paradaCriticaCm, CFG.UMBRAL_PARADA_CM);
  assert.strictEqual(spec.umbrales.precaucionCm, CFG.UMBRAL_AVISO_CM);
  assert.strictEqual(spec.umbrales.rssiDetecciondBm, CFG.RSSI_DETECTA_DBM);
  assert.strictEqual(spec.umbrales.rssiLlegadadBm, CFG.RSSI_LLEGADA_DBM);
  assert.strictEqual(spec.umbrales.driftMaximoGrados, CFG.DRIFT_MAX_GRADOS);
  assert.deepStrictEqual(spec.umbrales.posicionesSensoresMm, [27, 9, -9, -27]);
  assert.strictEqual(spec.balizasBLE.length, 2, 'exactamente 2 balizas');
  assert.ok(spec.balizasBLE.every((b) => b.extremo === 'inicio' || b.extremo === 'fin'), 'balizas solo en extremos');
  assert.deepStrictEqual(spec.estados, NOMBRE_ESTADO, 'los 5 estados exactos');
});

console.log('\nResultado: ' + (total - fallos) + '/' + total + ' pruebas en verde (' +
  (fallos === 0 ? 100 : Math.round(((total - fallos) / total) * 100)) + '%)');
process.exitCode = fallos === 0 ? 0 : 1;
