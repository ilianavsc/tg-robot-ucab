// La matemática de la tracción, en unidades reales. Sin three.js aquí.
// Un solo modelo seleccionado: kit Emoshayoga JGA25-371 "Speed 200" con driver L298N y batería 3S.
// Los valores marcados como supuesto son de simulación [PENDIENTE DE MEDICIÓN FÍSICA].

export const R = {
  vbat: 11.1, // batería 3S 18650 nominal (V)
  bat: {llena: 12.6, nominal: 11.1, baja: 9.9}, // 3S: cargada, nominal y corte (V)
  caidaL298N: 2.1, // caída del driver L298N (V)
  ruedaD: 0.065, // diámetro de rueda (m)
  via: 0.18, // distancia entre ruedas (m)
  carga: 0.8, // velocidad con peso / sin peso (supuesto)
  rpm12: 280, // Speed 200: rpm sin carga a 12 V, ya con la caja reductora
  ratio: 21.3, // relación de la caja reductora 1:21,3
  ppr: 11, // pulsos por vuelta del motor, por canal
  i0: 0.07, // corriente sin carga (A), tabla del fabricante
  istall: 1.8, // corriente de bloqueo a 12 V (A), tabla del fabricante
  pwmHz: 20000,
};

// Pines del firmware robot_integrado.ino
export const PINES = {
  izq: {en: 'ENA · GPIO 25', a: 'IN1 · GPIO 26', b: 'IN2 · GPIO 27', enc: 'GPIO 18 / 19'},
  der: {en: 'ENB · GPIO 14', a: 'IN3 · GPIO 4', b: 'IN4 · GPIO 13', enc: 'GPIO 16 / 17'},
};

// Lo que pasa en un motor para un PWM (0..1) y un sentido (1 avanza, -1 retrocede, 0 frena)
export function motor(duty, dir, vbat = R.vbat) {
  const vDisp = vbat - R.caidaL298N;
  const v = dir === 0 ? 0 : vDisp * duty;
  const rpm = dir * R.rpm12 * (v / 12) * R.carga;
  const vel = (Math.PI * R.ruedaD * rpm) / 60;
  const iStallV = (R.istall * v) / 12;
  const corriente = dir === 0 || duty === 0 ? 0 : R.i0 + Math.max(0, iStallV - R.i0) * (1 - R.carga);
  return {v, vDisp, rpm, vel, corriente};
}

// Velocidad máxima de la rueda al 100 % de PWM (m/s)
export const VMAX = motor(1, 1).vel;

// PWM (0..1) que hace falta para una velocidad de rueda dada (m/s)
export const dutyPara = (vel) => Math.min(1, Math.abs(vel) / VMAX);

// Encoder: pulsos por segundo de un canal para una rpm de rueda
export const encoderHz = (rpmRueda) => (Math.abs(rpmRueda) / 60) * R.ppr * R.ratio;

// Robot diferencial: velocidad lineal y de giro (w > 0 gira a la izquierda)
export const cinematica = (vIzq, vDer) => ({v: (vIzq + vDer) / 2, w: (vDer - vIzq) / R.via});

// Inversa: velocidades de rueda para una velocidad lineal y una de giro
export const ruedas = (v, w) => ({izq: v - (w * R.via) / 2, der: v + (w * R.via) / 2});
