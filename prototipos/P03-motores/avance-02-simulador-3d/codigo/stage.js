// El estudio: fondo papel del sitio del TG, piso de laboratorio con baldosas y la cinta negra que el robot sigue.
// El robot queda en el origen y el piso se mueve debajo según su posición y rumbo (uPose).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildRobot} from './robot.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#EEF3F1', piso: '#e6eeeb', junta: '#c9d7d2', cinta: '#14213D', sombra: '#14213D'};

const PISO_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PISO_FRAG = /* glsl */ `uniform vec3 uP; uniform vec3 uJ; uniform vec3 uC; uniform vec3 uBg; uniform vec3 uPose; uniform vec3 uCam; varying vec3 vW;
  void main(){
    float c = cos(uPose.z), s = sin(uPose.z);
    vec2 q = vW.xz;
    vec2 w = vec2(q.x * c + q.y * s, -q.x * s + q.y * c) + uPose.xy;
    // baldosas de 30 cm
    vec2 g = abs(fract(w / 0.3 + 0.5) - 0.5) * 0.3;
    float junta = 1.0 - smoothstep(0.0008, 0.0022, min(g.x, g.y));
    // la cinta: un óvalo de 1,6 m x 1,0 m, 19 mm de ancho
    vec2 e = w / vec2(0.8, 0.5);
    float r = length(e);
    float d = abs(r - 1.0) * min(0.8, 0.5) ;
    float cinta = 1.0 - smoothstep(0.0085, 0.0105, d);
    float n = fract(sin(dot(floor(w * 300.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uP, uJ, junta * 0.8) * (0.988 + 0.02 * n);
    col = mix(col, uC, cinta * 0.92);
    float far = length(vW.xz - uCam.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(0.35, 1.1, far)), 1.0);
  }`;

export function createStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  const camera = new THREE.PerspectiveCamera(26, 16 / 9, 0.005, 10);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.75;
  gtao.updateGtaoMaterial({radius: 0.008, distanceExponent: 1.4, thickness: 0.06, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const pisoVis = (v) => () => {
    piso.visible = v;
    sombra.visible = v;
  };
  composer.addPass(new Toggle(pisoVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(pisoVis(true)));
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e3ebe8');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.99, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 2.4);
    box(3, 14, new V3(-12, 4, 6), 3.0);
    box(3, 14, new V3(12, 4, -4), 2.0);
    box(18, 2, new V3(0, 2, 14), 1.5);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c9d7d2', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.35, 0.85, 0.4).normalize();
  const sun = new THREE.DirectionalLight('#fffaf2', 2.2);
  sun.castShadow = true;
  const EXT = 0.16;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.05, far: 2});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 8;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.0003;
  sun.position.copy(SUN_DIR).multiplyScalar(0.8);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfdcd7', 0.7));

  const pisoMat = new THREE.ShaderMaterial({
    vertexShader: PISO_VERT,
    fragmentShader: PISO_FRAG,
    uniforms: {
      uP: {value: new THREE.Color(COL.piso)},
      uJ: {value: new THREE.Color(COL.junta)},
      uC: {value: new THREE.Color(COL.cinta)},
      uBg: {value: new THREE.Color(COL.bg)},
      uPose: {value: new V3()},
      uCam: {value: new V3()},
    },
    toneMapped: false,
  });
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), pisoMat);
  piso.rotation.x = -Math.PI / 2;
  scene.add(piso);
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.ShadowMaterial({color: COL.sombra, opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.receiveShadow = true;
  scene.add(sombra);

  const robot = buildRobot();
  scene.add(robot.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // st: estado para robot.update + pose {x, z, th}; cam: {tx, ty, tz, az, el, d} en radianes y metros
  const frame = (st, cam) => {
    robot.update(st);
    pisoMat.uniforms.uPose.value.set(st.pose.x, st.pose.z, st.pose.th);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    pisoMat.uniforms.uCam.value.set(cam.tx, 0, cam.tz);
    composer.render();
  };
  const pv = new V3();
  const project = (p) => {
    pv.copy(p).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow}) => {
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, composer, robot, resize, frame, project, size, setQuality};
}
