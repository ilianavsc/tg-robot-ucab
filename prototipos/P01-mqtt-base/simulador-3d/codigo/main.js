// P01 · Así viajan los mensajes: App, Broker y Robot en 3D. Los tópicos y QoS son los del sketch y del banco de pruebas.
import * as THREE from 'three';
import {crearAviso, SIN_WEBGL, vigilarContexto} from './arranque.js';
import {BASE, ESPERA_LWT_S, KEEPALIVE_S, TOPICOS, alarma, confirmacion, pedido, publicar, qosEfectivo, SUSCRIPCION, tramo} from './protocolo.js';

const C = {bg: '#EEF3F1', tinta: '#14213D', sale: '#0F9D84', llega: '#F2603D', qos: '#6B4EE6', pend: '#F2B33D', rojo: '#D93025'};
const X = {app: -5.2, broker: 0, robot: 5.2};
const NOMBRE = {app: 'APP', broker: 'BROKER', robot: 'ROBOT'};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- DOM ----------
const app = document.getElementById('app');
app.innerHTML = `
<canvas id="gl"></canvas>
<header class="barra"><div><span class="ceja">P01 · MQTT</span><h1>Así viajan los mensajes</h1></div>
  <p class="sub">El robot y la app nunca se hablan directo: pasan por el <b>broker</b>, un cartero que reparte.</p></header>
<aside class="panel" id="panel">
  <h2>QoS de la orden</h2>
  <div class="qos" role="group" aria-label="Calidad de servicio de la orden">
    <button data-q="0" class="qb">QoS 0<small>1 paso</small></button>
    <button data-q="1" class="qb on">QoS 1<small>2 pasos</small></button>
    <button data-q="2" class="qb">QoS 2<small>4 pasos</small></button>
  </div>
  <p class="nota" id="qosnota"></p>
  <button class="acc llega" id="b-orden">Enviar orden</button>
  <button class="acc qosb" id="b-manip">Manipulación</button>
  <button class="acc pend" id="b-lwt">Desconexión (LWT)</button>
  <button class="acc sale" id="b-reco" hidden>Reconectar el robot</button>
  <label class="lento"><input type="checkbox" id="lento"> Cámara lenta</label>
  <div class="tiempo" id="tiempo" hidden><span>El broker espera 1,5 × keepalive (<b>15 s</b>) = 22,5 s</span><div class="barra-t"><i id="tfill"></i></div><small id="tdet"></small></div>
</aside>
<aside class="leyenda" id="leyenda"></aside>
<section class="consola"><div class="cons-cab"><b>Consola</b><span>lo que ve el broker</span><button id="b-limpiar">Limpiar</button></div><div id="log" role="log" aria-live="polite"></div></section>`;

// ---------- Estado ----------
const S = {qos: 1, robotOn: true, ocupado: false, n: 0, recibidas: 0, alarmas: 0, pendientes: [], appEstado: 'en línea', alerta: false, ultimo: 'sin pedidos todavía', lento: false};
const t0 = performance.now();
const logEl = document.getElementById('log');
function log(txt, color = C.tinta, tag = '') {
  const s = ((performance.now() - t0) / 1000).toFixed(1).padStart(5, ' ');
  const d = document.createElement('div');
  d.className = 'ln';
  d.innerHTML = `<time>${s}s</time>${tag ? `<span class="tag" style="background:${color}">${tag}</span>` : ''}<span class="tx">${txt.replace(/</g, '&lt;')}</span>`;
  logEl.appendChild(d);
  logEl.scrollTop = logEl.scrollHeight;
}
document.getElementById('b-limpiar').onclick = () => (logEl.innerHTML = '');

// leyenda de tópicos
document.getElementById('leyenda').innerHTML = '<h2>Buzones</h2>' + Object.values(TOPICOS).map((t) =>
  `<div class="top"><i style="background:${t.color}"></i><div><code>${t.nombre.replace(BASE, '…/')}</code><small>QoS ${t.qos} · ${t.nota}</small></div></div>`).join('');

