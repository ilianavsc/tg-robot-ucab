// Simulador 1 de aprendizaje progresivo (P08): el robot recorre una de dos pistas, en modo manual (teclado o botones
// táctiles) o con el seguidor automático, y el panel muestra los datos en vivo para compararlos.
import * as THREE from 'three';
import {SIN_WEBGL, crearAviso, vigilarContexto} from './arranque.js';
import {crearGranito} from './granito.js';
import {crearMundo} from './mundo.js';
import {R} from './model.js';
import {GEOM, PD, crearSim} from './sim.js';
import {IDS_PISTA, PISTAS} from './pista.js';
import {ZA, buildRobot} from './robot.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const f = (v, d = 1) => v.toFixed(d).replace('.', ',');
const sg = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d).replace('.', ',');
const seg = (v) => (v === null || v === undefined ? '—' : `${f(v)} s`);

const aviso = crearAviso();
aviso.cargando();
const canvas = $('#lienzo');
let mundo;
try {
  mundo = crearMundo(canvas);
} catch (e) {
  console.error(e);
  aviso.error(...SIN_WEBGL);
  throw e;
}
vigilarContexto(canvas, aviso);
// deja pintar el aviso antes de generar el granito (tarda un momento)
setTimeout(() => iniciar(mundo), 30);

