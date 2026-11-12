// La página que se maneja: maniobras, fuerza (PWM), driver, versión del motor, vistas y lo que se ve.
// Si nadie la toca, hace un recorrido solo con su cursor; un clic, arrastre, rueda o tecla te da el control,
// y 25 s de calma devuelven el recorrido.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, DISPLAY, MAN, VIEWS} from './console.js';
import {cinematica, encoder, entradasH, MANIOBRAS, motor, R} from './model.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const TAU = 0.18; // constante de tiempo de la rueda (s)
const LENTO_INDUCIDO = 10; // el inducido y el imán se ven 10 veces más lentos
const LENTO_SCOPE = 50; // el osciloscopio, 50 veces
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// vistas: objetivo, acimut, elevación (grados), distancia (m)
const VIEW = {
  heroe: {tx: 0, ty: 0.04, tz: 0.0, az: 38, el: 24, d: 0.8},
  frente: {tx: 0, ty: 0.045, tz: 0.0, az: 0, el: 9, d: 0.72},
  arriba: {tx: 0, ty: 0.05, tz: 0.0, az: 0.01, el: 84, d: 0.8},
  motor: {tx: 0.055, ty: 0.034, tz: 0.03, az: -24, el: 9, d: 0.31},
  puente: {tx: -0.03, ty: 0.064, tz: 0.042, az: -12, el: 62, d: 0.34},
};

// el recorrido: clics programados (en segundos). {k} es un botón, {slider} la fuerza.
const SCRIPT = [
  {t: 1.6, k: 'avanzar'},
  {t: 4.8, slider: 1.0},
  {t: 9.5, k: 'puente'},
  {t: 13.5, k: 'retroceder'},
  {t: 17.0, k: 'avanzar'},
  {t: 20.0, k: 'etiquetas'},
  {t: 21.0, k: 'motor'},
  {t: 23.0, k: 'rayos'},
  {t: 29.0, k: 'derecha'},
  {t: 32.0, k: 'avanzar'},
  {t: 34.0, k: 'heroe'},
  {t: 35.5, k: 'despiece'},
  {t: 41.0, k: 'despiece'},
  {t: 43.0, k: 'm130'},
  {t: 47.0, k: 'tb6612'},
  {t: 51.0, k: 'm170'},
  {t: 54.5, k: 'arriba'},
  {t: 55.5, k: 'izquierda'},
  {t: 59.5, k: 'l298n'},
  {t: 61.5, k: 'frenar'},
  {t: 62.5, k: 'rayos'},
  {t: 63.5, k: 'etiquetas'},
];
const CICLO = 67;

