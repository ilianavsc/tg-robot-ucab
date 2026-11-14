// Los 4 módulos TCRT5000 (placa azul) en una regleta al frente del robot, mirando al piso.
// Mismos ejes que robot.js: x a la izquierda, y arriba, z adelante. El eje de las ruedas está en z = 0,03.
// La separación y la distancia al eje se mueven desde la consola; el soporte es solo una idea (falta diseñarlo).
import * as THREE from 'three';
import {PLACA_Y, ZA} from './robot.js';

const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, envMapIntensity: 0.6, ...extra});

export function buildSensores() {
  const group = new THREE.Group();
  const anchor = new THREE.Vector3();
  const Y = 0.0105; // altura de la placa azul; el TCRT5000 queda a unos 3 mm del piso
  const modulos = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Group();
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.0016, 0.03), std('#1f5fbf', 0.5));
    pcb.position.set(0, Y, -0.011);
    m.add(pcb);
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.0062, 0.0045, 0.0102), std('#141518', 0.55));
    cuerpo.position.set(0, Y - 0.003, 0);
    m.add(cuerpo);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 16, 10), std('#9fb8d6', 0.15, 0, {transparent: true, opacity: 0.85, emissive: '#6B4EE6', emissiveIntensity: 0.4}));
    led.position.set(0, Y - 0.0055, 0.0025);
    led.scale.y = 0.6;
    m.add(led);
    const foto = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 16, 10), std('#0d0e10', 0.2));
    foto.position.set(0, Y - 0.0055, -0.0025);
    foto.scale.y = 0.6;
    m.add(foto);
    const pines = new THREE.Mesh(new THREE.BoxGeometry(0.0085, 0.0025, 0.0025), std('#0f1114', 0.7));
    pines.position.set(0, Y + 0.002, -0.024);
    m.add(pines);
    const ledPlaca = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.001, 0.0012), new THREE.MeshStandardMaterial({color: '#0F9D84', emissive: '#0F9D84', emissiveIntensity: 0}));
    ledPlaca.position.set(0.0028, Y + 0.0013, -0.016);
    m.add(ledPlaca);
    // lo que ve: un punto en el piso (el infrarrojo no se ve; aquí se pinta para entender)
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 32), new THREE.MeshBasicMaterial({color: '#0F9D84', transparent: true, opacity: 0.5, depthWrite: false}));
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = 0.0007;
    m.add(spot);
    group.add(m);
    modulos.push({m, spot, ledPlaca});
  }
  // regleta y soporte hasta el chasis
  const sopMat = std('#2b2f36', 0.5, 0.2);
  const regleta = new THREE.Mesh(new THREE.BoxGeometry(1, 0.003, 0.012), sopMat);
  group.add(regleta);
  const postes = [];
  const brazos = [0.02, -0.02].map((x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.003, 1), sopMat);
    b.position.x = x;
    group.add(b);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.006, PLACA_Y - Y, 0.006), sopMat);
    p.position.set(x, (PLACA_Y + Y) / 2 + 0.0015, 0.078);
    group.add(p);
    postes.push(p);
    return b;
  });
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.geometry.type !== 'CircleGeometry';
      o.receiveShadow = true;
    }
  });

  // s: {sep, ad, n: [0..1 x4]}
  const update = (s) => {
    if (!s) return;
    const zS = ZA + s.ad;
    const xs = [1.5, 0.5, -0.5, -1.5].map((k) => k * s.sep);
    modulos.forEach((o, i) => {
      o.m.position.set(xs[i], 0, zS);
      const v = s.n[i];
      o.spot.material.opacity = 0.25 + 0.6 * v;
      o.spot.material.color.set(v > 0 ? '#0F9D84' : '#F2603D');
      o.ledPlaca.material.emissiveIntensity = v > 0 ? 1.4 : 0;
    });
    const ancho = 3 * s.sep + 0.016;
    regleta.scale.x = ancho;
    regleta.position.set(0, Y + 0.0035, zS - 0.012);
    const z1 = zS - 0.012;
    const z0 = Math.min(0.078, z1);
    for (const p of postes) p.position.z = z0;
    for (const b of brazos) {
      b.visible = z1 > z0 + 0.003;
      b.scale.z = Math.max(0.001, z1 - z0);
      b.position.set(b.position.x, Y + 0.0035, (z0 + z1) / 2);
    }
    anchor.set(xs[0], Y, zS);
  };
  return {group, update, anchor};
}