function iniciar({renderer, scene, camera, controls, sol, pose, resize, ponerPiso, repintado}) {
  const robot = buildRobot({tz: ZA + GEOM.adelante, conos: false});
  pose.add(robot.root);
  const granitos = {};
  const sim = crearSim({
    pistaId: 'A',
    fabricaGran: (P) => {
      const g = (granitos[P.id] ||= crearGranito(P));
      ponerPiso(g.canvas, P.zona);
      return g.gran;
    },
  });
  const anim = {ang: {izq: 0, der: 0}, arm: {izq: 0, der: 0}, flow: {}, act: {}, hall: {izq: [false, false], der: [false, false]}};
  const ui = {vista: 'seguir', t: 0, teclas: new Set(), botones: new Set(), aviso: ''};

  // ---------------------------------------------------------------- cámara
  const yaw = new THREE.Vector3(0, 1, 0);
  const VISTAS = {
    seguir: {nombre: 'Seguir', off: new THREE.Vector3(-0.22, 0.5, -0.8), alto: 0.04},
    cenital: {nombre: 'Cenital', off: new THREE.Vector3(0, 1.35, -0.3), alto: 0.0},
    general: {nombre: 'Panorámica'},
  };
  let tween = null;
  let thPrev = 0;
  const objetivo = (v) => {
    if (v === 'general') {
      const z = sim.P.zona;
      const ancho = sim.pistaId === 'B' ? 4.4 : 3.5;
      const util = canvas.clientWidth >= 900 ? 0.74 : 1; // en escritorio el panel tapa la derecha
      const vert = ((ancho / 2 / Math.tan((camera.fov * Math.PI) / 360)) / Math.min(1, camera.aspect) / util) * 0.85;
      return {pos: new THREE.Vector3(0, Math.max(1.8, vert * 0.85), Math.max(1.2, vert * 0.55)), tgt: new THREE.Vector3(z.x0 + z.ancho / 2, 0, 0)};
    }
    const c = VISTAS[v];
    const k = canvas.clientWidth < 640 ? 1.25 : 1;
    const tgt = new THREE.Vector3(sim.eje.x, c.alto, sim.eje.z);
    return {pos: c.off.clone().multiplyScalar(k).applyAxisAngle(yaw, sim.eje.th).add(tgt), tgt};
  };
  const irA = (v, instantaneo = false) => {
    ui.vista = v;
    $('#b-vista').innerHTML = `<span class="largo">Vista: </span>${VISTAS[v].nombre}`;
    controls.enablePan = v === 'general';
    controls.minDistance = v === 'general' ? 1 : 0.3;
    controls.maxDistance = v === 'general' ? 9 : 3.5;
    thPrev = sim.eje.th;
    if (instantaneo) {
      const o = objetivo(v);
      camera.position.copy(o.pos);
      controls.target.copy(o.tgt);
      tween = null;
    } else tween = {t: 0, p0: camera.position.clone(), t0: controls.target.clone()};
  };
  const avanzaTween = (dt) => {
    tween.t = Math.min(1, tween.t + dt / 0.8);
    const e = tween.t * tween.t * (3 - 2 * tween.t);
    const o = objetivo(ui.vista);
    camera.position.lerpVectors(tween.p0, o.pos, e);
    controls.target.lerpVectors(tween.t0, o.tgt, e);
    if (tween.t >= 1) tween = null;
  };
  const seguirCamara = (dt) => {
    let dth = sim.eje.th - thPrev;
    thPrev = sim.eje.th;
    if (ui.vista === 'general') {
      if (tween) avanzaTween(dt);
      return;
    }
    if (dth > Math.PI) dth -= 2 * Math.PI;
    if (dth < -Math.PI) dth += 2 * Math.PI;
    if (tween) return avanzaTween(dt);
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(yaw, dth);
    controls.target.set(sim.eje.x, VISTAS[ui.vista].alto, sim.eje.z);
    camera.position.copy(controls.target).add(off);
  };
  // en pantallas angostas el panel y el D-Pad ocupan abajo: se corre la vista para que el robot quede más arriba
  const desplazaVista = () => {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (W < 900) camera.setViewOffset(W, H, 0, Math.round(H * 0.13), W, H);
    else camera.setViewOffset(W, H, 170, 0, W, H); // en escritorio el panel de datos ocupa la derecha: la escena se corre a la izquierda
    camera.updateProjectionMatrix();
  };

  // ---------------------------------------------------------------- entrada: teclado y botones táctiles
  const MAPA = {KeyW: 'arriba', ArrowUp: 'arriba', KeyS: 'abajo', ArrowDown: 'abajo', KeyA: 'izq', ArrowLeft: 'izq', KeyD: 'der', ArrowRight: 'der', Space: 'stop'};
  const activo = (k) => ui.teclas.has(k) || ui.botones.has(k);
  const aplicaEntrada = () => {
    const E = sim.entrada;
    E.f = (activo('arriba') ? 1 : 0) - (activo('abajo') ? 1 : 0);
    E.t = (activo('izq') ? 1 : 0) - (activo('der') ? 1 : 0);
    E.freno = activo('stop');
    $$('[data-dp]').forEach((b) => b.classList.toggle('on', activo(b.dataset.dp)));
  };
  const tomaControl = () => {
    if (sim.modo === 'auto') ponModo('manual', 'Control manual: tomaste el mando');
  };
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'KeyR' && !e.repeat) return reiniciar();
    if (e.code === 'KeyM' && !e.repeat) return ponModo(sim.modo === 'auto' ? 'manual' : 'auto');
    const k = MAPA[e.code];
    if (!k) return;
    e.preventDefault();
    if (!ui.teclas.has(k)) {
      ui.teclas.add(k);
      tomaControl();
      aplicaEntrada();
    }
  });
  addEventListener('keyup', (e) => {
    const k = MAPA[e.code];
    if (!k) return;
    e.preventDefault();
    ui.teclas.delete(k);
    aplicaEntrada();
  });
  const soltarTodo = () => {
    ui.teclas.clear();
    ui.botones.clear();
    aplicaEntrada();
  };
  addEventListener('blur', soltarTodo);
  document.addEventListener('visibilitychange', () => document.hidden && soltarTodo());

  // D-Pad: clic sostenido (pointer), y touchstart/touchend como respaldo. Pulsar o soltar es idempotente.
  const pulsa = (k) => {
    if (ui.botones.has(k)) return;
    ui.botones.add(k);
    tomaControl();
    aplicaEntrada();
  };
  const suelta = (k) => {
    if (!ui.botones.delete(k)) return;
    aplicaEntrada();
  };
  $$('[data-dp]').forEach((b) => {
    const k = b.dataset.dp;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        /* el navegador no lo permite: no pasa nada */
      }
      pulsa(k);
    });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerleave']) b.addEventListener(ev, () => suelta(k));
    b.addEventListener('touchstart', (e) => {
      e.preventDefault();
      pulsa(k);
    }, {passive: false});
    for (const ev of ['touchend', 'touchcancel']) b.addEventListener(ev, (e) => {
      e.preventDefault();
      suelta(k);
    }, {passive: false});
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('keydown', (e) => {
      // Enter o espacio sobre el botón no deben pulsarlo "de verdad": el teclado ya maneja el carro
      if (e.code === 'Enter') e.preventDefault();
    });
  });

  // ---------------------------------------------------------------- botones de la barra
  const ponModo = (m, texto = '') => {
    sim.setModo(m);
    $$('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === m)));
    document.body.dataset.modo = m;
    $('#modo-txt').textContent = texto || (m === 'auto' ? 'Seguidor automático: el robot sigue la línea solo' : 'Modo manual: W A S D o flechas · Espacio frena');
  };
  const ponPista = (id) => {
    soltarTodo();
    sim.setPista(id);
    $$('[data-pista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pista === id)));
    $('#pista-desc').textContent = PISTAS[id].descripcion;
    construyeBarra();
    irA(ui.vista, true);
  };
  const reiniciar = () => {
    soltarTodo();
    sim.reiniciar();
    irA(ui.vista, true);
  };
  $$('[data-modo]').forEach((b) => b.addEventListener('click', () => ponModo(b.dataset.modo)));
  $$('[data-pista]').forEach((b) => b.addEventListener('click', () => ponPista(b.dataset.pista)));
  $('#b-reiniciar').addEventListener('click', reiniciar);
  $('#b-vista').addEventListener('click', () => {
    const orden = ['seguir', 'cenital', 'general'];
    irA(orden[(orden.indexOf(ui.vista) + 1) % orden.length]);
  });
  const panel = $('#datos');
  const bMas = $('#b-mas');
  bMas.addEventListener('click', () => {
    const abierto = panel.classList.toggle('abierto');
    bMas.setAttribute('aria-expanded', String(abierto));
    bMas.textContent = abierto ? 'Menos datos ▾' : 'Más datos ▴';
  });
  const dpad = $('#dpad');
  const bDpad = $('#b-dpad');
  bDpad.addEventListener('click', () => {
    const v = dpad.classList.toggle('oculto');
    bDpad.setAttribute('aria-pressed', String(!v));
    if (v) soltarTodo();
  });
  // el D-Pad se muestra de entrada en pantallas táctiles o angostas
  const tactil = matchMedia('(pointer:coarse)').matches || innerWidth < 900;
  dpad.classList.toggle('oculto', !tactil);
  bDpad.setAttribute('aria-pressed', String(tactil));
  canvas.addEventListener('pointerdown', () => {
    window.focus();
    $('#aviso-teclado').hidden = true;
  });
  const avisoTeclado = () => ($('#aviso-teclado').hidden = document.hasFocus() || tactil);
  addEventListener('focus', avisoTeclado);
  addEventListener('blur', () => ($('#aviso-teclado').hidden = tactil));

  // ---------------------------------------------------------------- ajustes del PD
  const aj = [
    ['base', 'Base', 0.4, 1, 0.05, (v) => `${Math.round(v * 100)} %`],
    ['kp', 'Kp', 0.005, 0.06, 0.005, (v) => f(v, 3)],
    ['kd', 'Kd', 0, 0.004, 0.0005, (v) => f(v, 4)],
  ];
  const ajustes = $('#ajustes-cuerpo');
  ajustes.innerHTML =
    aj.map(([k, n, mn, mx, st]) => `<label>${n} <output data-o="${k}"></output><input type="range" data-aj="${k}" min="${mn}" max="${mx}" step="${st}" value="${PD[k]}"></label>`).join('') +
    `<label>Batería <select data-aj="vbat"><option value="12.6">Llena · 12,6 V</option><option value="11.1" selected>Nominal · 11,1 V</option><option value="9.9">Baja · 9,9 V</option></select></label>
     <button type="button" class="btn chico" id="b-pd-reset">Valores del firmware</button>`;
  const pintaAj = () => aj.forEach(([k, , , , , fm]) => ($(`[data-o="${k}"]`).textContent = fm(sim.pd[k])));
  ajustes.addEventListener('input', (e) => {
    const k = e.target.dataset.aj;
    if (!k) return;
    if (k === 'vbat') sim.vbat = Number(e.target.value);
    else sim.pd[k] = Number(e.target.value);
    pintaAj();
  });
  $('#b-pd-reset').addEventListener('click', () => {
    Object.assign(sim.pd, PD);
    sim.vbat = R.bat.nominal;
    $$('[data-aj]').forEach((el) => (el.value = el.dataset.aj === 'vbat' ? '11.1' : PD[el.dataset.aj]));
    pintaAj();
  });
  pintaAj();

  // ---------------------------------------------------------------- panel de datos
  const set = (id, txt) => {
    const el = $('#' + id);
    if (el.textContent !== txt) el.textContent = txt;
  };
  const sqs = $$('.sq');
  const barra = $('#progreso');
  const construyeBarra = () => {
    const P = sim.P;
    barra.innerHTML = P.tramos.map((t, i) => `<i style="flex:${t.hastaM - t.desdeM}" class="t${i % 4}" title="${t.id}"><b>${t.id}</b></i>`).join('') + '<span id="marca"></span>';
  };
  const refresca = () => {
    const L = sim.lectura();
    L.bin.forEach((b, i) => sqs[i].classList.toggle('on', !!b));
    set('v-bin', `[${L.bin.join(',')}]`);
    set('v-raw', L.raw.join(' · '));
    set('v-emed', `${sg(L.eMedido)} mm`);
    set('v-ereal', `${sg(L.eReal)} mm`);
    $('#v-estado').textContent = L.perdida ? 'Línea perdida' : 'En la línea';
    $('#v-estado').dataset.ok = L.perdida ? '0' : '1';
    set('v-vel', `${f(Math.abs(L.v), 2)} m/s`);
    set('v-dist', `${f(L.distancia, 1)} m`);
    set('v-rumbo', `${Math.round(L.rumbo)}°`);
    set('v-vuelta', `${L.vuelta} · ${seg(L.tVuelta)}`);
    set('v-ultima', `${seg(L.ultimaVuelta)} (mejor ${seg(L.mejorVuelta)})`);
    set('v-tramo', `${L.tramo.id} · ${seg(L.tramo.t)}`);
    set('v-tramo-prev', L.tramoPrev ? `${L.tramoPrev.id}: ${seg(L.tramoPrev.t)}` : '—');
    set('v-salidas', String(L.salidas));
    set('v-pwm', `${Math.round(L.pwm.izq * 100)} / ${Math.round(L.pwm.der * 100)} %`);
    set('v-prog', `${f(L.progresoM, 2)} de ${f(L.largo, 2)} m`);
    $('#marca').style.left = `${(L.progresoM / L.largo) * 100}%`;
    $('#tramo-nombre').textContent = `${L.tramo.nombre}${L.tramo.linea ? '' : ' · sin cinta'}`;
    // tabla de comparación
    const filas = sim.resumen().sort((a, b) => (a.pista + a.modo).localeCompare(b.pista + b.modo));
    $('#comparacion tbody').innerHTML = filas.length
      ? filas
          .map((r) => `<tr><th scope="row">${r.pista} · ${r.modo === 'auto' ? 'auto' : 'manual'}</th><td>${r.vueltas}</td><td>${r.mejor === null ? '—' : f(r.mejor)}</td><td>${f(r.vmedia, 2)}</td><td>${f(r.emax)}</td><td>${f(r.erms)}</td><td>${r.salidas}</td></tr>`)
          .join('')
      : '<tr><td colspan="7">Sin datos todavía</td></tr>';
  };

  // ---------------------------------------------------------------- animación del robot
  const FLUJO = ['ena', 'enb', 'in1', 'in2', 'in3', 'in4', 'bat_l298', 'bat_lm', 'lm_esp', 'gnd', 'tcrt', 'us_f', 'us_r', 'mot_izq', 'mot_der', 'enc_izq_a', 'enc_izq_b', 'enc_der_a', 'enc_der_b'];
  const animar = (dt) => {
    const RW = 0.0325;
    anim.ang.izq += (sim.vel.izq / RW) * dt;
    anim.ang.der += (sim.vel.der / RW) * dt;
    anim.arm.izq = anim.ang.izq * 4;
    anim.arm.der = anim.ang.der * 4;
    for (const lado of ['izq', 'der']) {
      const fa = (((anim.arm[lado] * 11) / (2 * Math.PI)) % 1 + 1) % 1;
      const fb = (fa + 0.25) % 1;
      anim.hall[lado] = [fa < 0.5, fb < 0.5];
    }
    const a = anim.act;
    const di = Math.abs(sim.pwm.izq);
    const dd = Math.abs(sim.pwm.der);
    a.ena = di;
    a.enb = dd;
    a.in1 = sim.pwm.izq > 0.01 ? 1 : 0;
    a.in2 = sim.pwm.izq < -0.01 ? 1 : 0;
    a.in3 = sim.pwm.der > 0.01 ? 1 : 0;
    a.in4 = sim.pwm.der < -0.01 ? 1 : 0;
    a.bat_l298 = (di + dd) / 2;
    a.mot_izq = di;
    a.mot_der = dd;
    a.bat_lm = a.lm_esp = 0.55;
    a.gnd = 0.4;
    a.tcrt = a.us_f = a.us_r = 0.7;
    a.enc_izq_a = a.enc_izq_b = Math.min(1, Math.abs(sim.vel.izq) / 0.5);
    a.enc_der_a = a.enc_der_b = Math.min(1, Math.abs(sim.vel.der) / 0.5);
    for (const id of FLUJO) anim.flow[id] = ((anim.flow[id] ?? 0) + dt * (0.35 + 1.1 * (a[id] ?? 0))) % 1;
  };

  // ---------------------------------------------------------------- bucle
  let ultimo = performance.now();
  let acRef = 0;
  const bucle = (ahora) => {
    const dt = Math.min(0.25, (ahora - ultimo) / 1000);
    ultimo = ahora;
    ui.t += dt;
    sim.avanzar(dt);
    animar(dt);
    // el eje de las ruedas está ZA delante del centro del chasis
    pose.position.set(sim.eje.x - Math.sin(sim.eje.th) * ZA, 0, sim.eje.z - Math.cos(sim.eje.th) * ZA);
    pose.rotation.y = sim.eje.th;
    robot.update({
      ang: anim.ang, arm: anim.arm, xray: 0, explode: 0, wires: 1, t: ui.t, flow: anim.flow, act: anim.act, hall: anim.hall,
      sens: sim.lectura().bin, zonaF: 'libre', zonaR: 'libre', dF: Infinity, dR: Infinity, sel: null,
    });
    sol.position.set(sim.eje.x + 1.0, 2.4, sim.eje.z + 0.8);
    sol.target.position.set(sim.eje.x, 0, sim.eje.z);
    seguirCamara(dt);
    controls.update();
    renderer.render(scene, camera);
    acRef += dt;
    if (acRef > 0.1) {
      acRef = 0;
      refresca();
    }
    requestAnimationFrame(bucle);
  };

  // ---------------------------------------------------------------- arranque
  new ResizeObserver(() => {
    resize();
    desplazaVista();
  }).observe(canvas);
  resize();
  desplazaVista();
  ponModo('auto');
  ponPista('A');
  irA('seguir', true);
  aviso.listo();
  requestAnimationFrame(bucle);
  avisoTeclado();

  // ayuda para capturas y pruebas del navegador
  window.SIM1 = {sim, ui, irA, ponModo, ponPista, reiniciar, camera, controls, pulsa, suelta, IDS_PISTA, repintado};
}
