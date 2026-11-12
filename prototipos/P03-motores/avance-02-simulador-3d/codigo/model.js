// La matemática de la tracción, en unidades reales. Sin three.js aquí.
// Una entrada por motor (PWM 0..1 y sentido) y todo lo demás sale de estas funciones:
// voltaje al motor, rpm, velocidad, corriente aproximada y pulsos del encoder.

export const R = {
  vbat: 11.1, // batería 3S 18650 nominal (V)
  drop: {l298n: 2.1, tb6612: 0.5}, // caída del driver (V)
  ruedaD: 0.065, // diámetro de rueda (m)
  via: 0.18, // distancia entre ruedas (m)
  carga: 0.8, // velocidad con peso / sin peso (supuesto, se mide en P03)
  rpmMotor12: 6000, // motor 370 antes de la caja, 12 V, sin carga
  ppr: 11, // pulsos por vuelta del motor, por canal
  i0: 0.07, // corriente sin carga (A), tabla del fabricante
  istall: 1.8, // corriente de bloqueo a 12 V (A), tabla del fabricante
  pwmHz: 20000,
  meta: [0.35, 0.6], // RNF-03 (m/s)
};

// Claves = "Speed" del anuncio (rpm con carga). rpm12 = sin carga a 12 V. Tabla del kit Emoshayoga JGA25-371.
export const MOTORES = {
  200: {rpm12: 280, ratio: 21.3},
  130: {rpm12: 170, ratio: 35.5},
};

// Pines: propuesta, se confirma con el mapa de pines de la Fase II
export const PINES = {
  izq: {en: 'ENA · GPIO 25', a: 'IN1 · GPIO 26', b: 'IN2 · GPIO 27', encA: 'GPIO 18', encB: 'GPIO 19'},
  der: {en: 'ENB · GPIO 14', a: 'IN3 · GPIO 4', b: 'IN4 · GPIO 13', encA: 'GPIO 16', encB: 'GPIO 17'},
};

// dir: 1 avanza, -1 retrocede, 0 frena. Devuelve las entradas del puente H.
export const entradasH = (dir) => (dir > 0 ? [1, 0] : dir < 0 ? [0, 1] : [0, 0]);

// Lo que pasa en un motor para un PWM y un sentido dados (régimen estable)
export function motor(duty, dir, driver, variante) {
  const m = MOTORES[variante];
  const vDisp = R.vbat - R.drop[driver];
  const v = dir === 0 ? 0 : vDisp * duty;
  const rpm = dir * m.rpm12 * (v / 12) * R.carga;
  const vel = (Math.PI * R.ruedaD * rpm) / 60;
  const iStallV = (R.istall * v) / 12;
  const corriente = dir === 0 || duty === 0 ? 0 : R.i0 + Math.max(0, iStallV - R.i0) * (1 - R.carga);
  return {v, vDisp, rpm, vel, corriente, ratio: m.ratio, rpm12: m.rpm12};
}

// Encoder: pulsos por segundo de un canal y cuentas por vuelta de rueda
export const encoder = (rpmRueda, variante) => {
  const ratio = MOTORES[variante].ratio;
  const porVuelta = R.ppr * ratio;
  return {hz: (Math.abs(rpmRueda) / 60) * porVuelta, porVuelta, cuadratura: porVuelta * 4};
};

// Robot diferencial: velocidad lineal y de giro
export const cinematica = (vIzq, vDer) => ({v: (vIzq + vDer) / 2, w: (vDer - vIzq) / R.via});

// Maniobras: sentido de cada motor
export const MANIOBRAS = {
  avanzar: {izq: 1, der: 1, nombre: 'AVANZA'},
  izquierda: {izq: -1, der: 1, nombre: 'GIRA A LA IZQUIERDA'},
  derecha: {izq: 1, der: -1, nombre: 'GIRA A LA DERECHA'},
  retroceder: {izq: -1, der: -1, nombre: 'RETROCEDE'},
  frenar: {izq: 0, der: 0, nombre: 'FRENADO'},
};