// ---------- Escena ----------
const canvas = document.getElementById('gl');
const LIVIANO = true; // una sola versión: la optimizada (sin sombras), para que no vaya lenta
const aviso = crearAviso();
aviso.cargando();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
} catch (e) {
  console.error(e);
  aviso.error(...SIN_WEBGL);
  throw e;
}
vigilarContexto(canvas, aviso);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = !LIVIANO;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(C.bg, 1);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.Fog(C.bg, 22, 52);
const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
scene.add(new THREE.HemisphereLight('#ffffff', '#cfd9d5', 1.05));
const sol = new THREE.DirectionalLight('#ffffff', 1.9);
sol.position.set(-4, 11, 8);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
Object.assign(sol.shadow.camera, {left: -12, right: 12, top: 8, bottom: -8, near: 1, far: 30});
sol.shadow.bias = -0.0004;
sol.shadow.radius = 5;
scene.add(sol);

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: 0.55, metalness: 0.05, ...o});
const piso = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), mat('#F1F6F4', {roughness: 0.95}));
piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
scene.add(piso);
const rej = new THREE.GridHelper(60, 60, '#cdd9d4', '#d9e3df');
rej.position.y = 0.002;
rej.material.transparent = true;
rej.material.opacity = 0.55;
scene.add(rej);

// etiquetas de texto (sprites)
function texto(txt, {size = 54, color = C.tinta, bg = null, mono = false, w = 512, h = 128} = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthTest: false}));
  sp.renderOrder = 10;
  sp.userData.set = (t, col = color, fondo = bg) => {
    g.clearRect(0, 0, w, h);
    g.font = `700 ${size}px ${mono ? 'JetBrains Mono' : 'Bricolage Grotesque'}, sans-serif`;
    const m = Math.min(w - 20, g.measureText(t).width + 44);
    if (fondo) {
      g.fillStyle = fondo;
      g.beginPath();
      g.roundRect((w - m) / 2, 14, m, h - 28, 22);
      g.fill();
    }
    g.fillStyle = col;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t, w / 2, h / 2 + 3, w - 24);
    tex.needsUpdate = true;
  };
  sp.userData.set(txt);
  sp.scale.set((w / h) * 0.9, 0.9, 1);
  return sp;
}

