// El recorrido autónomo de demostración: seguimiento de trayectoria sobre la ruta cerrada.
// No es la máquina de estados de teach-and-repeat (esa vive en specs/navegacion y en el Simulador 2 V2):
// aquí el robot solo recorre un circuito conocido para que se vean los componentes trabajando.
import {R, cinematica, dutyPara, encoderHz, motor, ruedas} from './model.js';
import {GEO, OBSTACULOS, ZONAS, crearRuta, lineaSensores, ultrasonido, zonaDe} from './ruta.js';

export const V_NOM = 0.4; // m/s, parecida a la del seguidor de línea P08 (supuesto de simulación)
const LOOK = 0.16; // distancia de mira (m)
const TAU = 0.08; // lag de los motores (s)
const KP = 25; // rad/s por metro de error lateral
const KD = 0.4;

export function crearDemo() {
  const ruta = crearRuta();
  const obstaculos = OBSTACULOS;
  const p0 = ruta.en(0);
  const est = {
    x: p0.x,
    z: p0.z,
    th: Math.atan2(p0.tx, p0.tz),
    t: 0,
    vIzq: 0,
    vDer: 0,
    hint: 0,
    vuelta: 0,
    sPrev: 0,
    sens: [0, 1, 1, 0],
    frente: Infinity,
    atras: Infinity,
    w: 0,
    v: 0,
    eLat: 0,
  };

  const paso = (dt) => {
    est.t += dt;
    const c = ruta.cercano(est.x, est.z, est.hint);
    est.hint = c.i;
    if (c.s < est.sPrev - ruta.largo / 2) est.vuelta++; // cruzó la meta
    est.sPrev = c.s;
    // punto de mira, con un pequeño vaivén lateral para que los sensores no lean siempre igual
    const m = ruta.en(c.s + LOOK);
    const vaiven = 0.007 * Math.sin(est.t * 5.4) + 0.004 * Math.sin(est.t * 2.1);
    const tx = m.x - m.tz * vaiven;
    const tz = m.z + m.tx * vaiven;
    const dx = tx - est.x;
    const dz = tz - est.z;
    const lx = dx * Math.cos(est.th) - dz * Math.sin(est.th); // a la izquierda del robot
    const lz = dx * Math.sin(est.th) + dz * Math.cos(est.th); // al frente
    const kap = (2 * lx) / (lx * lx + lz * lz);
    // corrección PD sobre el error lateral de la regleta (como el seguidor de línea P08)
    const sx = est.x + Math.sin(est.th) * GEO.tcrtZ;
    const sz = est.z + Math.cos(est.th) * GEO.tcrtZ;
    const cs = ruta.cercano(sx, sz, c.i);
    const pj = ruta.en(cs.s);
    const eLat = (pj.x - sx) * Math.cos(est.th) - (pj.z - sz) * Math.sin(est.th); // + si la cinta queda a la izquierda
    const dE = (eLat - est.eLat) / Math.max(dt, 1e-4);
    est.eLat = eLat;
    const kRuta = Math.abs(ruta.curvatura(c.i));
    // reducción gradual de velocidad ante un obstáculo al frente (20–50 cm), como en el modo demo de la app;
    // en el firmware real solo avisa y, por debajo de 20 cm, detiene el avance
    const cerca = Math.max(0, Math.min(1, (ZONAS.precaucion - est.frente) / (ZONAS.precaucion - ZONAS.critica)));
    const v = (V_NOM - 0.08 * Math.min(1, kRuta / 3)) * (1 - 0.55 * cerca);
    const w = Math.max(-5, Math.min(5, v * kap + KP * eLat + KD * dE));
    const obj = ruedas(v, w);
    const a = 1 - Math.exp(-dt / TAU);
    est.vIzq += (obj.izq - est.vIzq) * a;
    est.vDer += (obj.der - est.vDer) * a;
    const cin = cinematica(est.vIzq, est.vDer);
    est.v = cin.v;
    est.w = cin.w;
    est.th += cin.w * dt;
    est.x += Math.sin(est.th) * cin.v * dt;
    est.z += Math.cos(est.th) * cin.v * dt;
    est.sens = lineaSensores(ruta, est.x, est.z, est.th, est.hint);
    est.frente = ultrasonido(est.x, est.z, est.th, 'frente', obstaculos);
    est.atras = ultrasonido(est.x, est.z, est.th, 'atras', obstaculos);
    return est;
  };

  // lo que se ve de los motores (para las fichas y la animación)
  const motores = () => {
    const dI = dutyPara(est.vIzq);
    const dD = dutyPara(est.vDer);
    const mI = motor(dI, est.vIzq >= 0 ? 1 : -1);
    const mD = motor(dD, est.vDer >= 0 ? 1 : -1);
    const rpmI = (est.vIzq / (Math.PI * R.ruedaD)) * 60;
    const rpmD = (est.vDer / (Math.PI * R.ruedaD)) * 60;
    return {
      dutyIzq: dI,
      dutyDer: dD,
      rpmIzq: rpmI,
      rpmDer: rpmD,
      encIzq: encoderHz(rpmI),
      encDer: encoderHz(rpmD),
      corriente: mI.corriente + mD.corriente,
    };
  };

  return {ruta, obstaculos, est, paso, motores, zonaFrente: () => zonaDe(est.frente), zonaAtras: () => zonaDe(est.atras)};
}

export {GEO};
