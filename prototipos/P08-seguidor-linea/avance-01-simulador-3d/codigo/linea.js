// La LECTURA DE LA LÍNEA y el control del seguidor: de los 4 TCRT5000 a la posición de la línea y al PD. Sin three.js aquí.
// No sabe nada de la forma de la pista: solo pregunta a pista.js por el punto de cinta más cercano y respeta su máscara
// (P.cinta), así los simuladores futuros pueden retirar tramos de cinta sin tocar este archivo ni el motor.
import {R} from './model.js';
import {cercano, CINTA} from './pista.js';

// Posición de cada sensor en el robot: x (izquierda +) relativo al centro, todos a "adelante" m del eje
export const xSensores = (sep) => [1.5 * sep, 0.5 * sep, -0.5 * sep, -1.5 * sep];

// Del robot al piso: punto local (lx a la izquierda, lz adelante del eje) -> piso, con el eje en (px, pz) y rumbo th
export const aPiso = (px, pz, th, lx, lz) => {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return [px + lx * c + lz * s, pz - lx * s + lz * c];
};

// Fracción de la zona del sensor que cae sobre la cinta, a una distancia d (m) de su centro
export const sobreCinta = (d) => Math.min(1, Math.max(0, (CINTA / 2 - Math.abs(d)) / (2 * R.spot) + 0.5));

// Lee los 4 sensores. gran(x, z) devuelve cuán oscuro es el granito (0 claro, 1 negro); idx: índice cercano previo
export function leerSensores(P, eje, sep, adelante, gran, rnd, idx) {
  const xs = xSensores(sep);
  const out = [];
  let i0 = idx;
  for (const lx of xs) {
    const [x, z] = aPiso(eje.x, eje.z, eje.th, lx, adelante);
    const c = cercano(P, x, z, i0, 60);
    i0 = c.i;
    const cov = P.cinta && !P.cinta[c.i] ? 0 : sobreCinta(c.d); // sin cinta en esa muestra: solo piso
    const g = gran ? gran(x, z) : 0;
    const osc = cov + (1 - cov) * g * R.granito;
    const raw = R.adcPiso + (R.adcCinta - R.adcPiso) * osc + R.ruido * (rnd() + rnd() + rnd() - 1.5);
    out.push({x, z, d: c.d, raw: Math.max(0, Math.min(4095, Math.round(raw))), cov});
  }
  return out;
}

// El firmware: de las 4 lecturas a la posición de la línea y al PD. Devuelve los PWM de cada motor.
// st guarda lo que el ESP32 recuerda entre vueltas del lazo (última posición, error anterior).
export function control(st, lecturas, sep, cfg) {
  const xs = xSensores(sep);
  const n = lecturas.map((l) => {
    const v = (l.raw - R.adcPiso) / (R.adcCinta - R.adcPiso);
    return v < R.umbral ? 0 : Math.min(1, v);
  });
  const suma = n.reduce((a, b) => a + b, 0);
  let pos;
  let perdida = false;
  if (suma > 0.3) {
    pos = n.reduce((a, v, i) => a + v * xs[i], 0) / suma;
    st.ultima = pos;
  } else {
    // no ve la línea: sigue girando hacia el último lado donde la vio
    perdida = true;
    pos = Math.sign(st.ultima || 1) * xs[0] * 1.2;
  }
  const e = pos * 1000; // error en mm (+ = la línea está a la izquierda)
  const dt = 1 / R.hz;
  const de = st.e0 === undefined ? 0 : (e - st.e0) / dt;
  st.e0 = e;
  const P = cfg.kp * e;
  const D = cfg.kd * de;
  const corr = P + D;
  const lim = (x) => Math.max(-1, Math.min(1, x));
  return {n, suma, pos, e, P, D, corr, perdida, izq: lim(cfg.base - corr), der: lim(cfg.base + corr)};
}

// Estado binario de cada sensor: 1 si ve la cinta (por encima del umbral de la lectura normalizada), 0 si ve el piso
export const binarios = (n) => n.map((v) => (v > 0 ? 1 : 0));

// Error lateral REAL (geométrico, mm) del centro de la regleta respecto a la línea: + si la línea queda a la izquierda del robot
export function errorReal(P, eje, adelante, idx) {
  const [x, z] = aPiso(eje.x, eje.z, eje.th, 0, adelante);
  const c = cercano(P, x, z, idx, 120);
  return {mm: -c.d * 1000, i: c.i};
}

