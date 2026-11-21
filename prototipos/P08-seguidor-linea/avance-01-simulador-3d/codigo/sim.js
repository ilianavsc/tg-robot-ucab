// El motor del Simulador 1 de aprendizaje progresivo: robot, modo manual o automático, y los datos en vivo. Sin three.js aquí.
// Une las tres piezas separadas: pista.js (qué pista hay), linea.js (cómo se lee la línea) y model.js (cómo se mueve el robot).
// Un simulador futuro hereda esto tal cual y solo llama a ocultarTramo() de pista.js para retirar cinta.
import {R, mover, rumbo} from './model.js';
import {binarios, control, errorReal, leerSensores} from './linea.js';
import {crearPista, tramoEn} from './pista.js';

// Valores del firmware (codigo-esp32/seguidor_linea) y del Avance 1
export const PD = {base: 0.8, kp: 0.03, kd: 0.0015};
export const GEOM = {sep: 0.018, adelante: 0.06}; // sensores a 18 mm entre sí y a 60 mm del eje
export const MANUAL = {avance: 0.8, giro: 0.45, suavizado: 0.08}; // PWM máximo al avanzar, PWM diferencial al girar, constante de la rampa (s)
export const PASO_FISICA = 0.002;
const DEBOUNCE_SALIDA = 0.25; // s sin ver la línea para contar una salida
const DEBOUNCE_VUELTA = 0.1;

const lim = (x) => Math.max(-1, Math.min(1, x));

