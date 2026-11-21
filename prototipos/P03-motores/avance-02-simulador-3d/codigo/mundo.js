// El mundo 3D: renderer, luces, piso de granito, la cinta negra de la ruta, los bidones y la cámara.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CINTA} from './ruta.js';

const FONDO = '#dfe8e5';

// textura de granito: ruido fino en gris claro
function texturaGranito() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#b4bdb9';
  g.fillRect(0, 0, 512, 512);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 9000; i++) {
    const v = 110 + Math.floor(rnd() * 110);
    g.fillStyle = `rgba(${v},${v + 3},${v + 2},${0.25 + rnd() * 0.4})`;
    const r = 0.6 + rnd() * 1.6;
    g.fillRect(rnd() * 512, rnd() * 512, r, r);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 7);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function crearMundo(canvas, ruta, obstaculos) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FONDO);
  scene.fog = new THREE.Fog(FONDO, 7, 16);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 40);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 0.25;
  controls.maxDistance = 6;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.screenSpacePanning = false;

  // luces
  scene.add(new THREE.HemisphereLight('#ffffff', '#a9b5b0', 0.7));
  const sol = new THREE.DirectionalLight('#fff6e8', 2.2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  const sc = sol.shadow.camera;
  sc.left = -0.7;
  sc.right = 0.7;
  sc.top = 0.7;
  sc.bottom = -0.7;
  sc.near = 0.5;
  sc.far = 6;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.002;
  scene.add(sol, sol.target);

  // piso
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(9, 6.5), new THREE.MeshStandardMaterial({map: texturaGranito(), roughness: 0.55, metalness: 0, envMapIntensity: 0.5}));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  scene.add(piso);

  // la cinta negra de 19 mm: una tira siguiendo la ruta
  const pts = ruta.puntos;
  const n = pts.length;
  const pos = new Float32Array(n * 2 * 3);
  const idx = [];
  const hw = CINTA / 2;
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    let tx = b[0] - a[0];
    let tz = b[1] - a[1];
    const m = Math.hypot(tx, tz);
    tx /= m;
    tz /= m;
    const [px, pz] = pts[i];
    pos.set([px - tz * hw, 0.0007, pz + tx * hw, px + tz * hw, 0.0007, pz - tx * hw], i * 6);
    const j = (i + 1) % n;
    idx.push(i * 2, i * 2 + 1, j * 2, i * 2 + 1, j * 2 + 1, j * 2);
  }
  const gTira = new THREE.BufferGeometry();
  gTira.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  gTira.setIndex(idx);
  gTira.computeVertexNormals();
  const tira = new THREE.Mesh(gTira, new THREE.MeshStandardMaterial({color: '#0b0c0e', roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1}));
  tira.receiveShadow = true;
  scene.add(tira);

  // bidones junto a la ruta
  const naranja = new THREE.MeshStandardMaterial({color: '#e8743b', roughness: 0.5, envMapIntensity: 0.6});
  const blanco = new THREE.MeshStandardMaterial({color: '#f4f6f5', roughness: 0.5});
  for (const o of obstaculos) {
    const g = new THREE.Group();
    const h = 0.12;
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, h, 32), naranja);
    cuerpo.position.y = h / 2;
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(o.r + 0.0008, o.r + 0.0008, 0.025, 32), blanco);
    banda.position.y = h * 0.62;
    g.add(cuerpo, banda);
    g.position.set(o.x, 0, o.z);
    g.traverse((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
    });
    scene.add(g);
  }

  const pose = new THREE.Group(); // el robot se coloca aquí: x, z y rumbo
  scene.add(pose);

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  return {renderer, scene, camera, controls, sol, pose, resize};
}
