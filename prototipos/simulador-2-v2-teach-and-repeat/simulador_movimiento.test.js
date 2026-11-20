/* Pruebas del Simulador 2 V2 (planta física + integración con el núcleo
 * teach-and-repeat compartido). No necesita navegador ni dependencias.
 * Uso:  node prototipos/simulador-2-v2-teach-and-repeat/simulador_movimiento.test.js */
"use strict";
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RAIZ = path.join(__dirname, "..", "..");
const N = require(path.join(RAIZ, "specs", "navegacion", "teach_and_repeat.js"));
const PISTA = require(path.join(RAIZ, "specs", "pista_canonica.json"));
const S = require("./simulador_movimiento.js");

let ok = 0;
function prueba(nombre, f) { f(); ok++; console.log("  OK   " + nombre); }

/* Corre hasta que f(sim) sea true o pasen maxS segundos (tick de 20 ms). */
function correr(sim, maxS, hasta) {
  const n = Math.round(maxS / 0.02);
  for (let i = 0; i < n; i++) {
    S.paso(sim, 20);
    if (hasta && hasta(sim)) return true;
  }
  return false;
}
function viajeCompleto(sim, maxS) {
  const estados = [];
  let ult = -1, maxY = 0;
  correr(sim, maxS || 60, (x) => {
    if (x.nav.estado !== ult) { ult = x.nav.estado; estados.push(N.NOMBRE_ESTADO[ult]); }
    maxY = Math.max(maxY, Math.abs(x.y));
    return x.llegadaCompleta || x.nav.paradaSeguridad;
  });
  return { estados, maxY };
}
const nueva = () => S.crear(N, PISTA);

prueba("consume la pista canónica: 9,0 m, 2 balizas en los extremos y cinta de T2 ausente", () => {
  const sim = nueva();
  assert.strictEqual(sim.L, 9.0);
  assert.strictEqual(sim.L, PISTA.longitudTotalM);
  assert.strictEqual(PISTA.balizasBLE.length, 2);
  assert.deepStrictEqual(PISTA.balizasBLE.map((b) => b.posicionM), [0, 9.0]);
  const huecos = S.huecosDeCinta(sim);
  assert.deepStrictEqual(huecos, [{ desdeM: 3.0, hastaM: 4.5 }]);
  assert.ok(S.hayCinta(sim, 2.9) && !S.hayCinta(sim, 3.5) && S.hayCinta(sim, 4.6));
});

prueba("viaje de ida nominal: FOLLOW_LINE → LINE_LOST_CHECK → HEADING_HOLD → REACQUIRE_LINE → FOLLOW_LINE → WAIT_BEACON y llegada validada", () => {
  const sim = nueva();
  const r = viajeCompleto(sim);
  assert.deepStrictEqual(r.estados, ["FOLLOW_LINE", "LINE_LOST_CHECK", "HEADING_HOLD", "REACQUIRE_LINE", "FOLLOW_LINE", "WAIT_BEACON"]);
  assert.ok(sim.llegadaCompleta);
  assert.ok(!sim.nav.paradaSeguridad);
  assert.ok(sim.s > 8.6 && sim.s <= 9.0, "llega junto a B2 (s=" + sim.s + ")");
  assert.ok(r.maxY < 0.02, "desvío lateral máximo " + r.maxY);
  assert.ok(sim.tHoldMs >= 0 && sim.maxErrHold < 1);
});

prueba("viaje de vuelta (Laboratorio 1 → Cuarto de Componentes) con el mismo núcleo", () => {
  const sim = nueva();
  viajeCompleto(sim);
  S.nuevoViaje(sim, -1);
  assert.strictEqual(sim.s, 9.0);
  const r = viajeCompleto(sim);
  assert.deepStrictEqual(r.estados, ["FOLLOW_LINE", "LINE_LOST_CHECK", "HEADING_HOLD", "REACQUIRE_LINE", "FOLLOW_LINE", "WAIT_BEACON"]);
  assert.ok(sim.llegadaCompleta && sim.s < 0.4, "llega a B1 (s=" + sim.s + ")");
});