// --- APP: un teléfono con pantalla que se redibuja ---
const appG = new THREE.Group();
appG.position.set(X.app, 0, 0);
const tel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.0, 0.22), mat('#1b2540', {roughness: 0.35}));
tel.position.y = 1.7;
tel.castShadow = true;
appG.add(tel);
const pantCv = document.createElement('canvas');
pantCv.width = 340;
pantCv.height = 600;
const pantTex = new THREE.CanvasTexture(pantCv);
pantTex.colorSpace = THREE.SRGBColorSpace;
const pant = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.72), new THREE.MeshBasicMaterial({map: pantTex}));
pant.position.set(0, 1.7, 0.115);
appG.add(pant);
const pie = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.12, 1.1), mat('#cfd9d5'));
pie.position.y = 0.06;
pie.receiveShadow = true;
appG.add(pie);
function dibujarApp() {
  const g = pantCv.getContext('2d');
  const rojo = S.alerta;
  g.fillStyle = rojo ? C.rojo : '#F7FAF9';
  g.fillRect(0, 0, 340, 600);
  g.fillStyle = rojo ? '#9d1c12' : C.tinta;
  g.fillRect(0, 0, 340, 74);
  g.fillStyle = '#fff';
  g.font = '700 34px Bricolage Grotesque, sans-serif';
  g.textAlign = 'left';
  g.fillText('Robot UCAB', 22, 49);
  const tx = (t, x, y, f, col, al = 'left') => {
    g.font = f;
    g.fillStyle = col;
    g.textAlign = al;
    g.fillText(t, x, y);
  };
  const fg = rojo ? '#fff' : C.tinta;
  if (rojo) {
    tx('¡ALERTA!', 170, 200, '700 54px Bricolage Grotesque, sans-serif', '#fff', 'center');
    tx('Manipulación del', 170, 262, '700 30px Atkinson Hyperlegible, sans-serif', '#fff', 'center');
    tx('robot detectada', 170, 300, '700 30px Atkinson Hyperlegible, sans-serif', '#fff', 'center');
    tx('QoS 2 · llegó una sola vez', 170, 368, '400 22px JetBrains Mono, monospace', '#ffd9d5', 'center');
    tx('alarma #' + S.alarmas, 170, 400, '400 22px JetBrains Mono, monospace', '#ffd9d5', 'center');
  } else {
    const on = S.appEstado === 'en línea';
    g.fillStyle = on ? C.sale : C.pend;
    g.beginPath();
    g.arc(40, 130, 13, 0, 7);
    g.fill();
    tx('Robot ' + S.appEstado, 66, 140, '700 30px Atkinson Hyperlegible, sans-serif', fg);
    tx('Último pedido', 22, 210, '400 22px Atkinson Hyperlegible, sans-serif', '#5b6b7a');
    const partes = S.ultimo.split('\n');
    partes.forEach((p, i) => tx(p, 22, 250 + i * 34, '700 28px Atkinson Hyperlegible, sans-serif', fg));
    tx('Pedidos confirmados: ' + S.recibidas, 22, 400, '400 22px Atkinson Hyperlegible, sans-serif', '#5b6b7a');
  }
  g.fillStyle = rojo ? '#fff' : C.llega;
  g.beginPath();
  g.roundRect(22, 510, 296, 64, 16);
  g.fill();
  tx(rojo ? 'Revisar el robot' : 'Pedir componente', 170, 551, '700 28px Atkinson Hyperlegible, sans-serif', rojo ? C.rojo : '#fff', 'center');
  pantTex.needsUpdate = true;
}
scene.add(appG);

// --- BROKER: el cartero central ---
const brG = new THREE.Group();
brG.position.set(X.broker, 0, 0);
const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.18, 48), mat('#cfd9d5'));
base.position.y = 0.09;
base.receiveShadow = true;
brG.add(base);
const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.25, 2.1, 48), mat(C.qos, {roughness: 0.4}));
cuerpo.position.y = 1.25;
cuerpo.castShadow = true;
brG.add(cuerpo);
for (let i = 0; i < 4; i++) { // los buzones: ranuras
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.05), mat('#1b1250'));
  const a = (i / 4) * Math.PI * 2 + 0.4;
  r.position.set(Math.sin(a) * 1.2, 1.35 + (i % 2) * 0.3, Math.cos(a) * 1.2);
  r.rotation.y = a;
  brG.add(r);
}
const tapa = new THREE.Mesh(new THREE.SphereGeometry(1.15, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8a73f2', {roughness: 0.35}));
tapa.position.y = 2.3;
tapa.castShadow = true;
brG.add(tapa);
const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 12), mat(C.tinta));
antena.position.y = 3.65;
brG.add(antena);
const bolita = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 16), new THREE.MeshBasicMaterial({color: C.pend}));
bolita.position.y = 4.0;
brG.add(bolita);
scene.add(brG);

