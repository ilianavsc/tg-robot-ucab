// Prueba sin pantalla: corre el mismo modelo y el mismo control PD de la página y dice cuánto tarda cada vuelta.
// Uso: [G=1] [PISTA=A|B] node pruebas.mjs KP KD BASE SEPARACION_MM ADELANTE_MM VOLTIOS SEGUNDOS
// Ejemplo (valores iniciales, pista A): G=1 node pruebas.mjs 0.03 0.0015 0.8 18 60 11.1 70
// G=1 agrega el granito; sin G el piso es liso. PISTA=B corre el recorrido canónico de 9,0 m.
import {crearPista, cercano} from './pista.js';
import {crearGranito} from './granito.js';
import {R, mover, rumbo} from './model.js';
import {leerSensores, control} from './linea.js';
const P = crearPista(process.env.PISTA || 'A'); const GR = process.env.G ? crearGranito(P).gran : null;
const [kp, kd, base, sep, ad, vb, T] = process.argv.slice(2).map(Number);
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const eje = {x: P.X[0], z: P.Z[0], th: rumbo(P.TX[0], P.TZ[0])};
const vel = {izq: 0, der: 0}; const st = {}; let pwm = {izq: 0, der: 0};
let idx = 0, maxd = 0, perd = 0, laps = [], tl = 0, prog = 0, sq = 0, n = 0;
const dt = 0.002; let tc = 0;
for (let t = 0; t < T; t += dt) {
  tc += dt;
  if (tc >= 1 / R.hz) { tc -= 1 / R.hz;
    const l = leerSensores(P, eje, sep / 1000, ad / 1000, GR, rnd, idx);
    const c = control(st, l, sep / 1000, {kp, kd, base}); pwm = c; if (c.perdida) perd++;
  }
  mover(eje, vel, pwm, vb, dt);
  const c = cercano(P, eje.x, eje.z, idx, 40);
  const sp = [eje.x + Math.sin(eje.th) * ad / 1000, eje.z + Math.cos(eje.th) * ad / 1000]; const cs = cercano(P, sp[0], sp[1], idx, 120);
  let di = c.i - idx; if (di < -P.N / 2) di += P.N; if (di > P.N / 2) di -= P.N;
  prog += di; idx = c.i;
  if (t > 1) { maxd = Math.max(maxd, Math.abs(cs.d)); sq += cs.d * cs.d; n++; }
  if (prog >= P.N) { prog -= P.N; laps.push((t - tl).toFixed(2)); tl = t; }
  if (Math.abs(c.d) > 0.25) { console.log('SE SALIO', t.toFixed(2)); break; }
}
const pf=(perd/(T*R.hz)*100).toFixed(1); console.log(`pista ${P.id} | perd% ${pf} | largo ${P.largo.toFixed(2)} m rmin ${(P.rmin*100).toFixed(1)} cm | vueltas ${laps} | vel ${(P.largo/laps[1]||0).toFixed(3)} | eje max ${(maxd*1000).toFixed(1)} mm rms ${(Math.sqrt(sq/n)*1000).toFixed(1)} | perdida ${perd}`);