prueba("sin 'haber salido' del inicio no se valida la baliza: arrancar junto a B1 no es llegada", () => {
  const sim = nueva();
  correr(sim, 1.0);
  assert.strictEqual(sim.nav.llegada, false);
  assert.strictEqual(sim.nav.haSalidoDeInicio, false);
  assert.strictEqual(N.NOMBRE_ESTADO[sim.nav.estado], "FOLLOW_LINE");
  assert.ok(S.rssiActual(sim).rssi >= -80, "junto a B1 el RSSI es alto");
});

prueba("retiro de cinta en un tramo NO enseñado: LINE_LOST_CHECK → timeout_sin_linea y parada latcheada", () => {
  const sim = nueva();
  S.setCinta(sim, 5.5, 6.0, false); /* hueco nuevo que la ruta enseñada no conoce */
  const r = viajeCompleto(sim);
  assert.ok(sim.nav.paradaSeguridad, "se detiene por seguridad");
  assert.ok(!sim.llegadaCompleta);
  assert.ok(r.estados.includes("LINE_LOST_CHECK"));
  const s0 = sim.s;
  correr(sim, 3);
  assert.strictEqual(sim.s, s0, "el latch no se reanuda solo");
  assert.ok(sim.eventos.some((e) => /timeout_sin_linea/.test(e.texto)));
});

prueba("tras ENSEÑAR el nuevo hueco, el robot lo cruza con HEADING_HOLD (2 tramos sin cinta)", () => {
  const sim = nueva();
  S.setCinta(sim, 5.5, 6.0, false);
  const t = S.ensenar(sim);
  assert.strictEqual(t.length, 2);
  const r = viajeCompleto(sim);
  assert.ok(sim.llegadaCompleta && !sim.nav.paradaSeguridad);
  const nHold = r.estados.filter((e) => e === "HEADING_HOLD").length;
  assert.strictEqual(nHold, 2);
});

prueba("retiro progresivo: hasta un hueco de 1,5 m el robot llega; con uno de 4,5 m (aun enseñado) el timeout de 4 s lo detiene", () => {
  const ok15 = nueva();
  assert.ok(S.tramoConCinta(ok15, 4.5, 7.5));
  S.setCinta(ok15, 6.0, 7.5, false); /* junto a T2 forma un hueco 3,0–4,5 y 6,0–7,5 */
  S.ensenar(ok15);
  viajeCompleto(ok15);
  assert.ok(ok15.llegadaCompleta, "dos huecos de 1,5 m enseñados se cruzan");

  const largo = nueva();
  S.setCinta(largo, 4.5, 7.5, false); /* T2+T3 sin cinta: hueco de 4,5 m */
  S.ensenar(largo);
  viajeCompleto(largo);
  assert.ok(largo.nav.paradaSeguridad && !largo.llegadaCompleta);
  assert.ok(largo.eventos.some((e) => /timeout_sin_linea/.test(e.texto)));
});

prueba("hueco de cinta que termina en el extremo: HEADING_HOLD → WAIT_BEACON directo (sin REACQUIRE_LINE) y llegada validada", () => {
  const sim = nueva();
  S.setCinta(sim, 7.5, 9.0, false); /* T4 sin cinta: la baliza B2 es lo único que valida el final */
  S.ensenar(sim);
  const r = viajeCompleto(sim);
  assert.ok(sim.llegadaCompleta && !sim.nav.paradaSeguridad, "llega por baliza");
  const i = r.estados.lastIndexOf("HEADING_HOLD");
  assert.strictEqual(r.estados[i + 1], "WAIT_BEACON", "tras el último HEADING_HOLD va WAIT_BEACON: " + r.estados.join(" → "));
  assert.ok(sim.eventos.some((e) => /beacon_detectado/.test(e.texto)));
  assert.ok(sim.s > 8.6, "se detiene junto a B2");
});