// --- ROBOT: chasis, ruedas, barra de sensores, ESP32 ---
const roG = new THREE.Group();
roG.position.set(X.robot, 0, 0);
roG.rotation.y = -0.5;
const chasMat = mat('#f4f6f5', {roughness: 0.45});
const chasis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 1.5), chasMat);
chasis.position.y = 0.72;
chasis.castShadow = true;
roG.add(chasis);
const tapaR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.1), mat('#dfe7e4'));
tapaR.position.y = 1.0;
tapaR.castShadow = true;
roG.add(tapaR);
const esp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.45), mat('#0b6b5a', {roughness: 0.4}));
esp.position.set(-0.1, 1.1, 0);
roG.add(esp);
const chip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.3), mat('#bfc7c3', {metalness: 0.7, roughness: 0.3}));
chip.position.set(-0.25, 1.16, 0);
roG.add(chip);
const barra = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 1.3), mat('#14213D'));
barra.position.set(1.15, 0.5, 0);
roG.add(barra);
for (const z of [-0.5, -0.17, 0.17, 0.5]) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.22), mat('#2b5fc7'));
  s.position.set(1.2, 0.42, z);
  roG.add(s);
}
const llanta = new THREE.MeshStandardMaterial({color: '#20242b', roughness: 0.9});
for (const z of [-0.88, 0.88]) {
  const w = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.26, 36), llanta);
  w.rotation.x = Math.PI / 2;
  w.position.set(0, 0.46, z);
  w.castShadow = true;
  roG.add(w);
}
const rueda = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), llanta);
rueda.position.set(-0.85, 0.2, 0);
roG.add(rueda);
const led = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), new THREE.MeshBasicMaterial({color: C.sale}));
led.position.set(0.55, 1.14, 0.35);
roG.add(led);
scene.add(roG);

// etiquetas fijas
const rot = [[appG, 'APP', 3.45], [brG, 'BROKER', 3.4], [roG, 'ROBOT', 2.7]];
for (const [g, t, y] of rot) {
  const l = texto(t, {size: 60, w: 360});
  l.position.set(g.position.x, y + 0.25, 0);
  scene.add(l);
}
const contRobot = texto('', {size: 36, w: 600, h: 100, mono: true});
contRobot.position.set(X.robot, 2.0, 0);
contRobot.scale.set(3.1, 0.52, 1);
scene.add(contRobot);
const nota = texto('', {size: 34, w: 760, h: 110, bg: C.pend, color: C.tinta});
nota.position.set(X.robot - 0.4, 4.25, 0);
nota.scale.set(3.9, 0.56, 1);
nota.visible = false;
scene.add(nota);
function actualizarContador() {
  contRobot.userData.set(S.robotOn ? `pedidos recibidos: ${S.recibidas}` : 'SIN CONEXIÓN', S.robotOn ? C.tinta : '#fff', S.robotOn ? null : C.rojo);
}

// caminos (las "carreteras" entre nodos)
function carretera(x1, x2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1 - 3.4, 0.03, 1.1), mat('#d3dedb'));
  m.position.set((x1 + x2) / 2, 0.02, 0);
  m.receiveShadow = true;
  scene.add(m);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1 - 3.6, 0.035, 0.04), mat('#f7fbf9'));
  dash.position.set((x1 + x2) / 2, 0.04, 0);
  scene.add(dash);
  return m;
}
const ruta1 = carretera(X.app, X.broker);
const ruta2 = carretera(X.broker, X.robot);
const cruz = texto('✕', {size: 120, color: '#fff', bg: C.rojo, w: 200, h: 140});
cruz.position.set((X.broker + X.robot) / 2, 1.1, 0);
cruz.scale.set(1.2, 0.84, 1);
cruz.visible = false;
scene.add(cruz);

