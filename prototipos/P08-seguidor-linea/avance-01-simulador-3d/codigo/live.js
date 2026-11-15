// La página del seguidor de línea: el robot recorre la pista provisional con el mismo control PD que llevará el ESP32.
// Se puede cambiar la velocidad base, Kp, Kd, la separación de los sensores, su distancia al eje y la batería.
// Si nadie la toca, hace un recorrido solo con varias vistas; tocar cualquier cosa da el control, y 25 s de calma lo devuelven.
import {warmComposer} from 'teardown-kit/warm.js';
import {BATS, createConsole, VIEWS} from './console.js';
import {crearGranito, crearTeja} from './granito.js';
import {aPiso, control, leerSensores, mover, R, rumbo, velRueda} from './model.js';
import {cercano, crearPista} from './pista.js';
import {RW, ZA} from './robot.js';
import {createStage} from './stage.js';
import {crearAviso, SIN_WEBGL, vigilarContexto} from './arranque.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const DT = 0.002; // paso de la física (s)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

// Valores iniciales: con estos el robot da la vuelta en la pista de prueba (ver la página del avance)
const INICIO = {cfg: {base: 0.8, kp: 0.03, kd: 0.0015}, sep: 0.018, ad: 0.06, bat: 'nominal'};

// vistas: objetivo (relativo al robot), acimut, elevación (grados), distancia (m), y dónde se desvanece el piso
const VIEW = {
  heroe: {tx: 0, ty: 0.04, tz: 0.04, az: 38, el: 24, d: 0.85, fade: [0.28, 0.75]},
  sensores: {tx: 0, ty: 0.004, tz: 0.09, az: 30, el: 42, d: 0.24, fade: [0.16, 0.45]},
  arriba: {tx: 0, ty: 0, tz: 0.12, az: 180, el: 86, d: 1.9, fade: [0.75, 1.3]},
  sigue: {tx: 0, ty: 0.03, tz: 0.12, az: 180, el: 20, d: 0.75, fade: [0.45, 1.0]},
  lado: {tx: 0, ty: 0.035, tz: 0.04, az: 92, el: 7, d: 0.55, fade: [0.25, 0.65]},
};

// el recorrido automático: {t, k} en segundos
const SCRIPT = [
  {t: 0.2, k: 'arrancar'},
  {t: 9, k: 'sensores'},
  {t: 19, k: 'sigue'},
  {t: 29, k: 'arriba'},
  {t: 39, k: 'baja'},
  {t: 40, k: 'heroe'},
  {t: 50, k: 'nominal'},
  {t: 51, k: 'lado'},
];
const CICLO = 60;