prueba("el hueco de cinta lejos de un extremo no se acorta: > ~4,5 m sigue terminando en timeout_sin_linea (límite de 4 s intacto)", () => {
  assert.strictEqual(N.CFG.TIEMPO_MAX_SIN_LINEA_MS, 4000);
  const sim = nueva();
  S.setCinta(sim, 4.5, 7.5, false); /* junto a T2: hueco de 4,5 m sin baliza */
  S.ensenar(sim);
  viajeCompleto(sim);
  assert.ok(sim.nav.paradaSeguridad && !sim.llegadaCompleta);
  assert.ok(sim.eventos.some((e) => /timeout_sin_linea/.test(e.texto)));
  assert.ok(sim.s < 7.5, "se detuvo antes de llegar al extremo (s=" + sim.s + ")");
});

prueba("obstáculo < 20 cm: parada crítica (velocidad 0, estado intacto) y se reanuda al despejar", () => {
  const sim = nueva();
  correr(sim, 1.5);
  const estado = sim.nav.estado;
  S.forzarFrente(sim, 12);
  correr(sim, 0.8);
  assert.strictEqual(sim.ultimaSalida.frenadoCritico, true);
  assert.ok(Math.abs(sim.vLineal) < 0.02);
  assert.strictEqual(sim.nav.estado, estado, "el estado no cambia");
  assert.strictEqual(S.zonaFrente(sim, 12), "critica");
  const s0 = sim.s;
  S.quitarObstaculo(sim);
  correr(sim, 1.0);
  assert.ok(sim.s > s0 + 0.2, "reanuda");
});

prueba("precaución 20–50 cm: velocidad a la mitad", () => {
  const a = nueva(), b = nueva();
  correr(a, 1.5); correr(b, 1.5);
  S.forzarFrente(b, 35);
  correr(b, 1.0);
  correr(a, 1.0);
  assert.ok(b.ultimaSalida.precaucion);
  assert.strictEqual(S.zonaFrente(b, 35), "precaucion");
  const r = Math.abs(b.vLineal) / Math.abs(a.vLineal);
  assert.ok(r > 0.45 && r < 0.55, "relación de velocidades " + r);
});

prueba("obstáculo físico colocado delante: la lectura baja de forma continua y termina en parada crítica", () => {
  const sim = nueva();
  correr(sim, 1.0);
  S.inyectarObstaculo(sim, 0.9);
  let previa = S.frenteActualCm(sim), maxSalto = 0, vioPrecaucion = false, critica = false;
  correr(sim, 12, (x) => {
    const f = S.frenteActualCm(x);
    maxSalto = Math.max(maxSalto, Math.abs(f - previa));
    previa = f;
    if (f >= 20 && f < 50) vioPrecaucion = true;
    if (x.ultimaSalida && x.ultimaSalida.frenadoCritico) critica = true;
    return critica;
  });
  assert.ok(vioPrecaucion && critica);
  assert.ok(maxSalto < 2, "salto máximo " + maxSalto + " cm");
});

prueba("precaución dentro del tramo sin cinta: a media velocidad se agota el timeout de 4 s (comportamiento del núcleo)", () => {
  const sim = nueva();
  correr(sim, 7.0, (x) => N.NOMBRE_ESTADO[x.nav.estado] === "HEADING_HOLD");
  S.forzarFrente(sim, 35);
  correr(sim, 8);
  assert.ok(sim.nav.paradaSeguridad);
});

