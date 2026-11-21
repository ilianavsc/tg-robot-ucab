// La física del robot (motor, rueda, cinemática diferencial), en unidades reales. Sin three.js aquí (se prueba en Node).
// La lectura de la línea y el control PD están aparte, en linea.js; la definición de las pistas, en pista.js.
// Motor: el que se compró, kit Emoshayoga JGA25-371 Speed 200 (280 rpm sin carga a 12 V, caja 1:21,3, encoder 11 PPR).
// Driver: L298N. Sensores: 4 × TCRT5000 con salida analógica (A0) en pines ADC1.
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