const CSS = (top) => `
html,body{background:#EEF3F1;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
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
  document.title = 'Cómo sigue la línea el robot · TG Robot UCAB';
  document.documentElement.lang = 'es';
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);

  const P = crearPista();
  const piso = crearGranito(P);
  const aviso = crearAviso();
  aviso.cargando();
  let st;
  try {
    st = createStage({canvas, pisoCanvas: piso.canvas, tejaCanvas: crearTeja()});
  } catch (e) {
    console.error(e);
    aviso.error(...SIN_WEBGL);
    return;
  }
  vigilarContexto(canvas, aviso);
  let scale = 1;
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const ui = createConsole(app, toStage);
  ui.prepMapa(P);

  // ------------------------------------------------------------ calidad
  const TIERS = [
    {samples: 4, ao: true, shadow: 2048, pr: 2}, // alta: solo si se pide con ?tier=0
    {samples: 2, ao: false, shadow: 1024, pr: 1.5}, // normal en computadora
    {samples: 0, ao: false, shadow: 1024, pr: 1}, // ligera: teléfonos
    {samples: 0, ao: false, shadow: 0, pr: 1, directo: true}, // mínima: sin sombras ni efectos, dibuja directo
  ];
  const MINIMA = TIERS.length - 1;
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  const qs = new URLSearchParams(location.search);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')) || 0, 0, MINIMA) : !st.soportaComposer ? MINIMA : light ? 2 : 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, directo, ...q} = TIERS[tier];
    st.setQuality(q);
    st.setDirecto(!!directo || !st.soportaComposer);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Gira el teléfono para ver la consola completa';
  document.body.appendChild(note);

  // ------------------------------------------------------------ estado
  let T = 0;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const S = {};
  const aSalida = (i = 0) => {
    S.eje = {x: P.X[i], z: P.Z[i], th: rumbo(P.TX[i], P.TZ[i])};
    S.vel = {izq: 0, der: 0};
    S.pwm = {izq: 0, der: 0};
    S.ctrlSt = {};
    S.idx = i;
    S.tc = 0;
  };
  const nuevaVuelta = () => {
    S.vuelta = {t0: T, actual: 0, ultima: S.vuelta?.ultima ?? null, vel: S.vuelta?.vel ?? null, errMax: 0};
    S.progreso = 0;
  };
  const reset = (todo) => {
    if (todo) Object.assign(S, structuredClone(INICIO), {view: 'heroe', viewAt0: T, etiquetas: 1});
    aSalida(0);
    S.corriendo = false;
    S.estado = 'parado';
    S.salidas = 0;
    S.vuelta = null;
    nuevaVuelta();
    S.vuelta.ultima = null;
    S.vuelta.vel = null;
    S.hist = [];
    S.rastro = [];
    S.rastroT = 0;
    S.perdidaT = 0;
    S.salioT = 0;
    S.ang = {izq: 0, der: 0};
    S.flow = {};
    S.lect = leerSensores(P, S.eje, S.sep, S.ad, piso.gran, rnd, S.idx);
    S.ctrl = control({}, S.lect, S.sep, S.cfg);
    S.ctrl.corr = 0;
    S.real = 0;
  };
  reset(true);
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW.heroe};

  // ------------------------------------------------------------ acciones
  const act = (k) => {
    if (k === 'arrancar') {
      S.corriendo = true;
      if (S.estado === 'parado') S.estado = 'sigue';
      if (S.vuelta.actual === 0) S.vuelta.t0 = T;
    } else if (k === 'parar') {
      S.corriendo = false;
      S.estado = 'parado';
    } else if (k === 'reiniciar') {
      const corr = S.corriendo;
      reset(false);
      if (corr) act('arrancar');
    } else if (VIEWS.includes(k)) {
      S.view = k;
      S.viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    } else if (BATS.includes(k)) S.bat = k;
    else if (k === 'etiquetas') S.etiquetas = S.etiquetas ? 0 : 1;
  };

  // ------------------------------------------------------------ el recorrido
  const AP = {on: true, t0: 0, idx: 0};
  let lastInput = 0;
  const startTour = () => {
    Object.assign(S, structuredClone(INICIO));
    AP.on = true;
    AP.t0 = T;
    AP.idx = 0;
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
  for (const k of Object.keys(ui.btn)) ui.btn[k].addEventListener('click', () => (takeOver(), act(k)));
  ui.onTouch = takeOver;
  ui.onSlider = (k, v) => {
    lastInput = T;
    if (k === 'sep' || k === 'ad') S[k] = v;
    else S.cfg[k] = v;
  };
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const map = {r: 'reiniciar', 1: 'heroe', 2: 'sensores', 3: 'arriba', 4: 'sigue', 5: 'lado', l: 'etiquetas'};
    if (key === ' ') act(S.corriendo ? 'parar' : 'arrancar');
    else if (map[key]) act(map[key]);
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

  // ------------------------------------------------------------ la física y el ESP32
  const paso = (dt) => {
    const vbat = R.bat[S.bat];
    let n = Math.round(dt / DT);
    let mov = {v: 0, w: 0};
    while (n-- > 0) {
      S.tc += DT;
      if (S.tc >= 1 / R.hz) {
        S.tc -= 1 / R.hz;
        // el lazo del ESP32: leer, decidir, mandar PWM
        S.lect = leerSensores(P, S.eje, S.sep, S.ad, piso.gran, rnd, S.idx);
        S.ctrl = control(S.ctrlSt, S.lect, S.sep, S.cfg);
        const anda = S.corriendo && S.estado !== 'salio';
        S.pwm = anda ? {izq: S.ctrl.izq, der: S.ctrl.der} : {izq: 0, der: 0};
      }
      mov = mover(S.eje, S.vel, S.pwm, vbat, DT);
      S.ang.izq += (S.vel.izq / RW) * DT;
      S.ang.der += (S.vel.der / RW) * DT;
      const c = cercano(P, S.eje.x, S.eje.z, S.idx, 40);
      let di = c.i - S.idx;
      if (di < -P.N / 2) di += P.N;
      if (di > P.N / 2) di -= P.N;
      S.progreso += di;
      S.idx = c.i;
    }
    // qué tan lejos está el centro de la regleta de la línea (lo que mide la gráfica)
    const [sx, sz] = aPiso(S.eje.x, S.eje.z, S.eje.th, 0, S.ad);
    const cs = cercano(P, sx, sz, S.idx, 120);
    S.real = cs.d * 1000;
    const ejeLejos = Math.abs(cercano(P, S.eje.x, S.eje.z, S.idx, 40).d);
    // estados
    if (S.estado === 'salio') {
      if (T - S.salioT > 1.5) {
        aSalida((S.idx + 20) % P.N);
        S.estado = S.corriendo ? 'sigue' : 'parado';
        S.perdidaT = 0;
      }
    } else if (S.corriendo) {
      S.perdidaT = S.ctrl.perdida ? S.perdidaT + dt : 0;
      if (ejeLejos > 0.12 || S.perdidaT > 1.2) {
        S.estado = 'salio';
        S.salioT = T;
        S.salidas++;
      } else S.estado = S.ctrl.perdida ? 'busca' : 'sigue';
      // vueltas
      if (S.vuelta) {
        S.vuelta.actual = T - S.vuelta.t0;
        S.vuelta.errMax = Math.max(S.vuelta.errMax, Math.abs(S.real));
        if (S.progreso >= P.N) {
          const t = S.vuelta.actual;
          S.vuelta.ultima = t;
          S.vuelta.vel = P.largo / t;
          S.vuelta.t0 = T;
          S.vuelta.actual = 0;
          S.vuelta.errMax = 0;
          S.progreso -= P.N;
        }
      }
    } else S.vuelta.t0 = T - S.vuelta.actual;
    if (S.progreso < -P.N / 4) S.progreso = 0;
    S.hist.push({t: T, d: S.real});
    while (S.hist.length && T - S.hist[0].t > 6) S.hist.shift();
    if (T - S.rastroT > 0.1) {
      S.rastroT = T;
      S.rastro.push([S.eje.x, S.eje.z]);
      if (S.rastro.length > 200) S.rastro.shift();
    }
    return mov;
  };

  // ------------------------------------------------------------ cuadro a cuadro
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  let cuadros = 0;
  const cuadro = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
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
    if (AP.on) {
      let c = T - AP.t0;
      if (c >= CICLO) {
        AP.t0 = T;
        AP.idx = 0;
        c = 0;
      }
      while (AP.idx < SCRIPT.length && SCRIPT[AP.idx].t <= c) act(SCRIPT[AP.idx++].k);
    } else if (T - lastInput > IDLE) startTour();

    const {v} = paso(dt);

    // adentro del motor (para robot.update): inducido 10 veces más lento y sensores Hall
    const arm = {};
    const hall = {};
    for (const lado of ['izq', 'der']) {
      arm[lado] = (S.ang[lado] * R.ratio) / 10;
      const c = (arm[lado] * 11) / (2 * Math.PI);
      const fr = (x) => ((x % 1) + 1) % 1;
      hall[lado] = [fr(c) < 0.5 ? 1 : 0, fr(c - 0.25) < 0.5 ? 1 : 0];
    }
    const pw = (x) => Math.abs(x);
    const A = {
      ena: pw(S.pwm.izq),
      enb: pw(S.pwm.der),
      in1: S.pwm.izq > 0 ? 1 : 0,
      in2: S.pwm.izq < 0 ? 1 : 0,
      in3: S.pwm.der > 0 ? 1 : 0,
      in4: S.pwm.der < 0 ? 1 : 0,
      bat_l298: Math.max(pw(S.pwm.izq), pw(S.pwm.der)),
      bat_lm: 0.5,
      lm_esp: 0.5,
      gnd: 0.4,
      mot_izq: pw(S.pwm.izq),
      mot_der: pw(S.pwm.der),
    };
    for (const lado of ['izq', 'der']) for (const ab of ['a', 'b']) A[`enc_${lado}_${ab}`] = Math.min(1, Math.abs(S.vel[lado]) * 2);
    const fl = S.flow;
    for (const [id, a] of Object.entries(A)) fl[id] = (fl[id] ?? 0) + (0.3 + 0.9 * a) * dt * (id === 'gnd' ? -1 : 1);

    // cámara
    const tgt = {...VIEW[S.view]};
    tgt.az += off.az;
    tgt.el = clamp(tgt.el + off.el, -15, 88);
    tgt.d *= off.k;
    if (S.view === 'sensores') tgt.tz = ZA + S.ad;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.3 : 0.35));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * k;
    cam.fade = [cam.fade?.[0] ?? tgt.fade[0], cam.fade?.[1] ?? tgt.fade[1]];
    cam.fade[0] += (tgt.fade[0] * off.k - cam.fade[0]) * k;
    cam.fade[1] += (tgt.fade[1] * off.k - cam.fade[1]) * k;

    // el piso se mueve bajo el robot: el origen del robot está ZA detrás del eje de las ruedas
    const pose = {x: S.eje.x - Math.sin(S.eje.th) * ZA, z: S.eje.z - Math.cos(S.eje.th) * ZA, th: S.eje.th};
    st.frame(
      {pose, ang: S.ang, arm, hall, xray: 0, explode: 0, wires: 1, flow: fl, act: A, sens: {sep: S.sep, ad: S.ad, n: S.ctrl.n}},
      {...cam, az: cam.az * D2R, el: cam.el * D2R, sy: -40},
    );
    const proj = {};
    for (const [key, p] of Object.entries(st.robot.anchors)) proj[key] = st.project(p);
    proj.sens = st.project(st.sensores.anchor);
    const since = T - S.viewAt0;
    const vbat = R.bat[S.bat];
    ui.update({
      ...S,
      v,
      vbat,
      vMax: velRueda(1, vbat),
      proj,
      labels: S.etiquetas * Math.min(1, Math.max(0, (since - 0.6) / 0.6)) * (['heroe', 'lado'].includes(S.view) ? 1 : 0),
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>RECORRIDO AUTOMÁTICO · TOCA PARA MANEJAR' : '▶ VOLVER AL RECORRIDO';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    cuadros++;
    // Los primeros cuadros se revisan: si el lienzo quedó sin dibujar, se pasa a la calidad mínima (sin efectos)
    if ((cuadros === 2 || cuadros === 30) && tier < MINIMA && st.lienzoVacio()) {
      console.warn('El lienzo quedó vacío con efectos: paso a calidad mínima');
      tier = MINIMA;
      applyTier();
    }
    if (cuadros === 2) aviso.listo();
  };
  // El lazo nunca se corta en silencio: si un cuadro falla, baja a la calidad mínima; si sigue fallando, avisa.
  let fallos = 0;
  const frame = (now) => {
    try {
      cuadro(now);
      fallos = 0;
    } catch (e) {
      console.error(e);
      fallos++;
      if (tier < MINIMA) {
        tier = MINIMA;
        applyTier();
      } else if (fallos > 5) {
        aviso.error('La simulación se detuvo', 'Hubo un error al dibujar: ' + String(e.message || e).slice(0, 120));
        return;
      }
    }
    requestAnimationFrame(frame);
  };
  // Arranca cuando los shaders están listos, pero sin depender de eso: si la preparación falla o tarda más de 2,5 s, arranca igual.
  let arrancado = false;
  const arrancar = () => {
    if (arrancado) return;
    arrancado = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  try {
    warmComposer(st.renderer, st.composer, st.scene, st.camera).then(arrancar, arrancar);
  } catch (e) {
    console.error(e);
  }
  setTimeout(arrancar, 2500);
  window.LIVE = {
    st,
    S,
    P,
    act,
    startTour,
    takeOver,
    paso,
    get T() {
      return T;
    },
    set T(v) {
      T = v;
    },
  };
}