// ---------- Paquetes ----------
const paquetes = [];
let reloj = 0; // ms de animación: avanza con cada cuadro (máximo 50 ms), así no se desordena si la pestaña va lenta
const pos = (n) => new THREE.Vector3(X[n], 1.35, 0);
function crearPaquete(de, a, paquete, topico, color, conf) {
  const g = new THREE.Group();
  const r = conf ? 0.16 : 0.26;
  const bola = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 20), new THREE.MeshBasicMaterial({color: conf ? '#ffffff' : color}));
  g.add(bola);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 1.9, 24, 20), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.28, depthWrite: false}));
  g.add(halo);
  if (conf) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(r * 1.25, 0.04, 8, 28), new THREE.MeshBasicMaterial({color}));
    g.add(aro);
  }
  const luz = new THREE.PointLight(color, 5, 4.5, 2);
  g.add(luz);
  const et = texto(paquete, {size: 44, w: 380, h: 96, bg: color, color: '#fff'});
  et.position.set(0, 0.62, 0);
  et.scale.set(1.5, 0.38, 1);
  g.add(et);
  scene.add(g);
  return g;
}
function viaja(de, a, paquete, topico, color, ms) {
  const conf = ['PUBACK', 'PUBREC', 'PUBCOMP'].includes(paquete);
  S.ultimoPaquete = paquete;
  const g = crearPaquete(de, a, paquete, topico, color, conf);
  const p0 = pos(de);
  const p1 = pos(a);
  const carril = conf ? 0.42 : -0.1; // las confirmaciones van por otro carril para verse rebotar
  return new Promise((res) => {
    paquetes.push({g, p0, p1, carril, ms: ms * (S.lento ? 2.2 : 1) * (S.escala || 1), t0: reloj, res});
  });
}
function mueveTodo(now) {
  now = reloj;
  for (let i = paquetes.length - 1; i >= 0; i--) {
    const k = paquetes[i];
    const u = Math.min(1, (now - k.t0) / k.ms);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    k.g.position.lerpVectors(k.p0, k.p1, e);
    k.g.position.y += Math.sin(Math.PI * e) * 1.15;
    k.g.position.z = k.carril * Math.sin(Math.PI * e) * 1.4 + (k.carril > 0 ? 0.25 : -0.25) * (1 - Math.sin(Math.PI * e));
    k.g.children[0].scale.setScalar(1 + 0.12 * Math.sin(now / 90));
    if (u >= 1) {
      scene.remove(k.g);
      k.g.traverse((o) => { o.material?.map?.dispose?.(); o.material?.dispose?.(); o.geometry?.dispose?.(); });
      paquetes.splice(i, 1);
      k.res();
    }
  }
}

// destellos al recibir
const destello = {app: 0, broker: 0, robot: 0};
function flash(n) { destello[n] = 1; }
function animarNodos(dt, now) {
  for (const n of Object.keys(destello)) destello[n] = Math.max(0, destello[n] - dt * 2.2);
  const s = (n) => 1 + 0.07 * destello[n];
  appG.scale.setScalar(s('app'));
  brG.scale.setScalar(s('broker') * 0.8);
  roG.scale.setScalar(s('robot') * 1.3);
  tapa.material.emissive.set(C.qos).multiplyScalar(destello.broker * 0.6);
  bolita.material.color.set(Math.sin(now / 300) > 0 ? C.pend : '#fff2cc');
  led.material.color.set(S.robotOn ? C.sale : '#4a4f57');
  tel.material.emissive.set(S.alerta ? C.rojo : '#000').multiplyScalar(S.alerta ? 0.35 + 0.2 * Math.sin(now / 160) : 0);
}

// ---------- Cámara ----------
const cam = {yaw: 0.0, pitch: 0.43, dist: 19.5, ty: 1.6};
function colocarCamara() {
  const asp = canvas.clientWidth / canvas.clientHeight;
  const d = cam.dist * (asp < 1.6 ? 1.6 / Math.max(asp, 0.9) * 0.82 : 1);
  camera.position.set(Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, cam.ty + Math.sin(cam.pitch) * d, Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
  camera.lookAt(0, cam.ty, 0);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const ancho = w > 900;
  const dx = ancho ? 140 : 0;
  const dy = ancho ? -30 : 0;
  camera.setViewOffset(w, h, -dx, dy, w, h);
}
let arr = null;
canvas.addEventListener('pointerdown', (e) => { arr = {x: e.clientX, y: e.clientY}; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!arr) return;
  cam.yaw = Math.max(-0.9, Math.min(0.9, cam.yaw - (e.clientX - arr.x) * 0.005));
  cam.pitch = Math.max(0.12, Math.min(1.2, cam.pitch + (e.clientY - arr.y) * 0.004));
  arr = {x: e.clientX, y: e.clientY};
});
canvas.addEventListener('pointerup', () => (arr = null));
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(9, Math.min(26, cam.dist + e.deltaY * 0.01)); e.preventDefault(); }, {passive: false});

