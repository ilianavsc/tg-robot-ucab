// La matemática del seguidor de línea, en unidades reales. Sin three.js aquí (se prueba en Node).
// Motor: el que se compró, kit Emoshayoga JGA25-371 Speed 200 (280 rpm sin carga a 12 V, caja 1:21,3, encoder 11 PPR).
// Driver: L298N. Sensores: 4 × TCRT5000 con salida analógica (A0) en pines ADC1.
import {cercano, CINTA} from './pista.js';

export const R = {
  bat: {llena: 12.6, nominal: 11.1, baja: 9.9}, // 3S: cargada, nominal y alarma de batería baja (V)
  drop: 2.1, // caída del L298N (V), la misma del P03
  ruedaD: 0.065, // diámetro de rueda (m), del kit
  via: 0.18, // distancia entre ruedas (m), la misma del P03
  ZA: 0.03, // eje de las ruedas, 3 cm delante del centro del chasis
  rpm12: 280, // Speed 200: rpm de la rueda sin carga a 12 V (tabla del vendedor)
  ratio: 21.3, // caja reductora
  ppr: 11, // pulsos por vuelta del motor, por canal
  carga: 0.8, // SUPUESTO del P03: con peso va al 80 % de la velocidad sin carga
  tau: 0.18, // SUPUESTO del P03: la rueda tarda ~0,18 s en llegar a su velocidad
  meta: [0.35, 0.6], // RNF-03 (m/s)
  // Sensores (SUPUESTOS hasta calibrar con los módulos reales)
  adcPiso: 500, // lectura en piso claro (de 4095)
  adcCinta: 3300, // lectura sobre la cinta negra
  ruido: 20, // ruido eléctrico del ADC (cuentas)
  spot: 0.003, // radio de la zona que "ve" cada sensor (m)
  granito: 0.6, // cuánto oscurece un grano negro del granito, comparado con la cinta
  umbral: 0.2, // lecturas por debajo del 20 % cuentan como piso
  hz: 100, // el ESP32 corre el control 100 veces por segundo
};

export const PINES_LINEA = ['GPIO 36', 'GPIO 39', 'GPIO 34', 'GPIO 35'];

// Velocidad de una rueda (m/s) para un PWM entre -1 y 1, en régimen estable
export function velRueda(pwm, vbat) {
  const v = (vbat - R.drop) * Math.min(1, Math.abs(pwm));
  const rpm = R.rpm12 * (v / 12) * R.carga;
  return Math.sign(pwm) * (Math.PI * R.ruedaD * rpm) / 60;
}

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
    const cov = sobreCinta(c.d);
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

// Un paso de la física: cada rueda persigue su velocidad y el robot se mueve como diferencial.
// eje: {x, z, th} es el punto medio entre las ruedas. vel: {izq, der} velocidades actuales (m/s).
export function mover(eje, vel, pwm, vbat, dt) {
  const k = 1 - Math.exp(-dt / R.tau);
  vel.izq += (velRueda(pwm.izq, vbat) - vel.izq) * k;
  vel.der += (velRueda(pwm.der, vbat) - vel.der) * k;
  const v = (vel.izq + vel.der) / 2;
  const w = (vel.der - vel.izq) / R.via; // + gira a la izquierda
  eje.th += w * dt;
  eje.x += Math.sin(eje.th) * v * dt;
  eje.z += Math.cos(eje.th) * v * dt;
  return {v, w};
}

// Rumbo th para avanzar a lo largo de la tangente (tx, tz)
export const rumbo = (tx, tz) => Math.atan2(tx, tz);

// Encoder: cuentas por vuelta de rueda (las 4 flancos de A y B)
export const cuentasVuelta = () => R.ppr * R.ratio * 4;
