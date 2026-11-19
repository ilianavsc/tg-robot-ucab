// El mundo 3D del Simulador 1: renderer, luces, el piso de granito con la cinta (lienzo de granito.js) y la cámara.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {crearTeja} from './granito.js';

const FONDO = '#e8eeec';

export function crearMundo(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FONDO);
  scene.fog = new THREE.Fog(FONDO, 8, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.screenSpacePanning = false;

  scene.add(new THREE.HemisphereLight('#ffffff', '#b9c3bf', 0.7));
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

  // granito fuera de la zona de la pista: un cuadro de 0,5 m repetido, sin cinta
  const tejaTex = new THREE.CanvasTexture(crearTeja());
  tejaTex.wrapS = tejaTex.wrapT = THREE.RepeatWrapping;
  tejaTex.repeat.set(28, 28);
  tejaTex.colorSpace = THREE.SRGBColorSpace;
  tejaTex.anisotropy = 4;
  const fuera = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({map: tejaTex, roughness: 0.9, envMapIntensity: 0.2}));
  fuera.rotation.x = -Math.PI / 2;
  fuera.position.y = -0.0008;
  fuera.receiveShadow = true;
  scene.add(fuera);

  // la zona con la cinta: el lienzo de granito.js
  let piso = null;
  let tex = null;
  const ponerPiso = (canvas2d, zona) => {
    if (piso) {
      scene.remove(piso);
      piso.geometry.dispose();
      piso.material.dispose();
      tex.dispose();
    }
    tex = new THREE.CanvasTexture(canvas2d);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    piso = new THREE.Mesh(new THREE.PlaneGeometry(zona.ancho, zona.alto), new THREE.MeshStandardMaterial({map: tex, roughness: 0.9, envMapIntensity: 0.2}));
    piso.rotation.x = -Math.PI / 2;
    piso.position.set(zona.x0 + zona.ancho / 2, 0, zona.z0 + zona.alto / 2);
    piso.receiveShadow = true;
    scene.add(piso);
  };
  const repintado = () => {
    if (tex) tex.needsUpdate = true;
  };

  const pose = new THREE.Group();
  scene.add(pose);

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  return {renderer, scene, camera, controls, sol, pose, resize, ponerPiso, repintado};
}
