// El estudio: fondo papel del sitio del TG, el piso de granito con la cinta negra (pista provisional) y los 4 sensores.
// El robot queda en el origen y el piso se mueve debajo según su posición y rumbo (uPose).
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {buildRobot} from './robot.js';
import {buildSensores} from './sensores3d.js';
import {ZONA} from './pista.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#EEF3F1', sombra: '#14213D'};

const PISO_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const PISO_FRAG = /* glsl */ `uniform sampler2D uTex; uniform sampler2D uTeja; uniform vec4 uZona; uniform vec3 uBg; uniform vec3 uPose; uniform vec3 uCam; uniform vec2 uFade; varying vec3 vW;
  void main(){
    float c = cos(uPose.z), s = sin(uPose.z);
    vec2 q = vW.xz;
    vec2 w = vec2(q.x * c + q.y * s, -q.x * s + q.y * c) + uPose.xy;
    vec2 uv = (w - uZona.xy) / uZona.zw;
    vec3 col;
    if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) {
      col = texture2D(uTex, uv).rgb;
    } else {
      // fuera de la zona: el mismo granito repetido, sin cinta
      col = texture2D(uTeja, w / 0.5).rgb;
    }
    float far = length(vW.xz - uCam.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(uFade.x, uFade.y, far)), 1.0);
  }`;

export function createStage({canvas, pisoCanvas, tejaCanvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
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
  let sombrasOn = true;
  let directo = false; // true: dibuja sin efectos (sin composer), para equipos que no pueden con ellos
  const pisoVis = (v) => () => {
    piso.visible = v;
    sombra.visible = v && sombrasOn;
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
  const EXT = 0.2;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.05, far: 2});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 8;
  sun.shadow.blurSamples = 8;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.0003;
  sun.position.copy(SUN_DIR).multiplyScalar(0.8);
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfdcd7', 0.7));

  const tex = new THREE.CanvasTexture(pisoCanvas);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const teja = new THREE.CanvasTexture(tejaCanvas);
  teja.colorSpace = THREE.SRGBColorSpace;
  teja.wrapS = teja.wrapT = THREE.RepeatWrapping;
  teja.anisotropy = tex.anisotropy;
  teja.minFilter = THREE.LinearMipmapLinearFilter;
  const pisoMat = new THREE.ShaderMaterial({
    vertexShader: PISO_VERT,
    fragmentShader: PISO_FRAG,
    uniforms: {
      uTex: {value: tex},
      uTeja: {value: teja},
      uZona: {value: new THREE.Vector4(ZONA.x0, ZONA.z0, ZONA.ancho, ZONA.alto)},
      uBg: {value: new THREE.Color(COL.bg)},
      uPose: {value: new V3()},
      uCam: {value: new V3()},
      uFade: {value: new THREE.Vector2(0.35, 1.1)},
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
  const sensores = buildSensores();
  robot.root.add(sensores.group);

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
    sensores.update(st.sens);
    pisoMat.uniforms.uFade.value.set(cam.fade?.[0] ?? 0.35, cam.fade?.[1] ?? 1.1);
    pisoMat.uniforms.uPose.value.set(st.pose.x, st.pose.z, st.pose.th);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    pisoMat.uniforms.uCam.value.set(cam.tx, 0, cam.tz);
    if (directo) {
      piso.visible = true;
      sombra.visible = sombrasOn;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } else composer.render();
  };
  // Los efectos necesitan WebGL 2 y poder dibujar en texturas de media precisión. Si no, se dibuja directo.
  const soportaComposer = renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  const setDirecto = (v) => {
    directo = v;
  };
  // true si el lienzo quedó sin dibujar (transparente) después de un cuadro: la señal de que los efectos fallaron
  const lienzoVacio = () => {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    renderer.setRenderTarget(null);
    gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return px[3] === 0;
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
      sombrasOn = shadow > 0;
      sun.castShadow = sombrasOn;
      renderer.shadowMap.enabled = sombrasOn;
      sombra.visible = sombrasOn;
      scene.traverse((o) => o.material && [].concat(o.material).forEach((m) => (m.needsUpdate = true)));
      sun.shadow.mapSize.set(shadow || 256, shadow || 256);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, composer, robot, sensores, resize, frame, project, size, setQuality, setDirecto, soportaComposer, lienzoVacio};
}