prueba("deriva del giroscopio: 0,5 °/s se tolera; 3 °/s hace perder la cinta al salir del tramo", () => {
  const suave = nueva();
  suave.sesgoDps = 0.5;
  viajeCompleto(suave);
  assert.ok(suave.llegadaCompleta, "con 0,5 °/s llega");
  assert.ok(Math.abs(suave.derivaPicoGrados) > 0.5, "la deriva acumulada se mide en HEADING_HOLD");

  const fuerte = nueva();
  fuerte.sesgoDps = 3;
  viajeCompleto(fuerte);
  assert.ok(!fuerte.llegadaCompleta && fuerte.nav.paradaSeguridad, "con 3 °/s no llega");
});

prueba("empujón de rumbo > 30° en HEADING_HOLD: deriva_excesiva y parada latcheada", () => {
  const sim = nueva();
  correr(sim, 8, (x) => N.NOMBRE_ESTADO[x.nav.estado] === "HEADING_HOLD");
  correr(sim, 0.5);
  S.empujon(sim, 40);
  correr(sim, 0.2);
  assert.ok(sim.nav.paradaSeguridad);
  assert.ok(sim.eventos.some((e) => /deriva_excesiva/.test(e.texto)));
});

prueba("BLE: la señal solo existe cerca de los EXTREMOS (-80 → -52 dBm) y a mitad de pasillo no hay baliza", () => {
  const sim = nueva();
  const rs = (s) => { sim.s = s; return S.rssiActual(sim); };
  assert.strictEqual(rs(0).rssi, -52);
  assert.strictEqual(rs(9).rssi, -52);
  assert.strictEqual(rs(1.5).rssi, -80);
  assert.strictEqual(rs(7.5).rssi, -80);
  assert.strictEqual(rs(7.5).baliza, "B2");
  assert.strictEqual(rs(1.0).baliza, "B1");
  for (let s = 1.6; s <= 7.4; s += 0.1) {
    assert.ok(rs(s).rssi < -80, "a " + s.toFixed(1) + " m no debe haber señal útil (" + rs(s).rssi + ")");
  }
  let previo = -200;
  for (let d = 1.5; d >= 0; d -= 0.05) {
    const r = S.rssiAUnaBaliza(d);
    assert.ok(r >= previo - 1e-9 && r <= -52 && r >= -80, "creciente en [-80,-52]");
    previo = r;
  }
});

prueba("Freno Remoto detiene en seco y 'auto' reanuda con el mismo estado del núcleo", () => {
  const sim = nueva();
  correr(sim, 2);
  const estado = sim.nav.estado;
  S.frenoRemoto(sim);
  correr(sim, 1);
  assert.ok(Math.abs(sim.vLineal) < 0.01);
  const s0 = sim.s;
  correr(sim, 1);
  assert.strictEqual(sim.s, s0);
  S.reanudar(sim);
  correr(sim, 1);
  assert.ok(sim.s > s0);
  assert.strictEqual(sim.nav.estado, estado);
});

prueba("modo manual: mueve, gira y respeta el fail-safe frontal (< 20 cm) y el trasero", () => {
  const sim = nueva();
  sim.modo = "manual";
  sim.manual = "adelante"; correr(sim, 1.5);
  assert.ok(sim.s > 0.4);
  sim.manual = "derecha"; correr(sim, 0.5);
  assert.ok(sim.yawVerdad > 5);
  sim.manual = "izquierda"; correr(sim, 0.5);
  S.forzarFrente(sim, 12);
  correr(sim, 0.8); /* las ruedas frenan (retardo de 0,1 s) */
  const s0 = sim.s, yaw0 = sim.yawVerdad;
  sim.manual = "adelante"; correr(sim, 1);
  sim.manual = "izquierda"; correr(sim, 0.5);
  assert.ok(Math.abs(sim.s - s0) < 0.03 && Math.abs(sim.yawVerdad - yaw0) < 1, "frente < 20 cm bloquea avance y giros");
  sim.manual = "atras"; correr(sim, 1);
  assert.ok(sim.s < s0 - 0.1, "retroceder sí se permite");
  sim.atrasForzadoCm = 10;
  correr(sim, 0.8); /* las ruedas frenan */
  const s1 = sim.s;
  sim.manual = "atras"; correr(sim, 1);
  assert.ok(Math.abs(sim.s - s1) < 0.03, "atrás < 20 cm bloquea el retroceso");
});