const CSS = (top) => `
html,body{background:#EEF3F1;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.97)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:104px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:26px;padding:0 13px;border:1.5px solid #14213D;border-radius:999px;background:#fff;color:#14213D;font:700 9.5px 'JetBrains Mono',monospace;letter-spacing:1.2px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:7px;height:7px;border-radius:50%;background:#F2603D}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:14px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#4A5A73;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  document.title = 'Cómo se mueve el robot · TG Robot UCAB';
  document.documentElement.lang = 'es';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);

  // ------------------------------------------------------------ calidad
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  const qs = new URLSearchParams(location.search);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Gira el teléfono para ver la consola completa';
  document.body.appendChild(note);

  // ------------------------------------------------------------ estado
  let T = 0;
  const S = {};
  const reset = () => {
    Object.assign(S, {
      man: 'frenar',
      duty: 0.75,
      driver: 'l298n',
      variante: 200,
      view: 'heroe',
      viewAt0: T,
      display: {etiquetas: 1, rayos: 0, despiece: 0, cables: 1, girar: 0},
      dispT: {etiquetas: -9, rayos: -9, despiece: -9, cables: -9, girar: -9},
      rpm: {izq: 0, der: 0},
      ang: {izq: 0, der: 0},
      cuenta: {izq: 0, der: 0},
      scope: 0,
      pose: {x: 0.8, z: -0.15, th: 0},
      flow: {},
    });
  };
  reset();
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW.heroe};
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.7) => {
    const x = ss(S.dispT[k], S.dispT[k] + dur, T);
    return S.display[k] ? x : 1 - x;
  };
  const pulse = (k) => {
    const p = ui.spots[k];
    if (p) ring = {t: T, x: p[0], y: p[1]};
  };

  // ------------------------------------------------------------ acciones (las usan el visitante y el recorrido)
  const act = (k) => {
    if (MAN.includes(k)) S.man = k;
    else if (VIEWS.includes(k)) {
      S.view = k;
      S.viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    } else if (DISPLAY.includes(k)) {
      S.display[k] = S.display[k] ? 0 : 1;
      S.dispT[k] = T;
      if (k === 'despiece' && S.display.despiece) S.man = 'frenar';
    } else if (k === 'l298n' || k === 'tb6612') S.driver = k;
    else if (k === 'm130') S.variante = 130;
    else if (k === 'm170') S.variante = 200;
  };

  // ------------------------------------------------------------ el recorrido
  const AP = {on: true, t0: 0, idx: 0, loop: 0};
  let lastInput = 0;
  const startTour = () => {
    reset();
    AP.on = true;
    AP.t0 = T;
    AP.idx = 0;
    AP.loop = 0;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    AP.on = false;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });
  const spotOf = (ev) => (ev.k ? ui.spots[ev.k] : [ui.SL.x + ui.SL.w * ev.slider, ui.SL.y]);
  const tourCursor = (c) => {
    // va hacia el próximo clic en los 0,9 s previos y aprieta en el instante del clic
    let i = SCRIPT.findIndex((e) => e.t > c);
    if (i < 0) i = SCRIPT.length;
    const prev = SCRIPT[i - 1];
    const next = SCRIPT[i];
    const home = [800, 640];
    const a = prev ? spotOf(prev) : home;
    const b = next ? spotOf(next) : home;
    const k = next ? ss(next.t - 0.9, next.t - 0.05, c) : 0;
    const press = prev && c - prev.t < 0.18;
    return {x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, press};
  };

  // ------------------------------------------------------------ controles
  for (const k of Object.keys(ui.btn))
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulse(k);
      act(k);
    });
  {
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${ui.SL.x - 10}px`, top: `${ui.SL.y - 13}px`, width: `${ui.SL.w + 20}px`, height: '26px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      S.duty = Math.round(clamp((x - ui.SL.x) / ui.SL.w, 0, 1) * 100) / 100;
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const map = {arrowup: 'avanzar', arrowdown: 'retroceder', arrowleft: 'izquierda', arrowright: 'derecha', ' ': 'frenar', 1: 'heroe', 2: 'frente', 3: 'arriba', 4: 'motor', 5: 'puente', x: 'rayos', e: 'despiece', c: 'cables', l: 'etiquetas'};
    if (map[key]) ui.btn[map[key]].click();
    else if (key === '+' || key === '=') S.duty = clamp(S.duty + 0.05, 0, 1);
    else if (key === '-') S.duty = clamp(S.duty - 0.05, 0, 1);
    else return;
    takeOver();
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -20, 70);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.4);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ cuadro a cuadro
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const lados = ['izq', 'der'];
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    // el recorrido dispara sus clics
    let cursor;
    if (AP.on) {
      let c = T - AP.t0;
      if (c >= CICLO) {
        startTour();
        AP.loop = 1;
        c = 0;
      }
      while (AP.idx < SCRIPT.length && SCRIPT[AP.idx].t <= c) {
        const ev = SCRIPT[AP.idx++];
        if (ev.k) {
          act(ev.k);
          pulse(ev.k);
        } else {
          S.duty = ev.slider;
          ring = {t: T, x: ui.SL.x + ui.SL.w * ev.slider, y: ui.SL.y};
        }
      }
      // el arrastre del slider en el recorrido: la fuerza sube con el cursor
      const sl = SCRIPT.find((e) => e.slider !== undefined && c > e.t - 0.9 && c < e.t);
      if (sl) S.duty = Math.max(S.duty, Math.round((0.75 + (sl.slider - 0.75) * ss(sl.t - 0.6, sl.t, c)) * 100) / 100);
      const tc = tourCursor(c);
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {...tc, ring: rk, ringX: ring.x, ringY: ring.y};
    } else {
      if (T - lastInput > IDLE) startTour();
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }

    // la física: cada rueda persigue su rpm con un retardo
    const M = MANIOBRAS[S.man];
    const out = {};
    for (const lado of lados) {
      const dir = M[lado];
      const m = motor(S.duty, dir, S.driver, S.variante);
      S.rpm[lado] += (m.rpm - S.rpm[lado]) * (1 - Math.exp(-dt / TAU));
      S.ang[lado] += (S.rpm[lado] / 60) * 2 * Math.PI * dt;
      const e = encoder(S.rpm[lado], S.variante);
      S.cuenta[lado] += e.hz * 4 * dt * Math.sign(S.rpm[lado]);
      out[lado] = {dir, in: entradasH(dir), m, rpm: S.rpm[lado], vel: (Math.PI * R.ruedaD * S.rpm[lado]) / 60, hz: e.hz, cuenta: S.cuenta[lado]};
    }
    const {v, w} = cinematica(out.izq.vel, out.der.vel);
    S.pose.th += w * dt;
    S.pose.x += Math.sin(S.pose.th) * v * dt;
    S.pose.z += Math.cos(S.pose.th) * v * dt;
    if (Math.hypot(S.pose.x, S.pose.z) > 3) Object.assign(S.pose, {x: 0.8, z: -0.15, th: 0});
    const enc0 = encoder(1, S.variante);
    S.scope += (out.izq.hz * dt) / LENTO_SCOPE;

    // adentro del motor: inducido e imán del encoder en cámara lenta
    const arm = {};
    const hall = {};
    for (const lado of lados) {
      const ratio = out[lado].m.ratio;
      arm[lado] = (S.ang[lado] * ratio) / LENTO_INDUCIDO;
      const blink = (Math.abs(out[lado].rpm * ratio) / 60 / LENTO_INDUCIDO) * 11;
      const c = (arm[lado] * 11) / (2 * Math.PI);
      const fr = (x) => ((x % 1) + 1) % 1;
      hall[lado] = blink > 12 ? [1, 1] : [fr(c) < 0.5 ? 1 : 0, fr(c - 0.25) < 0.5 ? 1 : 0];
    }

    // lo que corre por los cables
    const on = (lado) => (out[lado].dir !== 0 ? S.duty : 0);
    const A = {
      ena: on('izq'),
      enb: on('der'),
      in1: out.izq.in[0],
      in2: out.izq.in[1],
      in3: out.der.in[0],
      in4: out.der.in[1],
      bat_l298: Math.max(on('izq'), on('der')),
      bat_lm: 0.5,
      lm_esp: 0.5,
      gnd: 0.4,
      mot_izq: on('izq'),
      mot_der: on('der'),
      enc_izq_a: Math.min(1, out.izq.hz / 250),
      enc_izq_b: Math.min(1, out.izq.hz / 250),
      enc_der_a: Math.min(1, out.der.hz / 250),
      enc_der_b: Math.min(1, out.der.hz / 250),
    };
    const fl = S.flow;
    const adv = (id, sp) => (fl[id] = (fl[id] ?? 0) + sp * dt);
    for (const id of ['ena', 'enb', 'in1', 'in2', 'in3', 'in4']) adv(id, 0.7);
    adv('bat_l298', 0.3 + 0.9 * A.bat_l298);
    adv('bat_lm', 0.4);
    adv('lm_esp', 0.4);
    adv('gnd', -0.35);
    adv('mot_izq', (0.3 + 0.9 * S.duty) * Math.sign(out.izq.dir));
    adv('mot_der', (0.3 + 0.9 * S.duty) * Math.sign(out.der.dir));
    for (const lado of lados) for (const ab of ['a', 'b']) adv(`enc_${lado}_${ab}`, Math.min(1.6, out[lado].hz / 300));

    // cámara
    const since = T - S.viewAt0;
    const tgt = {...VIEW[S.view]};
    tgt.az += off.az + (S.display.girar ? 12 * (T - S.dispT.girar) : 0);
    tgt.el = clamp(tgt.el + off.el, -15, 88);
    tgt.d *= off.k;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.22 : 0.35));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * k;

    const explode = eased('despiece', 0.9);
    st.frame(
      {pose: S.pose, ang: S.ang, arm, hall, xray: eased('rayos'), explode, wires: eased('cables', 0.5), flow: fl, act: A},
      {...cam, az: cam.az * D2R, el: cam.el * D2R, sy: -40},
    );
    const proj = {};
    for (const [key, p] of Object.entries(st.robot.anchors)) proj[key] = st.project(p);
    const vMax = motor(S.duty, 1, S.driver, S.variante).vel;
    ui.update({
      man: S.man,
      nombre: M.nombre,
      v,
      w,
      vMax,
      duty: S.duty,
      driver: S.driver,
      variante: S.variante,
      view: S.view,
      display: S.display,
      izq: out.izq,
      der: out.der,
      scope: S.scope,
      porVuelta: enc0.porVuelta,
      proj,
      labels: eased('etiquetas', 0.5) * ss(0.6, 1.2, since) * (1 - explode) * (['heroe', 'frente', 'arriba'].includes(S.view) ? 1 : 0),
      cursor,
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>RECORRIDO AUTOMÁTICO · TOCA PARA MANEJAR' : '▶ VOLVER AL RECORRIDO';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {
    st,
    S,
    cam,
    act,
    startTour,
    takeOver,
    get T() {
      return T;
    },
    get tier() {
      return tier;
    },
  };
}