function ajustar() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', ajustar);

// ---------- Acciones ----------
const nodoTxt = (n) => NOMBRE[n];
const PAQ_TXT = {PUBLISH: 'lleva el mensaje', PUBACK: 'confirma (QoS 1)', PUBREC: 'recibido (QoS 2, paso 2)', PUBREL: 'liberar (QoS 2, paso 3)', PUBCOMP: 'completado (QoS 2, paso 4)'};
const MS = 900;

// Corre un tramo: cada paquete viaja y deja su línea en la consola.
async function correTramo(t, topico, color, payload) {
  for (let i = 0; i < t.paquetes.length; i++) {
    const p = t.paquetes[i];
    const extra = i === 0 && payload ? ' ' + JSON.stringify(payload) : '';
    log(`${nodoTxt(p.de)} → ${nodoTxt(p.a)}  ${p.paquete} · ${PAQ_TXT[p.paquete]}${extra}`, color, 'QoS ' + t.qos);
    await viaja(p.de, p.a, p.paquete, topico, color, MS);
    flash(p.a);
  }
}

// Publica un mensaje completo (los dos tramos). Si el destino está caído, el broker lo guarda o lo pierde según el QoS.
async function enviar(clave, origen, destino, qos, payload) {
  const t = TOPICOS[clave];
  const pub = publicar(clave, origen, destino, qos);
  log(`${nodoTxt(origen)} publica en ${t.nombre}  (QoS ${qos})`, t.color, 'PUBLICA');
  await correTramo(pub.tramos[0], t.nombre, t.color, payload);
  const destinoCaido = destino === 'robot' && !S.robotOn;
  if (destinoCaido) {
    if (qos >= 1) {
      S.pendientes.push({clave, qos, payload});
      log(`El broker guarda el mensaje: la sesión del robot es persistente y el QoS es ${qos}. Se entrega cuando vuelva.`, C.pend, 'BROKER');
    } else {
      log('El broker lo descarta: con QoS 0 no se guarda nada para quien está desconectado.', C.rojo, 'BROKER');
    }
    return {entregado: false};
  }
  if (pub.qos2 !== qos) log(`El ${nodoTxt(destino).toLowerCase()} se suscribió con QoS ${SUSCRIPCION[destino]}: el broker baja la entrega a QoS ${pub.qos2}.`, C.qos, 'BROKER');
  log(`BROKER reenvía a quien escucha ${t.nombre}`, t.color, 'REPARTE');
  await correTramo(pub.tramos[1], t.nombre, t.color, null);
  return {entregado: true};
}

async function recibeRobot(p) { // lo que hace el robot al recibir un pedido: lo cuenta y lo confirma por /ack (QoS 1)
  S.recibidas++;
  actualizarContador();
  log(`ROBOT recibió el pedido ${p.id}: ${p.cantidad} × ${p.componente}, estante ${p.estante}`, C.llega, 'ROBOT');
  S.ultimo = `${p.id}: enviado\n(esperando confirmación)`;
  dibujarApp();
  const ack = confirmacion(p.id, S.recibidas, Math.round(performance.now()));
  await enviar('ack', 'robot', 'app', TOPICOS.ack.qos, ack);
  S.ultimo = `${p.id} confirmado\n${p.cantidad} × ${p.componente}`;
  dibujarApp();
  log(`APP muestra "${p.id} confirmado" al usuario`, C.sale, 'APP');
}

