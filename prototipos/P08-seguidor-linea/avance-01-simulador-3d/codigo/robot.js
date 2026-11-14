// La geometría del robot, construida en código y en metros reales.
// Eje x: a lo ancho (+x es la izquierda del robot), y: arriba, z: hacia adelante.
// update(s) posa todo: giro de ruedas e inducidos, rayos X, despiece, cables y el flujo por los cables.
import * as THREE from 'three';

const V3 = THREE.Vector3;
export const RW = 0.0325; // radio de rueda
export const ZA = 0.03; // eje de las ruedas, adelante del centro
export const PLACA_Y = 0.05;

const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, envMapIntensity: 0.6, ...extra});
const cyl = (r, len, seg = 40, r2 = r) => {
  const g = new THREE.CylinderGeometry(r2, r, len, seg);
  g.rotateZ(-Math.PI / 2); // a lo largo de +x
  return g;
};

// engrane recto extruido a lo largo de x
function gearGeo(z, r, thick) {
  const s = new THREE.Shape();
  const rr = r * 0.86;
  for (let i = 0; i < z; i++) {
    const a0 = (i / z) * Math.PI * 2;
    const da = (Math.PI * 2) / z;
    const pts = [
      [rr, a0],
      [r, a0 + da * 0.2],
      [r, a0 + da * 0.45],
      [rr, a0 + da * 0.65],
    ];
    pts.forEach(([rad, a], k) => {
      const x = rad * Math.cos(a);
      const y = rad * Math.sin(a);
      if (i === 0 && k === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.18, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false, curveSegments: 4});
  g.rotateY(Math.PI / 2); // la cara del engrane mira a x
  return g;
}

export function buildRobot() {
  const root = new THREE.Group();
  const anchors = {}; // puntos para las etiquetas
  const xrayMats = [];
  const fadeX = (m, base = 1) => {
    m.transparent = true;
    m.userData.base = base;
    xrayMats.push(m);
    return m;
  };

  // ------------------------------------------------------------ chasis
  const chasis = new THREE.Group();
  root.add(chasis);
  const placaMat = std('#d9ebe6', 0.25, 0, {transparent: true, opacity: 0.55, depthWrite: false});
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.17), placaMat);
  placa.position.set(0, PLACA_Y + 0.002, 0);
  placa.renderOrder = 2;
  chasis.add(placa);
  const borde = new THREE.LineSegments(new THREE.EdgesGeometry(placa.geometry), new THREE.LineBasicMaterial({color: '#8fb3aa'}));
  borde.position.copy(placa.position);
  chasis.add(borde);
  // rueda loca
  const loca = new THREE.Group();
  loca.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.036, 32), std('#2b2f36', 0.5, 0.3)));
  loca.children[0].position.y = 0.032;
  const bola = new THREE.Mesh(new THREE.SphereGeometry(0.008, 32, 16), std('#c9ced3', 0.3, 0.9));
  bola.position.y = 0.008;
  loca.add(bola);
  loca.position.set(0, 0, -0.065);
  chasis.add(loca);
  anchors.loca = new V3(0, 0.02, -0.065);

  // ------------------------------------------------------------ motores (izq: +x, der: -x)
  const motores = {};
  for (const lado of ['izq', 'der']) {
    const s = lado === 'izq' ? 1 : -1;
    const g = new THREE.Group();
    g.position.set(0, RW, ZA);
    g.scale.x = s; // el derecho es el espejo del izquierdo
    root.add(g);
    const parts = {};
    // rueda
    const rueda = new THREE.Group();
    const llanta = new THREE.Mesh(cyl(RW, 0.026, 64), std('#1d2025', 0.85));
    rueda.add(llanta);
    const rin = new THREE.Mesh(cyl(0.023, 0.021, 48), std('#f4f6f5', 0.5));
    rueda.add(rin);
    for (let i = 0; i < 6; i++) {
      // radios del rin, para que se vea el giro
      const rr = new THREE.Mesh(new THREE.BoxGeometry(0.0235, 0.044, 0.0035), std('#c3cfcb', 0.6));
      rr.rotation.x = (i / 6) * Math.PI;
      rueda.add(rr);
    }
    const marca = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.007), std('#F2603D', 0.5));
    marca.position.y = 0.017;
    rueda.add(marca);
    // dibujo de la llanta
    for (let i = 0; i < 24; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.0016, 0.004), std('#30353c', 0.9));
      const a = (i / 24) * Math.PI * 2;
      t.position.set(0, Math.cos(a) * (RW + 0.0004), Math.sin(a) * (RW + 0.0004));
      t.rotation.x = -a;
      rueda.add(t);
    }
    rueda.position.x = 0.09;
    g.add(rueda);
    parts.rueda = rueda;
    // eje de salida (D de 4 mm)
    const eje = new THREE.Mesh(cyl(0.002, 0.014, 16), std('#cfd4d8', 0.35, 0.9));
    eje.position.x = 0.083;
    g.add(eje);
    // caja reductora
    const caja = new THREE.Group();
    const cajaMat = fadeX(std('#c3c9ce', 0.45, 0.8));
    const cajaC = new THREE.Mesh(cyl(0.0125, 0.021, 48), cajaMat);
    caja.add(cajaC);
    const tapa = new THREE.Mesh(cyl(0.0128, 0.0025, 48), fadeX(std('#9aa2a9', 0.45, 0.8)));
    tapa.position.x = 0.0105;
    caja.add(tapa);
    // los engranes adentro (se ven con rayos X)
    const engranes = new THREE.Group();
    const gm = std('#d6a84a', 0.4, 0.85);
    const etapas = [
      [0.0035, 0.0105],
      [0.0035, 0.0105],
      [0.0035, 0.0105],
    ];
    const ruedasE = [];
    etapas.forEach(([rp, rg], i) => {
      const x = -0.0085 + i * 0.0062;
      const piñon = new THREE.Mesh(gearGeo(9, rp, 0.0022), gm);
      piñon.position.x = x;
      engranes.add(piñon);
      const grande = new THREE.Mesh(gearGeo(30, rg, 0.0018), gm);
      grande.position.set(x + 0.0024, 0, 0);
      grande.position.y = (i % 2 ? -1 : 1) * 0;
      engranes.add(grande);
      ruedasE.push(piñon, grande);
    });
    caja.add(engranes);
    caja.position.x = 0.0665;
    g.add(caja);
    parts.caja = caja;
    parts.engranes = ruedasE;
    parts.engranesG = engranes;
    // soporte en U hacia la placa
    const soporte = new THREE.Group();
    const sm = std('#5b6573', 0.5, 0.6);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.0025, 0.03), sm);
    top.position.y = 0.0138;
    soporte.add(top);
    for (const zz of [-0.0138, 0.0138]) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.0025), sm);
      tab.position.set(0, 0.006, zz);
      soporte.add(tab);
    }
    const pie = new THREE.Mesh(new THREE.BoxGeometry(0.016, PLACA_Y - RW - 0.0138, 0.008), sm);
    pie.position.y = 0.0138 + (PLACA_Y - RW - 0.0138) / 2;
    soporte.add(pie);
    soporte.position.x = 0.065;
    g.add(soporte);
    parts.soporte = soporte;
    // carcasa del motor 370
    const lata = new THREE.Group();
    const lataMat = fadeX(std('#aeb5bb', 0.42, 0.85));
    const lataC = new THREE.Mesh(cyl(0.0122, 0.031, 48), lataMat);
    lata.add(lataC);
    const tapaT = new THREE.Mesh(cyl(0.0105, 0.0018, 40), fadeX(std('#20242a', 0.6)));
    tapaT.position.x = -0.0164;
    lata.add(tapaT);
    // adentro: imanes, inducido con bobinas y colector
    const adentro = new THREE.Group();
    const iman = std('#5d6670', 0.6, 0.3);
    for (const a of [0, Math.PI]) {
      const im = new THREE.Mesh(new THREE.CylinderGeometry(0.0112, 0.0112, 0.022, 24, 1, true, a - 0.9, 1.8), iman);
      im.geometry.rotateZ(-Math.PI / 2);
      adentro.add(im);
    }
    const inducido = new THREE.Group();
    const nucleo = new THREE.Mesh(cyl(0.0075, 0.02, 24), std('#7c858e', 0.5, 0.7));
    inducido.add(nucleo);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.0042, 0.0034), std('#c56a2c', 0.35, 0.8));
      const a = (i / 5) * Math.PI * 2;
      b.position.set(0, Math.cos(a) * 0.0068, Math.sin(a) * 0.0068);
      b.rotation.x = -a;
      inducido.add(b);
    }
    const colector = new THREE.Mesh(cyl(0.003, 0.004, 16), std('#d08a3a', 0.3, 0.9));
    colector.position.x = -0.0125;
    inducido.add(colector);
    const ejeM = new THREE.Mesh(cyl(0.001, 0.05, 12), std('#cfd4d8', 0.35, 0.9));
    ejeM.position.x = -0.006;
    inducido.add(ejeM);
    adentro.add(inducido);
    lata.add(adentro);
    lata.position.x = 0.0405;
    g.add(lata);
    parts.lata = lata;
    parts.inducido = inducido;
    // encoder: imán de 22 polos y placa con dos sensores Hall
    const enc = new THREE.Group();
    const disco = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.0018, 4, 1, false, (i / 22) * Math.PI * 2, (Math.PI * 2) / 22), std(i % 2 ? '#14213D' : '#e8eeec', 0.5));
      seg.geometry.rotateZ(-Math.PI / 2);
      disco.add(seg);
    }
    disco.position.x = -0.002;
    enc.add(disco);
    const pcb = new THREE.Mesh(cyl(0.0125, 0.0016, 40), std('#1f7a4d', 0.55));
    pcb.position.x = 0.0025;
    enc.add(pcb);
    const hallMat = std('#14213D', 0.4);
    const halls = [];
    for (const a of [0.35, 0.35 + Math.PI / 2 / 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.0028, 0.0028), hallMat.clone());
      h.position.set(0.0012, Math.cos(a) * 0.0068, Math.sin(a) * 0.0068);
      enc.add(h);
      halls.push(h);
    }
    const conector = new THREE.Mesh(new THREE.BoxGeometry(0.0045, 0.004, 0.012), std('#f4f6f5', 0.5));
    conector.position.set(0.001, 0.012, 0);
    enc.add(conector);
    enc.position.x = 0.0205;
    g.add(enc);
    parts.enc = enc;
    parts.disco = disco;
    parts.halls = halls;
    motores[lado] = {g, parts, s};
    anchors[`rueda_${lado}`] = new V3(s * 0.103, RW, ZA);
    anchors[`caja_${lado}`] = new V3(s * 0.0665, RW - 0.0125, ZA);
    anchors[`lata_${lado}`] = new V3(s * 0.04, RW - 0.012, ZA);
    anchors[`enc_${lado}`] = new V3(s * 0.0205, RW, ZA - 0.0125);
  }

  // ------------------------------------------------------------ arriba: placas y batería
  const arriba = new THREE.Group();
  root.add(arriba);
  const pcbY = PLACA_Y + 0.004 + 0.008;
  const separador = (x, z, g) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.008, 10), std('#c8a64a', 0.4, 0.8));
    p.position.set(x, PLACA_Y + 0.008, z);
    g.add(p);
  };
  // ESP32 DevKit (51 x 28 mm)
  const esp = new THREE.Group();
  esp.add(new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.0016, 0.051), std('#1a1d22', 0.55)));
  const modulo = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0031, 0.0175), std('#cdd3d8', 0.35, 0.9));
  modulo.position.set(0, 0.0024, 0.012);
  esp.add(modulo);
  const antena = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.0012, 0.006), std('#232830', 0.6));
  antena.position.set(0, 0.0014, 0.0235);
  esp.add(antena);
  const usb = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.003, 0.006), std('#d9dde0', 0.3, 0.9));
  usb.position.set(0, 0.0023, -0.0235);
  esp.add(usb);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.001, 0.0012), new THREE.MeshStandardMaterial({color: '#6B4EE6', emissive: '#6B4EE6', emissiveIntensity: 0.8}));
  led.position.set(0.006, 0.0013, -0.012);
  esp.add(led);
  for (const xx of [-0.0127, 0.0127]) {
    const hdr = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.0025, 0.048), std('#0f1114', 0.7));
    hdr.position.set(xx, -0.002, 0);
    esp.add(hdr);
  }
  esp.position.set(0.035, pcbY, 0.045);
  for (const [dx, dz] of [[-0.011, -0.022], [0.011, -0.022], [-0.011, 0.022], [0.011, 0.022]]) separador(0.035 + dx, 0.045 + dz, arriba);
  arriba.add(esp);
  anchors.esp = new V3(0.035, pcbY + 0.004, 0.045);

  // L298N (43 x 43 mm)
  const l298 = new THREE.Group();
  l298.add(new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.0016, 0.043), std('#b8322a', 0.55)));
  const disip = new THREE.Group();
  const dm = std('#1b1e23', 0.5, 0.5);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.004, 0.016), dm);
  base.position.y = 0.002;
  disip.add(base);
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.021, 0.016), dm);
    f.position.set(-0.0105 + i * 0.0042, 0.0145, 0);
    disip.add(f);
  }
  disip.position.set(0, 0.0008, -0.008);
  l298.add(disip);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0035, 0.004), std('#14161a', 0.5));
  chip.position.set(0, 0.006, 0.0015);
  l298.add(chip);
  const bornera = (w, color) => new THREE.Mesh(new THREE.BoxGeometry(w, 0.009, 0.0075), std(color, 0.5));
  const bA = bornera(0.0075, '#2f6fd0');
  bA.scale.set(1, 1, 1.6);
  bA.position.set(0.0175, 0.0053, -0.004);
  l298.add(bA);
  const bB = bA.clone();
  bB.position.x = -0.0175;
  l298.add(bB);
  const bP = bornera(0.015, '#2f6fd0');
  bP.position.set(-0.012, 0.0053, 0.0175);
  l298.add(bP);
  const pines = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.0025, 0.0025), std('#0f1114', 0.7));
  pines.position.set(0.01, 0.0021, 0.0185);
  l298.add(pines);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.0006, 0.006, 0.0006), std('#e0c35a', 0.3, 0.9));
    p.position.set(0.0037 + i * 0.00254, 0.005, 0.0185);
    l298.add(p);
  }
  const ledL = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.001, 0.0012), new THREE.MeshStandardMaterial({color: '#F2603D', emissive: '#F2603D', emissiveIntensity: 0.3}));
  ledL.position.set(0.003, 0.0013, 0.012);
  l298.add(ledL);
  l298.position.set(-0.035, pcbY, 0.045);
  for (const [dx, dz] of [[-0.019, -0.019], [0.019, -0.019], [-0.019, 0.019], [0.019, 0.019]]) separador(-0.035 + dx, 0.045 + dz, arriba);
  arriba.add(l298);
  anchors.l298 = new V3(-0.035, pcbY + 0.02, 0.037);

  // batería 3S: tres 18650 en su porta pilas
  const bat = new THREE.Group();
  const porta = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.062), std('#202328', 0.7));
  porta.position.y = 0.006;
  bat.add(porta);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(cyl(0.0093, 0.065, 40), std(['#2a7fb8', '#2a7fb8', '#2a7fb8'][i], 0.4, 0.2));
    c.position.set(0, 0.0105, -0.019 + i * 0.019);
    bat.add(c);
    const polo = new THREE.Mesh(cyl(0.0035, 0.0016, 20), std('#d7dbde', 0.3, 0.9));
    polo.position.set(0.0333, 0.0105, -0.019 + i * 0.019);
    bat.add(polo);
  }
  const bms = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.0016, 0.015), std('#2c6b3f', 0.55));
  bms.position.set(0, 0.0215, -0.04 + 0.04);
  bms.position.z = 0;
  bms.position.y = 0.021;
  bat.add(bms);
  bat.position.set(0, PLACA_Y + 0.004, -0.032);
  arriba.add(bat);
  anchors.bat = new V3(0, PLACA_Y + 0.025, -0.032);

  // LM2596 (43 x 21 mm)
  const lm = new THREE.Group();
  lm.add(new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.0016, 0.021), std('#1f4fa0', 0.55)));
  const bob = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.007, 0.012), std('#25282d', 0.6));
  bob.position.set(-0.004, 0.0043, 0);
  lm.add(bob);
  const pot = new THREE.Mesh(new THREE.BoxGeometry(0.0095, 0.0095, 0.0045), std('#2f6fd0', 0.5));
  pot.position.set(0.012, 0.0055, 0.006);
  lm.add(pot);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.011, 20), std('#1b1d21', 0.4));
  cap.position.set(-0.016, 0.0063, 0);
  lm.add(cap);
  lm.position.set(0.035, PLACA_Y + 0.006, -0.074);
  arriba.add(lm);
  anchors.lm = new V3(0.035, PLACA_Y + 0.012, -0.074);

  // ------------------------------------------------------------ cables
  // cada cable: una curva, un tubo y unos puntitos que viajan por él
  const cables = [];
  const cablesG = new THREE.Group();
  root.add(cablesG);
  const tipo = {
    orden: {color: '#6B4EE6', r: 0.0007},
    energia: {color: '#F2603D', r: 0.0009},
    tierra: {color: '#2a2f38', r: 0.0009},
    encoder: {color: '#0F9D84', r: 0.0006},
  };
  const cable = (pts, t, id) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal');
    const mat = std(tipo[t].color, 0.45, 0, {transparent: true});
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, tipo[t].r, 8), mat);
    tube.castShadow = true;
    cablesG.add(tube);
    const n = 5;
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(tipo[t].r * 2.1, 10, 6), new THREE.MeshBasicMaterial({color: t === 'tierra' ? '#8a93a3' : tipo[t].color, transparent: true}), n);
    cablesG.add(dots);
    const c = {curve, tube, dots, n, tipo: t, id, mat};
    cables.push(c);
    return c;
  };
  const yE = pcbY + 0.001;
  const ePin = (k) => [0.0225, yE - 0.002, 0.03 + k * 0.006]; // pines del lado -x del ESP32
  const lPin = (k) => [-0.035 + 0.0037 + k * 0.00254, pcbY + 0.008, 0.045 + 0.0185];
  // órdenes: ENA IN1 IN2 IN3 IN4 ENB
  const ordenIds = ['ena', 'in1', 'in2', 'in3', 'in4', 'enb'];
  ordenIds.forEach((id, k) => {
    const a = ePin(k);
    const b = lPin(k);
    cable([a, [a[0] - 0.006, a[1] + 0.012 + k * 0.0015, a[2]], [0.0, pcbY + 0.026 + k * 0.0018, 0.068 + k * 0.001], [b[0] + 0.002, b[1] + 0.012, b[2] + 0.006], b], 'orden', id);
  });
  // energía: batería → L298N (12 V) y batería → LM2596 → ESP32 (5 V)
  cable([[0.0333 - 0.066, PLACA_Y + 0.016, -0.019], [-0.045, PLACA_Y + 0.03, -0.01], [-0.052, pcbY + 0.02, 0.04], [-0.047, pcbY + 0.009, 0.0625]], 'energia', 'bat_l298');
  cable([[0.0333, PLACA_Y + 0.016, -0.051], [0.045, PLACA_Y + 0.022, -0.06], [0.054, PLACA_Y + 0.012, -0.072]], 'energia', 'bat_lm');
  cable([[0.016, PLACA_Y + 0.012, -0.074], [0.008, PLACA_Y + 0.03, -0.06], [0.05, pcbY + 0.016, 0.0], [0.0475, yE - 0.002, 0.022]], 'energia', 'lm_esp');
  cable([[-0.0333, PLACA_Y + 0.016, 0.0], [-0.04, PLACA_Y + 0.024, 0.02], [-0.042, pcbY + 0.009, 0.0625]], 'tierra', 'gnd');
  // salidas del L298N a cada motor, y los encoders de vuelta al ESP32
  for (const lado of ['izq', 'der']) {
    const s = lado === 'izq' ? 1 : -1;
    const bx = lado === 'izq' ? -0.035 + 0.0175 : -0.035 - 0.0175;
    const cx = s * 0.0215;
    const cy = RW + 0.012;
    for (const dz of [-0.0025, 0.0025]) {
      cable([[bx, pcbY + 0.009, 0.041 + dz], [bx + s * 0.004, pcbY + 0.02, 0.03 + dz], [s * 0.016, PLACA_Y + 0.01, 0.012 + dz], [s * 0.017, PLACA_Y - 0.004, 0.02 + dz], [cx, cy + 0.002, ZA + dz]], 'energia', `mot_${lado}`);
    }
    for (const [k, dz] of [[0, -0.0045], [1, 0.0045]]) {
      const ex = 0.035 + 0.0127;
      const ez = 0.025 + (lado === 'izq' ? 0 : 0.012) + k * 0.004;
      cable([[cx, cy + 0.002, ZA + dz], [s * 0.012, PLACA_Y - 0.004, 0.012 + dz], [s * 0.01, PLACA_Y + 0.012, 0.004 + dz], [0.05, pcbY + 0.014, ez - 0.01], [ex, yE - 0.002, ez]], 'encoder', `enc_${lado}_${k ? 'b' : 'a'}`);
    }
  }

  // ------------------------------------------------------------ sombras
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  placa.castShadow = false;

  const M = new THREE.Matrix4();
  const P = new V3();
  // s: {ang: {izq, der} ángulo de rueda, arm: {izq, der} ángulo visual del inducido, xray, explode, wires,
  //     flow: {ena..} fase 0..1 por cable, act: {id: 0..1} intensidad, hall: {izq: [a,b], der: [a,b]}}
  const update = (s) => {
    for (const lado of ['izq', 'der']) {
      const {parts} = motores[lado];
      const ex = s.explode;
      parts.rueda.position.x = 0.09 + ex * 0.075;
      parts.rueda.rotation.x = s.ang[lado];
      parts.caja.position.x = 0.0665 + ex * 0.045;
      parts.soporte.position.x = 0.065 + ex * 0.045;
      parts.soporte.position.y = ex * 0.012;
      parts.lata.position.x = 0.0405 + ex * 0.02;
      parts.enc.position.x = 0.0205 - ex * 0.004;
      parts.inducido.rotation.x = s.arm[lado];
      parts.disco.rotation.x = s.arm[lado];
      parts.engranes.forEach((m, i) => {
        // cada etapa gira más lento: el piñón de cada etapa va con el engrane grande anterior
        const etapa = Math.floor(i / 2);
        const k = Math.pow(1 / 3.24, etapa + (i % 2));
        m.rotation.x = s.arm[lado] * k * (i % 2 ? -1 : 1);
      });
      parts.halls.forEach((h, k) => {
        const on = s.hall[lado][k];
        h.material.color.set(on ? '#0F9D84' : '#14213D');
        h.material.emissive = h.material.emissive || new THREE.Color();
        h.material.emissive.set(on ? '#0F9D84' : '#000000');
        h.material.emissiveIntensity = on ? 0.9 : 0;
      });
    }
    for (const m of xrayMats) {
      const o = m.userData.base * (1 - 0.85 * s.xray);
      m.opacity = o;
      m.depthWrite = o > 0.98;
    }
    arriba.position.y = s.explode * 0.035;
    chasis.position.y = s.explode * 0.015;
    // cables: se apagan en el despiece; los puntitos corren según la intensidad
    const wv = s.wires * (1 - s.explode);
    cablesG.visible = wv > 0.01;
    for (const c of cables) {
      c.mat.opacity = wv;
      c.mat.depthWrite = wv > 0.98;
      const act = s.act[c.id] ?? 0;
      const ph = s.flow[c.id] ?? 0;
      c.dots.material.opacity = wv * Math.min(1, act * 1.4);
      for (let i = 0; i < c.n; i++) {
        let u = (((ph + i / c.n) % 1) + 1) % 1;
        c.curve.getPointAt(u, P);
        const sc = act > 0.02 ? 1 : 0.0001;
        M.makeScale(sc, sc, sc).setPosition(P);
        c.dots.setMatrixAt(i, M);
      }
      c.dots.instanceMatrix.needsUpdate = true;
    }
    ledL.material.emissiveIntensity = 0.2 + 1.2 * Math.max(s.act.ena ?? 0, s.act.enb ?? 0);
  };

  return {root, update, anchors, cables, motores};
}