prueba("sensores: [0,1,1,0] centrado, [0,0,0,0] sin cinta, y la cinta se desplaza en los 4 TCRT5000 con el desvío", () => {
  const sim = nueva();
  sim.s = 1.0;
  assert.deepStrictEqual(S.sensoresActuales(sim).bin, [0, 1, 1, 0]);
  sim.y = -0.020; /* robot 20 mm a la derecha: la cinta queda a su izquierda */
  const b = S.sensoresActuales(sim);
  assert.ok(b.lineaRealMm > 15 && b.bin[0] === 1);
  sim.y = 0; sim.s = 3.5;
  assert.deepStrictEqual(S.sensoresActuales(sim).bin, [0, 0, 0, 0]);
});

prueba("cero lógica duplicada: la planta y la página no reimplementan la máquina de estados", () => {
  const sim = fs.readFileSync(path.join(__dirname, "simulador_movimiento.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  for (const [nombre, src] of [["simulador_movimiento.js", sim], ["index.html", html]]) {
    assert.ok(!/nav\.estado\s*=[^=]/.test(src), nombre + " asigna nav.estado");
    assert.ok(!/(KP_LINEA|K_HEADING|BASE_VEL|TIEMPO_[A-Z_]+_MS|DRIFT_MAX_GRADOS|RSSI_DETECTA_DBM|RSSI_LLEGADA_DBM)\s*[:=]\s*-?[\d.]/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), nombre + " define constantes del núcleo (solo debe leerlas)");
    assert.ok(!/case\s+(ESTADO|nucleo\.ESTADO)\./.test(src), nombre + " reimplementa el switch de estados");
  }
  assert.ok(/nucleo\.paso\(/.test(sim), "la planta llama a nucleo.paso");
  assert.ok(html.includes("specs/navegacion/teach_and_repeat.js") && html.includes("specs/pista_canonica.json"));
  assert.ok(!/\bIA\b|inteligencia artificial|machine learning/i.test(sim + html), "usa teach-and-repeat, no 'IA'");
  assert.ok(/teach-and-repeat/i.test(html));
});

/* ---- index.html: compila y trae los elementos del panel ---- */
const htmlSrc = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
prueba("el script en línea de index.html compila sin errores de sintaxis", () => {
  const bloques = [...htmlSrc.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(bloques.length >= 1);
  bloques.forEach((b) => new vm.Script(b));
});
prueba("index.html trae pista, controles y telemetría lógica con sus elementos", () => {
  for (const id of ["lienzo-pista", "lienzo-zoom", "btn-play", "btn-paso", "btn-viaje-ida", "btn-viaje-vuelta",
    "btn-freno", "btn-reanudar", "btn-ensenar", "btn-restaurar-cinta", "btn-retiro-progresivo", "estado-activo",
    "tcrt-bin", "mpu-rumbo", "mpu-deriva", "us-frente", "us-atras", "ble-rssi", "ble-validacion", "log-eventos",
    "ctl-obstaculo-critico", "ctl-obstaculo-precaucion", "ctl-quitar-obstaculo", "ctl-deriva", "ctl-empujon",
    "modo-auto", "modo-manual", "cinta-tramos", "estados-chips"]) {
    assert.ok(htmlSrc.includes('id="' + id + '"'), "falta #" + id);
  }
});

/* ---- V2 con las 2 pistas de SIM1, Teach, radar P13 y estado del gemelo (asíncrono: importa los módulos ESM de SIM1) ---- */
require("./pistas_radar.test.js")({ N, PISTA, S, contar: () => { ok++; } }).then(
  () => console.log("\nResultado: " + ok + " pruebas OK"),
  (e) => { console.error(e); process.exit(1); }
);