function bloquear(v) {
  S.ocupado = v;
  for (const id of ['b-orden', 'b-manip', 'b-lwt', 'b-reco']) document.getElementById(id).disabled = v;
  document.querySelectorAll('.qb').forEach((b) => (b.disabled = v));
}
async function accion(fn) {
  if (S.ocupado) return;
  bloquear(true);
  try { await fn(); } finally { bloquear(false); refrescarBotones(); }
}

const enviarOrden = () => accion(async () => {
  S.alerta = false;
  dibujarApp();
  S.n++;
  const p = pedido(S.n);
  S.ultimo = `${p.id}: enviando…`;
  dibujarApp();
  const r = await enviar('ordenes', 'app', 'robot', S.qos, p);
  if (r.entregado) await recibeRobot(p);
  else { S.ultimo = `${p.id}: sin respuesta\n(robot desconectado)`; dibujarApp(); }
});

const manipulacion = () => accion(async () => {
  if (!S.robotOn) { log('El robot está apagado: no puede mandar la alarma.', C.rojo, 'AVISO'); return; }
  S.alarmas++;
  log('ROBOT detecta que lo están moviendo o levantando (sensor de movimiento)', C.qos, 'ROBOT');
  const a = alarma(S.alarmas, Math.round(performance.now()));
  await enviar('alertas', 'robot', 'app', TOPICOS.alertas.qos, a);
  S.alerta = true;
  dibujarApp();
  log('APP muestra la pantalla roja: manipulación detectada. Llegó una sola vez (QoS 2).', C.rojo, 'APP');
});

const desconexion = () => accion(async () => {
  if (!S.robotOn) return;
  nota.userData.set('Última voluntad: "desconectado"', C.tinta, C.pend);
  nota.visible = true;
  log(`El robot dejó registrado al conectarse su última voluntad (LWT): "desconectado" en ${TOPICOS.conexion.nombre}, retenido, QoS 1.`, C.pend, 'LWT');
  await sleep(S.lento ? 1600 : 900);
  S.robotOn = false;
  ruta2.material.color.set('#e9b4ae');
  cruz.visible = true;
  roG.children[0].material = mat('#b9c0be');
  actualizarContador();
  log('ROBOT se apaga de golpe (batería, Wi-Fi o corte): no alcanza a despedirse.', C.rojo, 'ROBOT');
  // el broker espera 1,5 × keepalive; la barra lo muestra acelerado
  const box = document.getElementById('tiempo');
  const fill = document.getElementById('tfill');
  const det = document.getElementById('tdet');
  box.hidden = false;
  const acel = 5;
  const dur = (ESPERA_LWT_S / acel) * 1000 * (S.lento ? 2 : 1);
  const ini = performance.now();
  log(`BROKER: no oye al robot. Espera 1,5 × ${KEEPALIVE_S} s = ${ESPERA_LWT_S} s antes de darlo por caído.`, C.qos, 'BROKER');
  await new Promise((res) => {
    const tick = () => {
      const u = Math.min(1, (performance.now() - ini) / dur);
      fill.style.width = u * 100 + '%';
      det.textContent = `${(u * ESPERA_LWT_S).toFixed(1)} s de ${ESPERA_LWT_S} s (acelerado ×${acel})`;
      u < 1 ? requestAnimationFrame(tick) : res();
    };
    tick();
  });
  box.hidden = true;
  log('BROKER: tiempo cumplido. Publica la última voluntad del robot.', C.pend, 'BROKER');
  const q = qosEfectivo(TOPICOS.conexion.qos, SUSCRIPCION.app);
  await correTramo({qos: q, paquetes: tramo('broker', 'app', q)}, TOPICOS.conexion.nombre, C.pend, 'desconectado');
  S.appEstado = 'desconectado';
  dibujarApp();
  nota.visible = false;
  log('APP avisa: "Robot desconectado". (En la prueba T6 del P01 (Wokwi) el aviso llegó en 22 s.)', C.pend, 'APP');
});