// fabricaGran(P) -> función gran(x, z) del granito (o null para piso liso)
export function crearSim({pistaId = 'A', modo = 'auto', vbat = R.bat.nominal, fabricaGran = () => null} = {}) {
  const S = {
    modo,
    vbat,
    pd: {...PD},
    entrada: {f: 0, t: 0, freno: false},
    cmd: {f: 0, t: 0},
    estadisticas: {},
  };
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const cargarPista = (id) => {
    S.pistaId = id;
    S.P = crearPista(id);
    S.gran = fabricaGran(S.P);
    S.reiniciar();
  };

  S.reiniciar = () => {
    const P = S.P;
    S.eje = {x: P.X[0], z: P.Z[0], th: rumbo(P.TX[0], P.TZ[0])};
    S.th0 = S.eje.th;
    S.vel = {izq: 0, der: 0};
    S.pwm = {izq: 0, der: 0};
    S.st = {};
    S.cmd = {f: 0, t: 0};
    S.tc = 0;
    S.t = 0;
    S.idx = 0;
    S.prog = 0;
    S.dist = 0;
    S.vueltas = 0;
    S.tVuelta = 0;
    S.ultimaVuelta = null;
    S.mejorVuelta = null;
    S.salidas = 0;
    S.salidasIni = 0;
    S.tPerdida = 0;
    S.tVista = 0;
    S.enSalida = false;
    S.tramoId = tramoEn(P, 0).id;
    S.tTramo = 0;
    S.tramoPrev = null; // {id, t} del último tramo terminado
    S.tiemposTramo = {};
    S.lect = leerSensores(P, S.eje, GEOM.sep, GEOM.adelante, S.gran, rnd, 0);
    S.ctrl = control({}, S.lect, GEOM.sep, S.pd); // lectura inicial (el estado del lazo empieza limpio)
    S.eReal = 0;
    S.v = 0;
    S.w = 0;
  };

  S.setPista = (id) => cargarPista(id);
  S.setModo = (m) => {
    if (m === S.modo) return;
    S.modo = m;
    S.st = {};
    S.cmd = {f: 0, t: 0};
    S.pwm = {izq: 0, der: 0};
  };

  const clave = () => `${S.pistaId}·${S.modo}`;
  const stats = () => {
    const k = clave();
    return (S.estadisticas[k] ||= {pista: S.pistaId, modo: S.modo, t: 0, tMov: 0, dist: 0, vueltas: 0, mejor: null, emax: 0, e2: 0, ne: 0, salidas: 0, tPerdida: 0});
  };

  // un tick del lazo de control (100 Hz): leer sensores y decidir los PWM
  const tick = (dt) => {
    const P = S.P;
    S.lect = leerSensores(P, S.eje, GEOM.sep, GEOM.adelante, S.gran, rnd, S.idx);
    S.ctrl = control(S.st, S.lect, GEOM.sep, S.pd);
    if (S.modo === 'auto' && !S.entrada.freno) {
      S.pwm = {izq: S.ctrl.izq, der: S.ctrl.der};
    } else {
      const a = 1 - Math.exp(-dt / MANUAL.suavizado);
      S.cmd.f += (S.entrada.f - S.cmd.f) * a;
      S.cmd.t += (S.entrada.t - S.cmd.t) * a;
      if (S.entrada.freno) S.cmd.f = S.cmd.t = 0;
      S.pwm = {izq: lim(S.cmd.f * MANUAL.avance - S.cmd.t * MANUAL.giro), der: lim(S.cmd.f * MANUAL.avance + S.cmd.t * MANUAL.giro)};
    }
    // progreso a lo largo de la pista
    let er = errorReal(P, S.eje, GEOM.adelante, S.idx);
    let idx = er.i;
    if (Math.abs(er.mm) > 150) {
      // lejos de la cinta: busca el punto más cercano en toda la pista y mide desde ahí
      const [x, z] = [S.eje.x + Math.sin(S.eje.th) * GEOM.adelante, S.eje.z + Math.cos(S.eje.th) * GEOM.adelante];
      let best = Infinity;
      for (let i = 0; i < P.N; i += 4) {
        const d = (P.X[i] - x) ** 2 + (P.Z[i] - z) ** 2;
        if (d < best) {
          best = d;
          idx = i;
        }
      }
      er = errorReal(P, S.eje, GEOM.adelante, idx);
    }
    S.eReal = er.mm;
    let di = idx - S.idx;
    if (di < -P.N / 2) di += P.N;
    if (di > P.N / 2) di -= P.N;
    S.prog += di;
    S.idx = idx;
    S.v = (S.vel.izq + S.vel.der) / 2;
    S.w = (S.vel.der - S.vel.izq) / R.via;
    const mov = Math.abs(S.v) > 0.01 || Math.abs(S.w) > 0.05;
    const e = stats();
    S.t += dt;
    S.tVuelta += dt;
    S.tTramo += dt;
    S.dist += Math.abs(S.v) * dt;
    e.t += dt;
    e.dist += Math.abs(S.v) * dt;
    if (mov) e.tMov += dt;
    if (Math.abs(S.eReal) < 150) {
      const ae = Math.abs(S.eReal);
      if (ae > e.emax) e.emax = ae;
      e.e2 += ae * ae;
      e.ne++;
    }
    // vuelta completa: cuenta solo si se siguió la línea (sin salidas y sin atajos imposibles a esta velocidad)
    if (S.prog >= P.N) {
      S.prog -= P.N;
      const valida = S.salidas === S.salidasIni && S.tVuelta > P.largo / 0.65;
      if (valida) {
        S.vueltas++;
        S.ultimaVuelta = S.tVuelta;
        if (S.mejorVuelta === null || S.tVuelta < S.mejorVuelta) S.mejorVuelta = S.tVuelta;
        e.vueltas++;
        if (e.mejor === null || S.tVuelta < e.mejor) e.mejor = S.tVuelta;
      }
      S.tVuelta = 0;
      S.salidasIni = S.salidas;
    } else if (S.prog < 0) S.prog += P.N;
    // tramo
    const tr = tramoEn(P, S.idx);
    if (tr.id !== S.tramoId) {
      S.tramoPrev = {id: S.tramoId, t: S.tTramo};
      S.tiemposTramo[S.tramoId] = S.tTramo;
      S.tramoId = tr.id;
      S.tTramo = 0;
    }
    // salidas de línea: no ver la línea durante DEBOUNCE_SALIDA segundos
    if (S.ctrl.perdida) {
      S.tPerdida += dt;
      e.tPerdida += dt;
      S.tVista = 0;
      if (!S.enSalida && S.tPerdida >= DEBOUNCE_SALIDA) {
        S.enSalida = true;
        S.salidas++;
        e.salidas++;
      }
    } else {
      S.tVista += dt;
      if (S.tVista >= DEBOUNCE_VUELTA) {
        S.enSalida = false;
        S.tPerdida = 0;
      }
    }
  };

  // avanza la simulación dt segundos (física a 500 Hz, control a 100 Hz)
  S.avanzar = (dt) => {
    let resto = Math.min(dt, 0.25);
    while (resto > 1e-9) {
      const h = Math.min(PASO_FISICA, resto);
      resto -= h;
      S.tc += h;
      if (S.tc >= 1 / R.hz - 1e-9) {
        tick(S.tc);
        S.tc = 0;
      }
      mover(S.eje, S.vel, S.pwm, S.vbat, h);
      if (S.entrada.freno) {
        // freno inmediato: las ruedas se detienen en una fracción de segundo
        const k = Math.exp(-h / 0.03);
        S.vel.izq *= k;
        S.vel.der *= k;
      }
    }
  };

  // Lo que muestra el panel
  S.lectura = () => {
    const P = S.P;
    const tr = P.tramos.find((t) => t.id === S.tramoId) || P.tramos[0];
    let rum = ((S.eje.th - S.th0) * 180) / Math.PI;
    rum = ((((rum + 180) % 360) + 360) % 360) - 180;
    return {
      pistaId: S.pistaId,
      modo: S.modo,
      raw: S.lect.map((l) => l.raw),
      n: S.ctrl.n,
      bin: binarios(S.ctrl.n),
      eMedido: S.ctrl.e,
      eReal: S.eReal,
      perdida: S.ctrl.perdida,
      pwm: S.pwm,
      v: S.v,
      w: S.w,
      distancia: S.dist,
      progresoM: S.idx * P.paso,
      largo: P.largo,
      rumbo: rum,
      vuelta: S.vueltas + 1,
      vueltas: S.vueltas,
      tVuelta: S.tVuelta,
      ultimaVuelta: S.ultimaVuelta,
      mejorVuelta: S.mejorVuelta,
      tramo: {id: tr.id, nombre: tr.nombre, linea: tr.linea, t: S.tTramo},
      tramoPrev: S.tramoPrev,
      salidas: S.salidas,
      t: S.t,
    };
  };

  S.resumen = () =>
    Object.values(S.estadisticas).map((e) => ({
      pista: e.pista,
      modo: e.modo,
      t: e.t,
      dist: e.dist,
      vueltas: e.vueltas,
      mejor: e.mejor,
      vmedia: e.tMov > 0.5 ? e.dist / e.tMov : 0,
      emax: e.emax,
      erms: e.ne ? Math.sqrt(e.e2 / e.ne) : 0,
      salidas: e.salidas,
    }));

  cargarPista(pistaId);
  return S;
}
