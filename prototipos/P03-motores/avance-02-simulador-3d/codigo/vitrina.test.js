/* Pruebas del núcleo de la vitrina autónoma de P03 (ruta cerrada, sensores y modelo de tracción).
 * Uso:  node prototipos/P03-motores/avance-02-simulador-3d/codigo/vitrina.test.js
 * No necesita navegador ni dependencias: solo prueba la parte sin three.js. */
import assert from 'node:assert';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crearDemo} from './demo.js';
import {R, VMAX, dutyPara, encoderHz} from './model.js';
import {CINTA, GEO, OBSTACULOS, crearRuta, lineaSensores, ultrasonido, zonaDe} from './ruta.js';

const aqui = dirname(fileURLToPath(import.meta.url));
let ok = 0;
const prueba = (nombre, f) => {
  f();
  ok++;
  console.log('  OK   ' + nombre);
};

// Corre la demo y junta lo que pasa en la vuelta
function correr(seg, alPaso) {
  const d = crearDemo();
  for (let t = 0; t < seg; t += 1 / 120) {
    d.paso(1 / 120);
    alPaso && alPaso(d, t);
  }
  return d;
}

prueba('la ruta es un circuito cerrado de unos 6,6 m, sin curvas de menos de 20 cm de radio', () => {
  const r = crearRuta();
  assert.ok(Math.abs(r.largo - 6.66) < 0.4, `largo ${r.largo}`);
  const a = r.en(0);
  const b = r.en(r.largo - 1e-6);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01);
  let kmax = 0;
  for (let i = 0; i < r.N; i++) kmax = Math.max(kmax, Math.abs(r.curvatura(i)));
  assert.ok(1 / kmax > 0.2, `radio mínimo ${1 / kmax}`);
});

prueba('el robot da vueltas completas solo, sin perder nunca la cinta', () => {
  let maxErr = 0;
  let perdidas = 0;
  const d = correr(60, (dd) => {
    maxErr = Math.max(maxErr, dd.ruta.cercano(dd.est.x, dd.est.z, dd.est.hint).dist);
    if (dd.est.sens.join('') === '0000') perdidas++;
  });
  assert.ok(d.est.vuelta >= 3, `vueltas ${d.est.vuelta}`);
  assert.ok(maxErr < 0.02, `error lateral ${maxErr}`);
  assert.strictEqual(perdidas, 0);
});

prueba('la regleta de 4 TCRT5000 lee [0,1,1,0] centrada y cambia al desviarse', () => {
  const r = crearRuta();
  const p = r.en(1.0);
  const th = Math.atan2(p.tx, p.tz);
  const lee = (lat) => lineaSensores(r, p.x + Math.cos(th) * lat, p.z - Math.sin(th) * lat, th, Math.round((1.0 / r.largo) * r.N)).join('');
  // con el robot en un tramo recto, la posición de los sensores va 11 cm adelante: se prueba cerca del centro de la cinta
  const centrado = lee(0);
  assert.ok(['0110', '0100', '0010'].includes(centrado), centrado);
  assert.strictEqual(lee(0.2), '0000'); // lejos de la cinta
  assert.strictEqual(GEO.tcrtX.length, 4);
  assert.ok(Math.abs(GEO.tcrtX[0] - GEO.tcrtX[1] - 0.018) < 1e-9); // separación de 18 mm
  assert.strictEqual(CINTA, 0.019);
});

prueba('en la vuelta aparecen varias lecturas de la regleta, incluida la centrada [0,1,1,0]', () => {
  const vistos = new Set();
  correr(30, (d) => vistos.add(d.est.sens.join('')));
  assert.ok(vistos.has('0110'), [...vistos].join());
  assert.ok(vistos.size >= 3, [...vistos].join());
});

prueba('las zonas del HC-SR04P: < 20 cm crítica, 20–50 cm precaución, > 50 cm libre', () => {
  assert.strictEqual(zonaDe(0.19), 'critica');
  assert.strictEqual(zonaDe(0.2), 'precaucion');
  assert.strictEqual(zonaDe(0.49), 'precaucion');
  assert.strictEqual(zonaDe(0.5), 'libre');
  assert.strictEqual(zonaDe(Infinity), 'libre');
});

prueba('el ultrasonido mide la distancia a un bidón desde la cara del sensor', () => {
  const o = {x: 0, z: GEO.usF.z + 0.4 + 0.045, r: 0.045};
  const d = ultrasonido(0, 0, 0, 'frente', [o]);
  assert.ok(Math.abs(d - 0.4) < 0.005, `d ${d}`);
  assert.strictEqual(ultrasonido(0, 0, 0, 'atras', [o]), Infinity); // el de atrás mira al otro lado
  const o2 = {x: 0, z: GEO.usR.z - 0.3 - 0.045, r: 0.045};
  assert.ok(Math.abs(ultrasonido(0, 0, 0, 'atras', [o2]) - 0.3) < 0.005);
});

prueba('en el recorrido los dos HC-SR04P pasan por precaución y el frontal también por crítica', () => {
  const z = {f: new Set(), a: new Set()};
  correr(40, (d) => {
    z.f.add(d.zonaFrente());
    z.a.add(d.zonaAtras());
  });
  assert.ok(z.f.has('precaucion') && z.f.has('critica') && z.f.has('libre'), [...z.f].join());
  assert.ok(z.a.has('precaucion') && z.a.has('libre'), [...z.a].join());
  assert.strictEqual(OBSTACULOS.length, 3);
});

prueba('modelo único: Speed 200 con L298N a 11,1 V da ≈ 0,57 m/s al 100 % y 656 Hz de encoder', () => {
  assert.ok(Math.abs(VMAX - 0.57) < 0.01, `VMAX ${VMAX}`);
  assert.ok(Math.abs(encoderHz(168) - 656) < 2);
  assert.strictEqual(R.ratio, 21.3);
  assert.ok(dutyPara(0.4) > 0.6 && dutyPara(0.4) < 0.8);
});

prueba('la demo no copia la máquina de estados de teach-and-repeat ni usa teclado', () => {
  const archivos = readdirSync(aqui).filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'));
  for (const f of archivos) {
    const t = readFileSync(join(aqui, f), 'utf8');
    assert.ok(!/FOLLOW_LINE|LINE_LOST_CHECK|HEADING_HOLD|WAIT_BEACON|REACQUIRE_LINE/.test(t), `${f} duplica estados`);
    assert.ok(!/keydown|keyup|ArrowUp|ArrowLeft|WASD/.test(t.replace(/addEventListener\('keydown', \(e\) => \{\s*if \(e\.key === 'Escape'/, '')), `${f} usa teclado`);
  }
});

prueba('el texto de la vitrina usa teach-and-repeat y no usa términos de otras tecnologías', () => {
  const todo = ['fichas.js', 'main.js', 'plantilla.html'].map((f) => readFileSync(join(aqui, f), 'utf8')).join('\n');
  const prohibido = new RegExp(['\\bI', 'A\\b|inteligencia ', 'artificial'].join(''), 'i'); // sin escribir la sigla completa
  assert.ok(!prohibido.test(todo));
  assert.ok(/teach-and-repeat/.test(todo));
  assert.ok(/GPIO 15/.test(todo));
});

console.log(`\nP03 vitrina: ${ok}/${ok} pruebas pasaron`);
