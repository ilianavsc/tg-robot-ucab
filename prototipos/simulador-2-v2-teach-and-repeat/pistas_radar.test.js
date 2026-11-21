/* Pruebas de SIM2 V2 con las dos pistas de SIM1, la enseñanza real (Teach), el radar P13 y el estado del gemelo digital.
 * Lo carga simulador_movimiento.test.js (que es el que corre en CI): no se ejecuta solo.
 * Importa las pistas y la física de SIM1 tal cual (ESM), sin copiarlas. */
"use strict";
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const SIM1 = path.join(__dirname, "..", "P08-seguidor-linea", "avance-01-simulador-3d", "codigo");
const T = require("./pistas_sim1.js");
const R = require("./radar_us.js");
const G = require("./gemelo_estado.js");

module.exports = async function (ctx) {
  const { N, PISTA, S, contar } = ctx;
  const prueba = async (nombre, f) => { await f(); contar(); console.log("  OK   " + nombre); };
  const sim1 = {
    pista: await import(pathToFileURL(path.join(SIM1, "pista.js")).href),
    model: await import(pathToFileURL(path.join(SIM1, "model.js")).href),
    sim: await import(pathToFileURL(path.join(SIM1, "sim.js")).href)
  };
  const BLE = { bleRadioM: 0.4, bleCercaM: 0.15 };
  function mundo(id, extra) {
    const p1 = sim1.pista.crearPista(id);
    const tr = T.crearTrazado(p1, id);
    const pista = T.pistaPara(id, PISTA, p1.largo);
    return { p1, tr, pista, sim: S.crear(N, pista, Object.assign({ trazado: tr, cintaCompleta: true }, BLE, extra || {})) };
  }
  function correr(sim, maxS, hasta) {
    const n = Math.round(maxS / 0.02);
    for (let i = 0; i < n; i++) { S.paso(sim, 20); if (hasta && hasta(sim)) return true; }
    return false;
  }
  function enseniar(m) {
    assert.ok(S.iniciarEnsenanza(m.sim, 1));
    let maxY = 0;
    correr(m.sim, 90, (x) => { maxY = Math.max(maxY, Math.abs(x.y)); return x.llegadaCompleta || x.nav.paradaSeguridad; });
    return maxY;
  }

  await prueba("la planta usa la física de SIM1: 0,572 m/s con PWM 1,0 (0,457 con 0,8), ruedas de 0,18 s, 0,18 m entre ruedas y sensores a 6 cm", () => {
    const { R: Rm, velRueda } = sim1.model;
    assert.ok(Math.abs(S.P.V_MAX_MS - velRueda(1, Rm.bat.nominal)) < 0.001, "V_MAX " + S.P.V_MAX_MS);
    assert.ok(Math.abs(S.P.V_MAX_MS * 0.8 - velRueda(0.8, Rm.bat.nominal)) < 0.001);
    assert.ok(Math.abs(S.P.V_MAX_MS * 0.8 - 0.457) < 0.002);
    assert.strictEqual(S.P.TAU_RUEDAS_S, Rm.tau);
    assert.strictEqual(S.P.ANCHO_EJES_M, Rm.via);
    assert.strictEqual(S.P.ADELANTE_SENSOR_M, sim1.sim.GEOM.adelante);
  });

  await prueba("las 2 pistas de SIM1 entran tal cual: A = 8,05 m, B = 9,0 m (= pista canónica) con T1–T4 y puntos de control de la especificación", () => {
    const a = mundo("A"), b = mundo("B");
    assert.ok(Math.abs(a.sim.L - 8.05) < 0.006 && Math.abs(b.sim.L - 9.0) < 0.006);
    assert.strictEqual(b.pista, PISTA, "B usa specs/pista_canonica.json sin copiarla");
    assert.deepStrictEqual(PISTA.tramos.map((t) => [t.desdeM, t.hastaM]), [[0, 3], [3, 4.5], [4.5, 7.5], [7.5, 9]]);
    assert.deepStrictEqual(PISTA.puntosDeControl.map((p) => p.posicionM), [3.0, 4.5, 7.5]);
    assert.ok(Math.abs(b.tr.L - PISTA.longitudTotalM) < 0.006);
    assert.deepStrictEqual(a.pista.tramos.length, 1);
    assert.deepStrictEqual(a.pista.puntosDeControl, []);
    assert.strictEqual(a.pista.umbrales, PISTA.umbrales, "los umbrales (sensores a ±9/±27 mm) son los de la especificación");
  });

  await prueba("T2 de la pista B es recto (heading hold posible); la pista A no tiene ningún recto de 1,5 m", () => {
    const a = mundo("A"), b = mundo("B");
    assert.ok(b.tr.rectoEn(3.0, 4.5), "T2 recto");
    assert.ok(!b.tr.rectoEn(0, 3.0) && !b.tr.rectoEn(4.5, 7.5) && !b.tr.rectoEn(7.5, 9.0), "T1, T3 y T4 tienen curvas");
    assert.ok(b.tr.rectaMasLarga(10).largoM >= 3.4);
    assert.ok(a.tr.rectaMasLarga(10).largoM < 1.5, "recta de A " + a.tr.rectaMasLarga(10).largoM);
  });

  await prueba("Teach: la pasada de enseñanza recorre las 2 pistas curvas con la cinta completa, sin pérdidas y a 0,38–0,46 m/s de media", () => {
    for (const id of ["A", "B"]) {
      const m = mundo(id);
      const t0 = m.sim.t, maxY = enseniar(m);
      assert.ok(m.sim.llegadaCompleta && !m.sim.nav.paradaSeguridad, id + " llega");
      assert.ok(m.sim.rutaEnsenada && m.sim.rutaEnsenada.pista === id, id + " ruta guardada");
      assert.ok(maxY < 0.06, id + " desvío máximo " + maxY);
      const vMedia = m.sim.L * 0.97 / (m.sim.t - t0);
      assert.ok(vMedia > 0.36 && vMedia < 0.46, id + " velocidad media " + vMedia);
    }
  });

  await prueba("Repeat en la pista B: tras enseñar y retirar T2 el robot cruza el hueco con HEADING_HOLD y la baliza valida la llegada", () => {
    const m = mundo("B"); enseniar(m);
    S.setCinta(m.sim, 3.0, 4.5, false);
    S.nuevoViaje(m.sim, 1);
    assert.deepStrictEqual(m.sim.tramosEnsenados.map((t) => [t.desdeM, t.hastaM]), [[3, 4.5]]);
    assert.ok(Math.abs(m.sim.tramosEnsenados[0].rumbo) > 170, "rumbo enseñado ≈ ±180° (tras la horquilla): " + m.sim.tramosEnsenados[0].rumbo);
    const estados = []; let ult = -1, maxPerd = 0;
    correr(m.sim, 90, (x) => { if (x.nav.estado !== ult) { ult = x.nav.estado; estados.push(N.NOMBRE_ESTADO[ult]); } maxPerd = Math.max(maxPerd, x.nav.perdidaMs); return x.llegadaCompleta || x.nav.paradaSeguridad; });
    assert.deepStrictEqual(estados, ["FOLLOW_LINE", "LINE_LOST_CHECK", "HEADING_HOLD", "REACQUIRE_LINE", "FOLLOW_LINE", "WAIT_BEACON"]);
    assert.ok(m.sim.llegadaCompleta && !m.sim.nav.paradaSeguridad);
    assert.ok(m.sim.maxErrHold < 3, "error de rumbo en el hueco " + m.sim.maxErrHold);
    assert.ok(maxPerd <= 3900, "el hueco de 1,5 m se cruza con margen bajo el límite de 4 s: " + maxPerd + " ms");
  });

  await prueba("sin pasada de enseñanza un hueco no se puede enseñar: timeout_sin_linea (límite de 4 s intacto)", () => {
    const m = mundo("B");
    S.setCinta(m.sim, 3.0, 4.5, false);
    assert.deepStrictEqual(S.huecosDeCinta(m.sim), [{ desdeM: 3.0, hastaM: 4.5 }]);
    S.nuevoViaje(m.sim, 1);
    assert.strictEqual(m.sim.tramosEnsenados.length, 0);
    correr(m.sim, 60, (x) => x.nav.paradaSeguridad || x.llegadaCompleta);
    assert.ok(m.sim.nav.paradaSeguridad && m.sim.motivoParada === "timeout_sin_linea", String(m.sim.motivoParada));
  });

  await prueba("un hueco en una curva no es enseñable (el giroscopio sostiene un rumbo, no una curva); en la pista A tampoco", () => {
    const b = mundo("B"); enseniar(b);
    S.setCinta(b.sim, 1.6, 2.2, false); S.nuevoViaje(b.sim, 1);
    assert.strictEqual(b.sim.tramosEnsenados.length, 0);
    assert.ok(/curvo/.test(b.sim.huecosRechazados[0].motivo));
    const a = mundo("A"); enseniar(a);
    S.setCinta(a.sim, 3.0, 4.5, false); S.nuevoViaje(a.sim, 1);
    assert.strictEqual(a.sim.tramosEnsenados.length, 0);
    assert.strictEqual(a.sim.huecosRechazados.length, 1);
  });

  await prueba("radar: el cono de ±15° detecta la ficha por ángulo y la distancia es al borde de la ficha", () => {
    const o = { x: 0, y: 0, angulo: 0 };
    assert.strictEqual(R.C.CONO_GRADOS, 15);
    const d = R.medirCono(o, [{ x: 1, y: 0, r: 0.05 }]);
    assert.ok(Math.abs(d - 95) < 0.6, "distancia " + d);
    assert.ok(R.medirCono(o, [{ x: 1, y: 0.2, r: 0.05 }]) !== null, "11,3° dentro del cono");
    assert.strictEqual(R.medirCono(o, [{ x: 1, y: 0.4, r: 0.05 }]), null, "21,8° fuera del cono");
    assert.strictEqual(R.medirCono(o, [{ x: -1, y: 0, r: 0.05 }]), null, "detrás no lo ve el sensor frontal");
    assert.ok(R.medirCono({ x: 0, y: 0, angulo: 180 }, [{ x: -1, y: 0, r: 0.05 }]) !== null, "el trasero sí");
    assert.strictEqual(R.zona(19), "critica"); assert.strictEqual(R.zona(20), "precaucion"); assert.strictEqual(R.zona(50), "libre");
  });

  await prueba("frenado progresivo con la ficha delante: la lectura baja sin saltos, la velocidad cae con rampa, para a < 20 cm y la simulación NO se pausa", () => {
    const m = mundo("B"); enseniar(m);
    S.setCinta(m.sim, 3.0, 4.5, false); S.nuevoViaje(m.sim, 1);
    correr(m.sim, 60, (x) => x.s > 4.7);
    const po = m.tr.puntoEn(m.sim.s + 0.75); /* ficha sobre la cinta, en la recta de T3 */
    S.colocarObstaculo(m.sim, po.x, po.y);
    const t0 = m.sim.t; let vPrev = m.sim.vLineal, fPrev = S.frenteActualCm(m.sim), maxSalto = 0, maxDv = 0, intermedias = 0, vioPrec = false, parada = false;
    correr(m.sim, 15, (x) => {
      const v = x.vLineal, f = S.frenteActualCm(x);
      maxSalto = Math.max(maxSalto, Math.abs(f - fPrev)); maxDv = Math.max(maxDv, Math.abs(v - vPrev));
      if (v > 0.03 && v < 0.4) intermedias++;
      if (f >= 20 && f < 50) vioPrec = true;
      vPrev = v; fPrev = f;
      if (x.ultimaSalida && x.ultimaSalida.frenadoCritico && Math.abs(v) < 0.005) parada = true;
      return parada;
    });
    assert.ok(parada, "se detiene por completo");
    assert.ok(vioPrec && maxSalto < 2, "lectura continua, salto máx. " + maxSalto + " cm");
    assert.ok(maxDv < 0.03, "sin saltos de velocidad por tick (< 1,5 m/s², la parada crítica es inmediata pero las ruedas tardan 0,18 s): " + maxDv + " m/s");
    assert.ok(intermedias >= 15, "velocidades intermedias " + intermedias);
    assert.ok(m.sim.t > t0 + 1, "el tiempo de simulación sigue corriendo");
    assert.ok(S.frenteActualCm(m.sim) < 20 && S.zonaFrente(m.sim, S.frenteActualCm(m.sim)) === "critica");
    const e = G.estadoGemelo(m.sim, S);
    assert.strictEqual(e.alerta, "obstaculo");
    S.quitarObstaculo(m.sim);
    const s0 = m.sim.s; correr(m.sim, 2);
    assert.ok(m.sim.s > s0 + 0.25, "reanuda al despejar");
    assert.ok(m.sim.limitadorActivo !== undefined);
  });

  await prueba("el sensor trasero detecta la ficha que queda atrás (±15°) y lo avisa", () => {
    const m = mundo("B"); correr(m.sim, 4);
    const p = S.poseMundo(m.sim), a = p.angulo * Math.PI / 180;
    S.colocarObstaculo(m.sim, p.x - Math.cos(a) * 0.35, p.y - Math.sin(a) * 0.35);
    const atras = S.atrasActualCm(m.sim);
    assert.ok(atras < 60 && atras > 5, "atrás " + atras);
    assert.strictEqual(S.frenteActualCm(m.sim), 0, "delante no hay eco");
  });

  await prueba("estado del gemelo digital: pista, x, y, angulo (0 = +x, antihorario), velocidad_ms, frente_cm, atras_cm, alerta y s_m", () => {
    const m = mundo("B"); S.iniciarEnsenanza(m.sim, 1);
    let e = G.estadoGemelo(m.sim, S);
    assert.deepStrictEqual(Object.keys(e).sort(), ["alerta", "angulo", "atras_cm", "frente_cm", "pista", "s_m", "velocidad_ms", "x", "y"]);
    assert.deepStrictEqual(G.validar(e), []);
    assert.strictEqual(e.pista, "B"); assert.ok(Math.abs(e.angulo) < 1, "sale mirando a +x: " + e.angulo);
    const p0 = m.tr.puntoEn(0); assert.ok(Math.abs(e.x - p0.x) < 0.01 && Math.abs(e.y - p0.y) < 0.01);
    correr(m.sim, 8);
    e = G.estadoGemelo(m.sim, S);
    assert.ok(Math.abs(Math.abs(e.angulo) - 180) < 12, "tras la horquilla mira a −x: " + e.angulo);
    assert.ok(e.s_m > 2.5 && e.velocidad_ms > 0.3 && e.s_m / m.sim.L > 0 && e.s_m / m.sim.L < 1);
    assert.deepStrictEqual(G.validar(Object.assign({}, e, { alerta: "fuego" })), ["alerta inválida"]);
    const c = G.aContratoApp(e, m.sim, S);
    for (const k of ["estado", "linea_mm", "v_izq", "v_der", "parada", "t"]) assert.ok(k in c.estado, k);
    for (const k of ["frente_cm", "atras_cm", "frente_ok", "atras_ok", "t"]) assert.ok(k in c.ultrasonido, k);
    assert.ok(Math.abs(c.mapa.fraccion - e.s_m / m.sim.L) < 1e-3 && c.mapa.largo_m === m.sim.L);
    assert.strictEqual(c.estado.parada, "ninguna");
  });

  await prueba("viaje de vuelta: el ángulo del gemelo sale a 180° y se enseña aparte", () => {
    const m = mundo("B"); S.nuevoViaje(m.sim, -1);
    const e = G.estadoGemelo(m.sim, S);
    assert.ok(Math.abs(Math.abs(e.angulo) - 180) < 1 || Math.abs(e.angulo) < 1, "angulo " + e.angulo);
    assert.ok(Math.abs(e.s_m - m.sim.L) < 0.01);
  });

  await prueba("velocímetro SVG calibrado de 0,00 a 0,46 m/s", () => {
    assert.strictEqual(R.C.VEL_MAX_VELO, 0.46);
    const cero = R.velocimetro(0), maxi = R.velocimetro(0.46), medio = R.velocimetro(0.23), pasado = R.velocimetro(0.9);
    assert.strictEqual(cero.agujaGrados, -90); assert.strictEqual(cero.dashoffset, 94.25); assert.strictEqual(cero.color, "rojo");
    assert.strictEqual(maxi.agujaGrados, 90); assert.strictEqual(maxi.dashoffset, 0);
    assert.strictEqual(medio.agujaGrados, 0); assert.strictEqual(pasado.agujaGrados, 90);
    assert.ok(S.P.V_MAX_MS * 0.8 <= R.C.VEL_MAX_VELO + 0.005, "la velocidad máxima en recta (0,457) cabe en la escala");
  });

  await prueba("limitador de rampa (D4-A): 0,55 m/s² al frenar y paradas críticas inmediatas; el núcleo no cambia", () => {
    assert.strictEqual(R.C.RAMPA_DECEL_MS2, 0.55); assert.strictEqual(S.P.RAMPA_DECEL_MS2, 0.55);
    const v = R.rampa(0.8, 0.4, 0.1, 0.572, 0.55, 0.9);
    assert.ok(Math.abs(v - (0.8 - 0.55 / 0.572 * 0.1)) < 1e-9, "baja " + (0.8 - v));
    assert.strictEqual(R.rampa(0.4, 0.8, 10, 0.572), 0.8);
    assert.strictEqual(N.CFG.UMBRAL_PARADA_CM, 20); assert.strictEqual(N.CFG.UMBRAL_AVISO_CM, 50);
  });

  await prueba("la página: 6 paneles <details> cerrados por defecto, ranura de alertas de altura fija (sin display:none) y selector de las 2 pistas", () => {
    const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    const dets = [...html.matchAll(/<details class="det"([^>]*)>/g)];
    assert.ok(dets.length >= 6, "paneles " + dets.length);
    dets.forEach((d) => assert.ok(!/\bopen\b/.test(d[1]), "un <details> arranca abierto"));
    const css = html.slice(0, html.indexOf("</style>"));
    assert.ok(/\.alerta-slot\s*\{[^}]*\bheight:\s*62px/.test(css) && /\.alerta\s*\{[^}]*\bheight:\s*46px/.test(css), "la ranura y la alerta tienen altura fija (delta = 0 px)");
    assert.ok(!/\.alerta[^{}]*\{[^}]*display:\s*none/.test(css) && !/id="alerta"[^>]*hidden/.test(html), "la alerta no se oculta con display:none ni hidden");
    assert.ok(/data-pista="A"/.test(html) && /data-pista="B"/.test(html));
    for (const id of ["lienzo-pista", "velocimetro", "velo-arco", "velo-aguja", "base-obstaculo", "alerta", "contrato-json", "btn-ensenar", "btn-viaje-ida"]) assert.ok(html.includes('id="' + id + '"'), "falta #" + id);
    assert.ok(/pointerdown/.test(html) && /pointermove/.test(html) && /pointerup/.test(html), "ficha arrastrable con eventos de puntero");
    assert.ok(html.includes("../P08-seguidor-linea/avance-01-simulador-3d/codigo/pista.js"), "usa las pistas de SIM1 sin copiarlas");
  });

  await prueba("los archivos nuevos no reimplementan la máquina de estados ni mencionan 'IA'", () => {
    for (const f of ["pistas_sim1.js", "radar_us.js", "gemelo_estado.js", "simulador_movimiento.js", "aprendizaje_gemelo.js", "index.html"]) {
      const src = fs.readFileSync(path.join(__dirname, f), "utf8");
      assert.ok(!/nav\.estado\s*=[^=]/.test(src), f + " asigna nav.estado");
      assert.ok(!/case\s+(ESTADO|nucleo\.ESTADO)\./.test(src), f + " reimplementa el switch");
      assert.ok(!new RegExp(["\\bI", "A\\b|inteligencia ", "artificial"].join(""), "i").test(src), f + " menciona IA");
    }
  });

  /* ---- Etapa 2: Máquina de 14 estados de aprendizaje + Gemelo V1 + Registro RMS ---- */
  const A = require("./aprendizaje_gemelo.js");

  await prueba("Etapa 2: máquina de 14 estados completa INITIAL → SLOW_READING → NORMAL_READING → TWIN_CREATING → TWIN_V1_READY → ADJUSTING (×3) → EVALUATION_PENDING → PHASE1_READY", () => {
    assert.strictEqual(A.ESTADOS.length, 14);
    const m = mundo("B");
    const ap = A.crear({ pistaId: "B", metaViajes: 3 });
    assert.strictEqual(ap.estado, "INITIAL");

    /* 1) Lectura lenta (0,16 m/s) */
    S.iniciarEnsenanza(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_LENTA_MS;
    A.iniciarViaje(ap, "SLOW_READING", "B", m.sim.L, m.sim.cinta.length);
    assert.strictEqual(ap.estado, "SLOW_READING");
    for (let i = 0; i < 4000 && !m.sim.llegadaCompleta; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
    assert.ok(m.sim.llegadaCompleta, "lectura lenta llegó");
    const regLenta = A.finalizarViaje(ap, m.sim, true, "none");
    assert.strictEqual(regLenta.valid, true);
    assert.ok(regLenta.actual_speed_ms >= 0.12 && regLenta.actual_speed_ms <= 0.22, "vel lenta " + regLenta.actual_speed_ms);
    assert.strictEqual(ap.estado, "NORMAL_READING");

    /* 2) Pasada normal (0,41 m/s) -> TWIN_CREATING automático -> TWIN_V1_READY */
    S.nuevoViaje(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_NORMAL_MS;
    A.iniciarViaje(ap, "NORMAL_READING", "B", m.sim.L, m.sim.cinta.length);
    for (let i = 0; i < 2000 && !m.sim.llegadaCompleta; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
    const regNorm = A.finalizarViaje(ap, m.sim, true, "none");
    assert.strictEqual(regNorm.valid, true);
    assert.ok(regNorm.actual_speed_ms >= 0.35 && regNorm.actual_speed_ms <= 0.46, "vel normal " + regNorm.actual_speed_ms);
    assert.strictEqual(ap.estado, "TWIN_CREATING");
    assert.strictEqual(A.completarNacimientoGemelo(ap), true);
    assert.strictEqual(ap.estado, "TWIN_V1_READY");

    /* 3) 3 viajes de ajuste -> EVALUATION_PENDING -> PHASE1_READY */
    for (let k = 0; k < 3; k++) {
      S.nuevoViaje(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_NORMAL_MS;
      A.iniciarViaje(ap, "ADJUSTING", "B", m.sim.L, m.sim.cinta.length);
      for (let i = 0; i < 2000 && !m.sim.llegadaCompleta; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
      const r = A.finalizarViaje(ap, m.sim, true, "none");
      assert.strictEqual(r.valid, true);
    }
    assert.strictEqual(ap.viajesAjusteValidos, 3);
    assert.strictEqual(ap.estado, "EVALUATION_PENDING");
    const ev = A.evaluarGemelo(ap);
    assert.strictEqual(ev.aprobado, true, "evaluación: " + ev.motivo);
    assert.strictEqual(ap.estado, "PHASE1_READY");
    assert.strictEqual(ap.madurez, "Validado Fase 1");
  });

  await prueba("Etapa 2: registro estructurado por viaje incluye las 13 llaves exactas", () => {
    const m = mundo("B");
    const ap = A.crear({ pistaId: "B" });
    S.iniciarEnsenanza(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_LENTA_MS;
    A.iniciarViaje(ap, "SLOW_READING", "B", m.sim.L, m.sim.cinta.length);
    for (let i = 0; i < 4000 && !m.sim.llegadaCompleta; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
    const reg = A.finalizarViaje(ap, m.sim, true, "none");
    assert.deepStrictEqual(Object.keys(reg).sort(), [
      "actual_speed_ms", "coverage_pct", "duration_s", "heading_error_rms_deg",
      "lateral_error_rms_mm", "length_m", "stop_reason", "target_speed_ms",
      "track_id", "trip_id", "trip_type", "valid", "wheel_tau_s"
    ]);
  });

  await prueba("Etapa 2: interrupción con Freno Remoto o pasada incompleta pasa a FAULT y NO cuenta", () => {
    const m = mundo("B");
    const ap = A.crear({ pistaId: "B" });
    S.iniciarEnsenanza(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_LENTA_MS;
    A.iniciarViaje(ap, "SLOW_READING", "B", m.sim.L, m.sim.cinta.length);
    for (let i = 0; i < 40; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
    S.frenoRemoto(m.sim);
    const reg = A.finalizarViaje(ap, m.sim, false, "freno_remoto");
    assert.strictEqual(reg.valid, false);
    assert.strictEqual(reg.stop_reason, "freno_remoto");
    assert.strictEqual(ap.estado, "FAULT");
    assert.strictEqual(ap.capturaLentaOk, false);
    assert.strictEqual(ap.geometriaRef, null);
    assert.strictEqual(A.recuperarFallo(ap), "INITIAL");
  });

  await prueba("Etapa 2: regla de ingeniería — referencia geométrica congelada tras lectura lenta", () => {
    const m = mundo("B");
    const ap = A.crear({ pistaId: "B" });
    S.iniciarEnsenanza(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_LENTA_MS;
    A.iniciarViaje(ap, "SLOW_READING", "B", m.sim.L, m.sim.cinta.length);
    for (let i = 0; i < 4000 && !m.sim.llegadaCompleta; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
    A.finalizarViaje(ap, m.sim, true, "none");
    const refOriginal = ap.geometriaRef;
    assert.ok(refOriginal && Object.isFrozen(refOriginal) && Object.isFrozen(refOriginal.celdas));
    /* Pasada normal + ajuste NO cambian la referencia geométrica */
    S.nuevoViaje(m.sim, 1); m.sim.velObjetivoMs = A.C.VEL_NORMAL_MS;
    A.iniciarViaje(ap, "NORMAL_READING", "B", m.sim.L, m.sim.cinta.length);
    for (let i = 0; i < 2000 && !m.sim.llegadaCompleta; i++) { S.paso(m.sim, 20); A.muestrearTick(ap, m.sim, 20); }
    A.finalizarViaje(ap, m.sim, true, "none");
    A.completarNacimientoGemelo(ap);
    assert.strictEqual(ap.geometriaRef, refOriginal);
  });

  await prueba("Etapa 2: calidad > contador — viajes con RMS alto pasan a ADJUSTMENT_REQUIRED y selector 5 viajes exige 5", () => {
    const ap = A.crear({ pistaId: "B", metaViajes: 3 });
    ap.capturaLentaOk = true; ap.capturaNormalOk = true;
    ap.geometriaRef = Object.freeze({ track_id: "B", length_m: 9.0, celdas: Object.freeze([]) });
    ap.estado = "EVALUATION_PENDING";
    ap.viajesAjusteValidos = 3;
    for (let i = 1; i <= 3; i++) {
      ap.viajes.push({
        trip_id: i, trip_type: "ADJUSTING", track_id: "B", target_speed_ms: 0.41, actual_speed_ms: 0.41,
        duration_s: 22, length_m: 9.0, coverage_pct: 100, lateral_error_rms_mm: 24.5, heading_error_rms_deg: 2.1,
        wheel_tau_s: 0.18, valid: true, stop_reason: "none"
      });
    }
    const ev = A.evaluarGemelo(ap);
    assert.strictEqual(ev.aprobado, false);
    assert.strictEqual(ap.estado, "ADJUSTMENT_REQUIRED");
    /* Selector 5 viajes (SIL) exige 5 */
    A.setMetaViajes(ap, 5);
    assert.strictEqual(ap.metaViajes, 5);
    assert.strictEqual(A.evaluarGemelo(ap).aprobado, false);
  });
};
