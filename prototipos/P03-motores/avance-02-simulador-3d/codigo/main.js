// Vitrina autónoma de los componentes reales del robot: el robot recorre solo una ruta cerrada de
// demostración mientras se ven sus sensores trabajando. Sin control por teclado.
import * as THREE from 'three';
import {SIN_WEBGL, crearAviso, vigilarContexto} from './arranque.js';
import {crearDemo} from './demo.js';
import {ETIQUETAS, FICHAS, ORDEN, fmtDist} from './fichas.js';
import {crearMundo} from './mundo.js';
import {R} from './model.js';
import {buildRobot, RW} from './robot.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const num = (v, d = 2) => v.toFixed(d).replace('.', ',');

const aviso = crearAviso();
aviso.cargando();

const canvas = $('#lienzo');
let mundo;
try {
  const demo = crearDemo();
  mundo = {demo, ...crearMundo(canvas, demo.ruta, demo.obstaculos)};
} catch (e) {
  console.error(e);
  aviso.error(...SIN_WEBGL);
  throw e;
}
vigilarContexto(canvas, aviso);
iniciar(mundo);

function iniciar({demo, renderer, scene, camera, controls, sol, pose, resize}) {
  const robot = buildRobot();
  pose.add(robot.root);
  // aro de ubicación: solo se ve en la vista panorámica, donde el robot es pequeño
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 48), new THREE.MeshBasicMaterial({color: '#F2603D', transparent: true, opacity: 0.85, depthWrite: false}));
  aro.rotation.x = -Math.PI / 2;
  aro.position.y = 0.004;
  aro.visible = false;
  pose.add(aro);
  const est = demo.est;

  // ---------------------------------------------------------------- estado de la interfaz
  const ui = {pausa: false, xray: 0, xrayMeta: 0, etiquetas: true, vista: 'inspeccion', sel: null, t: 0};
  const anim = {
    ang: {izq: 0, der: 0},
    arm: {izq: 0, der: 0},
    flow: {},
    act: {},
    hall: {izq: [false, false], der: [false, false]},
  };

  // ---------------------------------------------------------------- cámara
  const VISTAS = {
    seguir: {off: new THREE.Vector3(-0.3, 0.45, -0.8), alto: 0.05},
    inspeccion: {off: new THREE.Vector3(0.38, 0.3, 0.46), alto: 0.05},
    general: {pos: new THREE.Vector3(0, 3.3, 3.0), tgt: new THREE.Vector3(0, 0, 0.05)},
  };
  const yaw = new THREE.Vector3(0, 1, 0);
  let tween = null;
  let thPrev = est.th;
  const objetivoVista = (v) => {
    const c = VISTAS[v];
    if (v === 'general') return {pos: c.pos.clone(), tgt: c.tgt.clone()};
    const tgt = new THREE.Vector3(est.x, c.alto, est.z);
    const k = canvas.clientWidth < 640 ? 1.6 : 1; // en pantallas angostas la cámara se aleja un poco
    const pos = c.off.clone().multiplyScalar(k).applyAxisAngle(yaw, est.th).add(tgt);
    return {pos, tgt};
  };
  const irA = (v, instantaneo = false) => {
    ui.vista = v;
    aro.visible = v === 'general';
    $$('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === v)));
    controls.enablePan = v === 'general';
    controls.minDistance = v === 'general' ? 1 : 0.25;
    controls.maxDistance = v === 'general' ? 7 : 3;
    if (instantaneo) {
      const o = objetivoVista(v);
      camera.position.copy(o.pos);
      controls.target.copy(o.tgt);
      tween = null;
    } else {
      tween = {t: 0, p0: camera.position.clone(), t0: controls.target.clone()};
    }
  };
  const seguirCamara = (dt) => {
    if (ui.vista === 'general') {
      if (tween) avanzarTween(dt);
      return;
    }
    let dth = est.th - thPrev;
    if (dth > Math.PI) dth -= 2 * Math.PI;
    if (dth < -Math.PI) dth += 2 * Math.PI;
    thPrev = est.th;
    if (tween) {
      avanzarTween(dt);
      return;
    }
    // seguimiento rígido: la cámara acompaña al robot (traslación y giro), conservando lo que el usuario orbitó
    const off = camera.position.clone().sub(controls.target).applyAxisAngle(yaw, dth);
    controls.target.set(est.x, VISTAS[ui.vista].alto, est.z);
    camera.position.copy(controls.target).add(off);
  };
  const avanzarTween = (dt) => {
    tween.t = Math.min(1, tween.t + dt / 0.9);
    const e = tween.t * tween.t * (3 - 2 * tween.t);
    const o = objetivoVista(ui.vista);
    camera.position.lerpVectors(tween.p0, o.pos, e);
    controls.target.lerpVectors(tween.t0, o.tgt, e);
    if (tween.t >= 1) tween = null;
  };

  // en pantallas angostas la ficha sube desde abajo: se corre la vista para que el robot quede arriba, a la vista
  const desplazaVista = () => {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    if (W < 640 && !ficha.hidden) camera.setViewOffset(W, H, 0, Math.round(H * 0.2), W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  };

  // ---------------------------------------------------------------- botones
  const bPausa = $('#b-pausa');
  const ponPausa = (p) => {
    ui.pausa = p;
    bPausa.setAttribute('aria-pressed', String(p));
    $('.tx', bPausa).textContent = p ? 'Reanudar' : 'Pausar';
    bPausa.classList.toggle('en-pausa', p);
  };
  bPausa.addEventListener('click', () => ponPausa(!ui.pausa));
  const bX = $('#b-xray');
  bX.addEventListener('click', () => {
    ui.xrayMeta = ui.xrayMeta ? 0 : 1;
    bX.setAttribute('aria-pressed', String(!!ui.xrayMeta));
  });
  const bE = $('#b-etiq');
  const ponEtiquetas = (on) => {
    ui.etiquetas = on;
    bE.setAttribute('aria-pressed', String(on));
    $('#etiquetas').hidden = !on;
    $('#guias').style.display = on ? '' : 'none';
  };
  bE.addEventListener('click', () => ponEtiquetas(!ui.etiquetas));
  $$('[data-vista]').forEach((b) => b.addEventListener('click', () => irA(b.dataset.vista)));

  // ---------------------------------------------------------------- tira de componentes y ficha
  const ficha = $('#ficha');
  const tira = $('#tira');
  tira.innerHTML = ORDEN.map((id) => {
    const f = FICHAS[id];
    const extra = id === 'tcrt' ? '<span class="sq" aria-hidden="true"></span>'.repeat(4) : '';
    return `<button class="chip" data-comp="${id}" style="--c:${f.color}" aria-pressed="false"><b>${esc(f.corto)}</b><span class="v" data-v="${id}">${extra}</span></button>`;
  }).join('');
  const fCuerpo = $('#f-cuerpo');
  const abrirFicha = (id) => {
    ui.sel = id;
    $$('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.comp === id)));
    $$('.et').forEach((e) => e.classList.toggle('act', e.dataset.comp === id));
    if (!id) {
      ficha.hidden = true;
      desplazaVista();
      return;
    }
    const f = FICHAS[id];
    ficha.style.setProperty('--c', f.color);
    $('#f-titulo').textContent = f.nombre;
    const est2 = f.estado;
    fCuerpo.innerHTML = `
      <span class="chip-estado ${est2[0]}">${esc(est2[1])}</span>
      <p class="rol">${esc(f.rol)}</p>
      <h3>En vivo</h3><dl class="vivo" id="f-vivo"></dl>
      <h3>Datos del proyecto</h3>
      <dl class="datos">${f.datos.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
      <p class="nota">${esc(f.nota)}</p>`;
    refrescaFicha();
    ficha.hidden = false;
    desplazaVista();
    fCuerpo.scrollTop = 0;
  };
  $('#f-cerrar').addEventListener('click', () => abrirFicha(null));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.sel) abrirFicha(null);
  });
  tira.addEventListener('click', (e) => {
    const b = e.target.closest('[data-comp]');
    if (b) abrirFicha(ui.sel === b.dataset.comp ? null : b.dataset.comp);
  });

  // ---------------------------------------------------------------- etiquetas 3D con guías
  const cont = $('#etiquetas');
  const guias = $('#guias');
  const etq = ORDEN.map((id) => {
    const el = document.createElement('button');
    el.className = 'et';
    el.dataset.comp = id;
    el.style.setProperty('--c', FICHAS[id].color);
    cont.appendChild(el);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    guias.appendChild(ln);
    return {id, el, ln, w: 0, h: 0, x: 0, y: 0, txt: ''};
  });
  cont.addEventListener('click', (e) => {
    const b = e.target.closest('[data-comp]');
    if (b) abrirFicha(ui.sel === b.dataset.comp ? null : b.dataset.comp);
  });

  // ---------------------------------------------------------------- selección con clic en el 3D
  const ray = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let down = null;
  const pick = (ev) => {
    const r = canvas.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(robot.pickables, false)[0];
    return hit ? hit.object.userData.comp : null;
  };
  canvas.addEventListener('pointerdown', (ev) => (down = {x: ev.clientX, y: ev.clientY, t: performance.now()}));
  canvas.addEventListener('pointerup', (ev) => {
    if (!down) return;
    const mov = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    const dur = performance.now() - down.t;
    down = null;
    if (mov > 6 || dur > 600) return;
    const id = pick(ev);
    if (id) abrirFicha(id === ui.sel ? null : id);
  });
  let movPend = null;
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.buttons) return;
    movPend = ev;
  });

  // ---------------------------------------------------------------- lectura en vivo
  const vista = () => {
    const m = demo.motores();
    return {sens: est.sens, dF: est.frente, dR: est.atras, zonaF: demo.zonaFrente(), zonaR: demo.zonaAtras(), mot: m, v: est.v, w: est.w, th: est.th};
  };
  function refrescaFicha() {
    if (!ui.sel) return;
    const f = FICHAS[ui.sel];
    $('#f-vivo').innerHTML = f.vivo(vista()).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  }
  const refrescaTira = () => {
    const v = vista();
    const txt = {
      us_front: fmtDist(v.dF),
      us_rear: fmtDist(v.dR),
      esp32: 'MQTT + PWM',
      mpu: 'heading hold',
      traccion: `${num(v.v)} m/s`,
      bateria: `${num(R.vbat, 1)} V nominal`,
    };
    for (const id of ORDEN) {
      const el = $(`[data-v="${id}"]`, tira);
      if (id === 'tcrt') $$('.sq', el).forEach((q, i) => q.classList.toggle('on', !!v.sens[i]));
      else el.textContent = txt[id];
      if (id === 'us_front' || id === 'us_rear') el.dataset.zona = id === 'us_front' ? v.zonaF : v.zonaR;
    }
    $('#estado').textContent = `Ruta cerrada de demostración · vuelta ${est.vuelta + 1} · ${num(est.v)} m/s${ui.pausa ? ' · en pausa' : ''}`;
  };

  // ---------------------------------------------------------------- animación de la pieza
  const FLUJO = ['ena', 'enb', 'in1', 'in2', 'in3', 'in4', 'bat_l298', 'bat_lm', 'lm_esp', 'gnd', 'tcrt', 'us_f', 'us_r', 'mot_izq', 'mot_der', 'enc_izq_a', 'enc_izq_b', 'enc_der_a', 'enc_der_b'];
  const animar = (dt) => {
    const m = demo.motores();
    anim.ang.izq += (est.vIzq / RW) * dt;
    anim.ang.der += (est.vDer / RW) * dt;
    anim.arm.izq = anim.ang.izq * 4;
    anim.arm.der = anim.ang.der * 4;
    const fase = (a, o) => ((a * 11) / (2 * Math.PI) + o) % 1;
    for (const lado of ['izq', 'der']) {
      const f = (fase(anim.arm[lado], 0) + 1) % 1;
      const g = (fase(anim.arm[lado], 0.25) + 1) % 1;
      anim.hall[lado] = [f < 0.5, g < 0.5];
    }
    const a = anim.act;
    a.ena = m.dutyIzq;
    a.enb = m.dutyDer;
    a.in1 = est.vIzq > 0.01 ? 1 : 0;
    a.in2 = est.vIzq < -0.01 ? 1 : 0;
    a.in3 = est.vDer > 0.01 ? 1 : 0;
    a.in4 = est.vDer < -0.01 ? 1 : 0;
    a.bat_l298 = (m.dutyIzq + m.dutyDer) / 2;
    a.mot_izq = m.dutyIzq;
    a.mot_der = m.dutyDer;
    a.bat_lm = a.lm_esp = 0.55;
    a.gnd = 0.4;
    a.tcrt = a.us_f = a.us_r = 0.7;
    a.enc_izq_a = a.enc_izq_b = Math.min(1, m.encIzq / 400);
    a.enc_der_a = a.enc_der_b = Math.min(1, m.encDer / 400);
    for (const id of FLUJO) anim.flow[id] = ((anim.flow[id] ?? 0) + dt * (0.35 + 1.1 * (a[id] ?? 0))) % 1;
  };

  // ---------------------------------------------------------------- etiquetas: posición en pantalla
  const proj = new THREE.Vector3();
  const centro = new THREE.Vector3();
  const colocaEtiquetas = () => {
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const estrecho = W < 640;
    const v = vista();
    centro.set(0, 0.06, 0.0);
    pose.localToWorld(centro).project(camera);
    const cx = (centro.x * 0.5 + 0.5) * W;
    const cy = (-centro.y * 0.5 + 0.5) * H;
    const top = estrecho ? 108 : 58;
    const bot = H - (estrecho ? 86 : 64);
    const dcha = ficha.hidden || estrecho ? W : W - 346;
    const lista = [];
    for (const e of etq) {
      const A = robot.anchors[e.id];
      proj.copy(A);
      pose.localToWorld(proj);
      const lejos = proj.distanceTo(camera.position);
      proj.project(camera);
      if (proj.z > 1 || lejos > 2.2) {
        e.el.style.display = 'none';
        e.ln.style.display = 'none';
        continue;
      }
      const ax = (proj.x * 0.5 + 0.5) * W;
      const ay = (-proj.y * 0.5 + 0.5) * H;
      const t = (estrecho ? ETIQUETAS[e.id].corto : ETIQUETAS[e.id].largo)(v);
      if (t !== e.txt) {
        e.el.textContent = t;
        e.txt = t;
        e.w = e.h = 0;
      }
      e.el.style.display = '';
      if (!e.w) {
        e.w = e.el.offsetWidth;
        e.h = e.el.offsetHeight;
      }
      let dx = ax - cx;
      let dy = ay - cy;
      const m = Math.hypot(dx, dy) || 1;
      const off = estrecho ? 30 : 46;
      dx /= m;
      dy /= m;
      if (Math.abs(dx) < 0.25 && Math.abs(dy) < 0.25) dy = -1;
      e.ax = ax;
      e.ay = ay;
      e.x = ax + dx * off + (dx >= 0 ? e.w / 2 : -e.w / 2) * Math.abs(dx);
      e.y = ay + dy * off;
      lista.push(e);
    }
    // separa las que se pisan
    for (let it = 0; it < 6; it++) {
      for (let i = 0; i < lista.length; i++) {
        for (let j = i + 1; j < lista.length; j++) {
          const a = lista[i];
          const b = lista[j];
          const ox = (a.w + b.w) / 2 + 4 - Math.abs(a.x - b.x);
          const oy = (a.h + b.h) / 2 + 3 - Math.abs(a.y - b.y);
          if (ox > 0 && oy > 0) {
            const s = (a.y <= b.y ? 1 : -1) * (oy / 2 + 0.5);
            a.y -= s;
            b.y += s;
          }
        }
      }
    }
    for (const e of lista) {
      const x = Math.min(Math.max(e.x, e.w / 2 + 6), dcha - e.w / 2 - 6);
      const y = Math.min(Math.max(e.y, top + e.h / 2), bot - e.h / 2);
      e.el.style.transform = `translate(${Math.round(x - e.w / 2)}px, ${Math.round(y - e.h / 2)}px)`;
      e.ln.style.display = '';
      e.ln.setAttribute('x1', e.ax.toFixed(1));
      e.ln.setAttribute('y1', e.ay.toFixed(1));
      e.ln.setAttribute('x2', x.toFixed(1));
      e.ln.setAttribute('y2', y.toFixed(1));
      e.ln.style.stroke = FICHAS[e.id].color;
    }
  };

  // ---------------------------------------------------------------- bucle
  let ultimo = performance.now();
  let acRefresco = 0;
  let acPaso = 0;
  const PASO = 1 / 120;
  const bucle = (ahora) => {
    const dt = Math.min(0.25, (ahora - ultimo) / 1000);
    ultimo = ahora;
    ui.t += dt;
    if (!ui.pausa) {
      // paso fijo de 1/120 s: el control no depende de los cuadros por segundo del navegador
      acPaso += dt;
      while (acPaso >= PASO) {
        demo.paso(PASO);
        animar(PASO);
        acPaso -= PASO;
      }
    }
    ui.xray += (ui.xrayMeta - ui.xray) * Math.min(1, dt * 6);
    if (aro.visible) aro.scale.setScalar(1 + 0.12 * Math.sin(ui.t * 4));
    pose.position.set(est.x, 0, est.z);
    pose.rotation.y = est.th;
    robot.update({
      ang: anim.ang,
      arm: anim.arm,
      xray: ui.xray,
      explode: 0,
      wires: 1,
      t: ui.t,
      flow: anim.flow,
      act: anim.act,
      hall: anim.hall,
      sens: est.sens,
      zonaF: demo.zonaFrente(),
      zonaR: demo.zonaAtras(),
      dF: est.frente,
      dR: est.atras,
      sel: ui.sel,
    });
    // la luz con sombra acompaña al robot
    sol.position.set(est.x + 1.0, 2.4, est.z + 0.8);
    sol.target.position.set(est.x, 0, est.z);
    seguirCamara(dt);
    controls.update();
    if (movPend) {
      canvas.style.cursor = pick(movPend) ? 'pointer' : '';
      movPend = null;
    }
    renderer.render(scene, camera);
    if (ui.etiquetas) colocaEtiquetas();
    acRefresco += dt;
    if (acRefresco > 0.12) {
      acRefresco = 0;
      refrescaTira();
      refrescaFicha();
    }
    requestAnimationFrame(bucle);
  };

  // ---------------------------------------------------------------- arranque
  new ResizeObserver(() => {
    resize();
    desplazaVista();
  }).observe(canvas);
  resize();
  irA('inspeccion', true);
  ponEtiquetas(true);
  // pasos iniciales para que no arranque en cero
  for (let i = 0; i < 240; i++) {
    demo.paso(1 / 120);
    animar(1 / 120);
  }
  thPrev = est.th;
  irA('inspeccion', true);
  refrescaTira();
  aviso.listo();
  requestAnimationFrame(bucle);

  // ayuda para las capturas y las pruebas
  window.VITRINA = {
    demo,
    ui,
    abrirFicha,
    irA,
    ponPausa,
    ponEtiquetas,
    xray: (on) => {
      ui.xrayMeta = on ? 1 : 0;
      bX.setAttribute('aria-pressed', String(!!on));
    },
    camera,
    controls,
  };
}