const reconectar = () => accion(async () => {
  if (S.robotOn) return;
  log('ROBOT vuelve a encender y se conecta al Wi-Fi y al broker.', C.sale, 'ROBOT');
  S.robotOn = true;
  ruta2.material.color.set('#d3dedb');
  cruz.visible = false;
  roG.children[0].material = chasMat;
  actualizarContador();
  await enviar('conexion', 'robot', 'app', TOPICOS.conexion.qos, 'en línea');
  S.appEstado = 'en línea';
  dibujarApp();
  log('APP avisa: "Robot en línea".', C.sale, 'APP');
  while (S.pendientes.length) { // entrega lo que el broker guardó
    const m = S.pendientes.shift();
    log(`BROKER entrega al robot el pedido que guardó (${m.payload.id}).`, C.qos, 'BROKER');
    const pub = publicar('ordenes', 'app', 'robot', m.qos);
    const t = TOPICOS.ordenes;
    await correTramo(pub.tramos[1], t.nombre, t.color, null);
    await recibeRobot(m.payload);
  }
});

function refrescarBotones() {
  document.getElementById('b-reco').hidden = S.robotOn;
  document.getElementById('b-lwt').hidden = !S.robotOn;
  document.getElementById('b-manip').disabled = !S.robotOn;
}
const NOTAS = {
  0: 'QoS 0: se manda una vez y no se confirma. Rápido, pero si se pierde, se perdió.',
  1: 'QoS 1: el que recibe confirma (PUBACK). Llega al menos una vez. Es el que usa el pedido en el robot real.',
  2: 'QoS 2: 4 pasos para que llegue exactamente una vez. El robot real lo usa para las alarmas.',
};
function elegirQos(q) {
  S.qos = q;
  document.querySelectorAll('.qb').forEach((b) => b.classList.toggle('on', Number(b.dataset.q) === q));
  document.getElementById('qosnota').textContent = NOTAS[q];
}
document.querySelectorAll('.qb').forEach((b) => (b.onclick = () => !S.ocupado && elegirQos(Number(b.dataset.q))));
document.getElementById('b-orden').onclick = enviarOrden;
document.getElementById('b-manip').onclick = manipulacion;
document.getElementById('b-lwt').onclick = desconexion;
document.getElementById('b-reco').onclick = reconectar;
document.getElementById('lento').onchange = (e) => (S.lento = e.target.checked);
addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key;
  if (k === '0' || k === '1' || k === '2') !S.ocupado && elegirQos(Number(k));
  else if (k === ' ' || k === 'Enter') { enviarOrden(); e.preventDefault(); }
  else if (k === 'm') manipulacion();
  else if (k === 'l') S.robotOn ? desconexion() : reconectar();
});

// para pruebas y capturas
window.__sim = {paquetes, scene, renderer, S, elegirQos, enviarOrden, manipulacion, desconexion, reconectar, cam};

// ---------- Arranque ----------
dibujarApp();
actualizarContador();
elegirQos(1);
refrescarBotones();
log('Listo. App, Broker y Robot conectados. Elige un QoS y pulsa "Enviar orden".', C.sale, 'INICIO');
log(`El robot está suscrito a ${TOPICOS.ordenes.nombre} (QoS 1). La app, a todo ${BASE}# (QoS 2).`, C.tinta, 'INFO');
ajustar();
let ant = performance.now();
let cuadros = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(LIVIANO ? 0.2 : 0.05, (now - ant) / 1000);
  ant = now;
  reloj += dt * 1000;
  mueveTodo(now);
  animarNodos(dt, now);
  if (!arr && !S.ocupado) cam.yaw += (Math.sin(now / 5000) * 0.18 - cam.yaw) * 0.01;
  colocarCamara();
  try {
    renderer.render(scene, camera);
    if (++cuadros === 2) aviso.listo();
  } catch (e) {
    console.error(e);
    renderer.setAnimationLoop(null);
    aviso.error('La simulación se detuvo', 'Hubo un error al dibujar: ' + String(e.message || e).slice(0, 120));
  }
});
