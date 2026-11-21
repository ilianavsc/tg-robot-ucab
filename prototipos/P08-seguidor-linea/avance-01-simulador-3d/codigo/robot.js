// La geometría del robot, construida en código y en metros reales.
// Eje x: a lo ancho (+x es la izquierda del robot), y: arriba, z: hacia adelante.
// update(s) posa todo: giro de ruedas e inducidos, rayos X, sensores (TCRT5000, HC-SR04P), cables y el flujo por los cables.
import * as THREE from 'three';

const V3 = THREE.Vector3;
export const RW = 0.0325; // radio de rueda
export const ZA = 0.03; // eje de las ruedas, adelante del centro
export const PLACA_Y = 0.05;
export const LARGO = 0.21; // largo del chasis de PLA (m)

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

// opts.tz: distancia de la regleta TCRT5000 al centro del chasis (m); opts.conos: dibujar los conos de los ultrasonidos
export function buildRobot(opts = {}) {
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
  const placa = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, LARGO), placaMat);
  placa.position.set(0, PLACA_Y + 0.002, 0);
  placa.renderOrder = 2;
  chasis.add(placa);
  const PLACA_OP = 0.55;
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
  loca.position.set(0, 0, -0.07);
  chasis.add(loca);
  anchors.loca = new V3(0, 0.02, -0.07);

  // ------------------------------------------------------------ motores (izq: +x, der: -x)
  const motores = {};
  const motoresG = [];
  for (const lado of ['izq', 'der']) {
    const s = lado === 'izq' ? 1 : -1;
    const g = new THREE.Group();
    g.position.set(0, RW, ZA);
    g.scale.x = s; // el derecho es el espejo del izquierdo
    root.add(g);
    const parts = {};
    // rueda
    const rueda = new THREE.Group();
    const llanta = new THREE.Mesh(cyl(RW, 0.026, 64), fadeX(std('#1d2025', 0.85)));
    rueda.add(llanta);
    const rin = new THREE.Mesh(cyl(0.023, 0.021, 48), fadeX(std('#f4f6f5', 0.5)));
    rueda.add(rin);
    const radioMat = fadeX(std('#c3cfcb', 0.6));
    const bandaMat = fadeX(std('#30353c', 0.9));
    for (let i = 0; i < 6; i++) {
      // radios del rin, para que se vea el giro
      const rr = new THREE.Mesh(new THREE.BoxGeometry(0.0235, 0.044, 0.0035), radioMat);
      rr.rotation.x = (i / 6) * Math.PI;
      rueda.add(rr);
    }
    const marca = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.008, 0.007), fadeX(std('#F2603D', 0.5)));
    marca.position.y = 0.017;
    rueda.add(marca);
    // dibujo de la llanta
    for (let i = 0; i < 24; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.0016, 0.004), bandaMat);
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
    motoresG.push(g);
    anchors[`rueda_${lado}`] = new V3(s * 0.103, RW, ZA);
    anchors[`caja_${lado}`] = new V3(s * 0.0665, RW - 0.0125, ZA);
    anchors[`lata_${lado}`] = new V3(s * 0.04, RW - 0.012, ZA);
    anchors[`enc_${lado}`] = new V3(s * 0.0205, RW, ZA - 0.0125);
  }

  // ------------------------------------------------------------ arriba: placas, sensores y batería
  const arriba = new THREE.Group();
  root.add(arriba);
  const pcbY = PLACA_Y + 0.004 + 0.008;
  const ESP = {x: 0, z: 0.045}; // el ESP32 móvil, al centro-frente
  const L298 = {x: -0.045, z: 0.045};
  const BATZ = -0.058; // la batería 3S, atrás
  const LMP = {x: 0.055, z: -0.012};
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
  esp.position.set(ESP.x, pcbY, ESP.z);
  for (const [dx, dz] of [[-0.011, -0.022], [0.011, -0.022], [-0.011, 0.022], [0.011, 0.022]]) separador(ESP.x + dx, ESP.z + dz, arriba);
  arriba.add(esp);
  anchors.esp = new V3(ESP.x, pcbY + 0.005, ESP.z + 0.012);

  // MPU-6050 (módulo GY-521, 21 x 16 mm) en el centro del chasis
  const mpu = new THREE.Group();
  mpu.add(new THREE.Mesh(new THREE.BoxGeometry(0.0164, 0.0016, 0.0212), std('#2c4fb8', 0.5)));
  const mpuChip = new THREE.Mesh(new THREE.BoxGeometry(0.0046, 0.0013, 0.0046), std('#14161a', 0.5));
  mpuChip.position.set(0, 0.0014, 0.0008);
  mpu.add(mpuChip);
  const mpuHdr = new THREE.Mesh(new THREE.BoxGeometry(0.0150, 0.0025, 0.0025), std('#0f1114', 0.7));
  mpuHdr.position.set(0, 0.0018, -0.0092);
  mpu.add(mpuHdr);
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.0075, 0.0005), std('#e0c35a', 0.3, 0.9));
    p.position.set(-0.00889 + i * 0.00254, 0.0036, -0.0092);
    mpu.add(p);
  }
  // el pequeño triedro del IMU: x (rojo), y (verde), z (azul)
  const eje = (color, sx, sy, sz, px, py, pz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({color}));
    m.position.set(px, py, pz);
    mpu.add(m);
  };
  eje('#F2603D', 0.011, 0.0008, 0.0008, 0.0055, 0.0024, 0.0008);
  eje('#0F9D84', 0.0008, 0.011, 0.0008, 0, 0.0078, 0.0008);
  eje('#6B4EE6', 0.0008, 0.0008, 0.011, 0, 0.0024, 0.0063);
  mpu.position.set(0, pcbY, 0);
  for (const [dx, dz] of [[-0.006, -0.008], [0.006, -0.008], [-0.006, 0.008], [0.006, 0.008]]) separador(dx, dz, arriba);
  arriba.add(mpu);
  anchors.mpu = new V3(0, pcbY + 0.012, 0);

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
  l298.position.set(L298.x, pcbY, L298.z);
  for (const [dx, dz] of [[-0.019, -0.019], [0.019, -0.019], [-0.019, 0.019], [0.019, 0.019]]) separador(L298.x + dx, L298.z + dz, arriba);
  arriba.add(l298);
  anchors.l298 = new V3(L298.x, pcbY + 0.02, L298.z - 0.008);

  // batería 3S: tres 18650 en su porta pilas, en la zona trasera
  const bat = new THREE.Group();
  const porta = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.062), std('#202328', 0.7));
  porta.position.y = 0.006;
  bat.add(porta);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(cyl(0.0093, 0.065, 40), std('#2a7fb8', 0.4, 0.2));
    c.position.set(0, 0.0105, -0.019 + i * 0.019);
    bat.add(c);
    const polo = new THREE.Mesh(cyl(0.0035, 0.0016, 20), std('#d7dbde', 0.3, 0.9));
    polo.position.set(0.0333, 0.0105, -0.019 + i * 0.019);
    bat.add(polo);
  }
  const bms = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.0016, 0.015), std('#2c6b3f', 0.55));
  bms.position.set(0, 0.021, 0);
  bat.add(bms);
  bat.position.set(0, PLACA_Y + 0.004, BATZ);
  arriba.add(bat);
  anchors.bat = new V3(0, PLACA_Y + 0.025, BATZ);

  // LM2596 (43 x 21 mm), girado para que su lado largo vaya a lo largo del chasis
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
  lm.rotation.y = Math.PI / 2;
  lm.position.set(LMP.x, PLACA_Y + 0.006, LMP.z);
  arriba.add(lm);

  // ------------------------------------------------------------ módulos ultrasónicos HC-SR04P
  // la cara del sensor mira a +z del grupo; el trasero va girado media vuelta
  const US_Y = PLACA_Y + 0.0045 + 0.010;
  const US_CARA = 0.0128; // de la placa a la cara de los transductores
  const usModulo = () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.020, 0.0016), std('#2a63b5', 0.5)));
    for (const sx of [-1, 1]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 32), std('#c8ccd0', 0.35, 0.85));
      can.geometry.rotateX(Math.PI / 2);
      can.position.set(sx * 0.0105, 0, 0.0068);
      g.add(can);
      const malla = new THREE.Mesh(new THREE.CylinderGeometry(0.0066, 0.0066, 0.0006, 28), std('#15171b', 0.7));
      malla.geometry.rotateX(Math.PI / 2);
      malla.position.set(sx * 0.0105, 0, US_CARA - 0.0003);
      g.add(malla);
    }
    const cristal = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.0075, 16), std('#d5d8dc', 0.3, 0.9));
    cristal.geometry.rotateX(Math.PI / 2);
    cristal.position.set(0, 0.0015, 0.0045);
    g.add(cristal);
    const hdr = new THREE.Mesh(new THREE.BoxGeometry(0.0108, 0.0025, 0.0025), std('#0f1114', 0.7));
    hdr.position.set(0, 0.0085, -0.002);
    g.add(hdr);
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.0005, 0.007), std('#e0c35a', 0.3, 0.9));
      p.position.set(-0.00381 + i * 0.00254, 0.0085, -0.0045);
      g.add(p);
    }
    return g;
  };
  const usF = usModulo();
  usF.position.set(0, US_Y, 0.0985 - US_CARA + 0.0075);
  arriba.add(usF);
  const usR = usModulo();
  usR.rotation.y = Math.PI;
  usR.position.set(0, US_Y, -0.0985 + US_CARA - 0.0075);
  arriba.add(usR);
  const ZF = usF.position.z + US_CARA; // cara frontal
  const ZR = usR.position.z - US_CARA; // cara trasera
  anchors.us_front = new V3(0, US_Y + 0.012, ZF);
  anchors.us_rear = new V3(0, US_Y + 0.012, ZR);

  // conos de detección: rojo 0–20 cm (crítico) y ámbar 20–50 cm (precaución). Medio ángulo de 15°.
  const TAN = Math.tan((15 * Math.PI) / 180);
  const frustum = (d0, d1, color) => {
    const g = new THREE.CylinderGeometry(0.008 + d1 * TAN, 0.008 + d0 * TAN, d1 - d0, 32, 1, true);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, (d0 + d1) / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide}));
    m.userData.nopick = true;
    m.renderOrder = 3;
    const borde = new THREE.LineSegments(new THREE.EdgesGeometry(g, 40), new THREE.LineBasicMaterial({color, transparent: true, opacity: 0.35}));
    borde.userData.nopick = true;
    m.add(borde);
    return m;
  };
  const conos = (z, giro) => {
    const g = new THREE.Group();
    const roja = frustum(0, 0.2, '#F2603D');
    const ambar = frustum(0.2, 0.5, '#E8B90C');
    g.add(roja, ambar);
    const marca = new THREE.Mesh(new THREE.SphereGeometry(0.006, 16, 12), new THREE.MeshBasicMaterial({color: '#ffffff'}));
    marca.userData.nopick = true;
    marca.visible = false;
    marca.renderOrder = 4;
    g.add(marca);
    g.position.set(0, US_Y, z);
    g.rotation.y = giro;
    arriba.add(g);
    return {g, roja, ambar, marca};
  };
  const conoF = conos(ZF, 0);
  const conoR = conos(ZR, Math.PI);
  if (opts.conos === false) conoF.g.visible = conoR.g.visible = false;

  // ------------------------------------------------------------ regleta de 4 TCRT5000, al frente bajo el chasis
  const TZ = opts.tz ?? 0.112;
  const TY = 0.0185; // altura de la placa de la regleta
  const tcrtX = [0.027, 0.009, -0.009, -0.027]; // S1..S4, de izquierda a derecha, cada 18 mm
  const tcrtG = new THREE.Group();
  root.add(tcrtG);
  const barra = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.0016, 0.02), std('#2f6f55', 0.55));
  barra.position.set(0, TY, TZ);
  tcrtG.add(barra);
  const plaMat = std('#f1f4f2', 0.6);
  for (const sx of [-1, 1]) {
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.006, PLACA_Y - TY, 0.006), plaMat);
    poste.position.set(sx * 0.034, (PLACA_Y + TY) / 2, TZ - 0.008);
    tcrtG.add(poste);
  }
  const sensores = [];
  tcrtX.forEach((tx, i) => {
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.0058, 0.007, 0.0102), std('#14161a', 0.55));
    cuerpo.position.set(tx, TY - 0.0008 - 0.0035, TZ);
    tcrtG.add(cuerpo);
    const emisor = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 14, 10), new THREE.MeshStandardMaterial({color: '#7a1b1b', emissive: '#ff3030', emissiveIntensity: 0.9}));
    emisor.position.set(tx, TY - 0.0008 - 0.007, TZ - 0.0026);
    tcrtG.add(emisor);
    const receptor = new THREE.Mesh(new THREE.SphereGeometry(0.0014, 14, 10), std('#0b0c0e', 0.3));
    receptor.position.set(tx, TY - 0.0008 - 0.007, TZ + 0.0026);
    tcrtG.add(receptor);
    // el LED de estado, encima de la placa, y la huella sobre el piso
    const ind = new THREE.Mesh(new THREE.BoxGeometry(0.0036, 0.0012, 0.0024), new THREE.MeshStandardMaterial({color: '#1b3a30', emissive: '#000000'}));
    ind.position.set(tx, TY + 0.0014, TZ - 0.0065);
    tcrtG.add(ind);
    const huella = new THREE.Mesh(new THREE.CircleGeometry(0.004, 24), new THREE.MeshBasicMaterial({color: '#7f9a93', transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
    huella.rotation.x = -Math.PI / 2;
    huella.position.set(tx, 0.002, TZ);
    huella.userData.nopick = true;
    tcrtG.add(huella);
    sensores.push({ind, huella});
    anchors[`tcrt${i}`] = new V3(tx, TY, TZ);
  });
  anchors.tcrt = new V3(0, TY + 0.002, TZ + 0.012);

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
    sensor: {color: '#E8B90C', r: 0.0006},
  };
  const cable = (pts, t, id) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'centripetal');
    const mat = std(tipo[t].color, 0.45, 0, {transparent: true});
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, tipo[t].r, 8), mat);
    tube.castShadow = true;
    tube.userData.nopick = true;
    cablesG.add(tube);
    const n = 5;
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(tipo[t].r * 2.1, 10, 6), new THREE.MeshBasicMaterial({color: t === 'tierra' ? '#8a93a3' : tipo[t].color, transparent: true}), n);
    dots.userData.nopick = true;
    cablesG.add(dots);
    const c = {curve, tube, dots, n, tipo: t, id, mat};
    cables.push(c);
    return c;
  };
  const yE = pcbY + 0.001;
  const ePin = (k) => [ESP.x - 0.0127, yE - 0.002, ESP.z - 0.015 + k * 0.006]; // pines del lado -x del ESP32
  const lPin = (k) => [L298.x + 0.0037 + k * 0.00254, pcbY + 0.008, L298.z + 0.0185];
  // órdenes: ENA IN1 IN2 IN3 IN4 ENB
  ['ena', 'in1', 'in2', 'in3', 'in4', 'enb'].forEach((id, k) => {
    const a = ePin(k);
    const b = lPin(k);
    cable([a, [a[0] - 0.005, a[1] + 0.012 + k * 0.0015, a[2]], [(a[0] + b[0]) / 2, pcbY + 0.026 + k * 0.0018, (a[2] + b[2]) / 2 + 0.003], [b[0] + 0.002, b[1] + 0.012, b[2] + 0.006], b], 'orden', id);
  });
  // energía: batería → L298N (12 V) y batería → LM2596 → ESP32 (5 V)
  cable([[-0.0333, PLACA_Y + 0.016, BATZ + 0.019], [-0.05, PLACA_Y + 0.03, -0.025], [-0.064, pcbY + 0.02, 0.02], [L298.x - 0.012, pcbY + 0.009, L298.z + 0.0175]], 'energia', 'bat_l298');
  cable([[0.0333, PLACA_Y + 0.016, BATZ - 0.019], [0.046, PLACA_Y + 0.022, -0.05], [LMP.x, PLACA_Y + 0.014, LMP.z - 0.02]], 'energia', 'bat_lm');
  cable([[LMP.x, PLACA_Y + 0.014, LMP.z + 0.021], [0.046, PLACA_Y + 0.03, 0.022], [0.03, pcbY + 0.016, 0.03], [ESP.x + 0.0127, yE - 0.002, ESP.z + 0.02]], 'energia', 'lm_esp');
  cable([[-0.0333, PLACA_Y + 0.014, BATZ], [-0.046, PLACA_Y + 0.026, -0.03], [-0.058, pcbY + 0.015, 0.03], [L298.x - 0.006, pcbY + 0.009, L298.z + 0.0175]], 'tierra', 'gnd');
  // sensores al ESP32 (señales de la regleta y de los dos ultrasonidos)
  cable([[0, TY, TZ - 0.003], [0, 0.04, TZ + 0.006], [0, 0.062, TZ - 0.004], [0, pcbY + 0.026, 0.088], [0, yE + 0.002, ESP.z + 0.0255]], 'sensor', 'tcrt');
  cable([[0.016, US_Y, usF.position.z - 0.001], [0.02, US_Y + 0.012, 0.082], [0.02, pcbY + 0.016, ESP.z + 0.032], [ESP.x + 0.0127, yE - 0.002, ESP.z + 0.015]], 'sensor', 'us_f');
  cable([[0.016, US_Y, usR.position.z + 0.001], [0.026, US_Y + 0.02, -0.07], [0.028, US_Y + 0.022, -0.02], [0.02, pcbY + 0.016, ESP.z - 0.02], [ESP.x + 0.0127, yE - 0.002, ESP.z - 0.02]], 'sensor', 'us_r');
  // salidas del L298N a cada motor, y los encoders de vuelta al ESP32
  for (const lado of ['izq', 'der']) {
    const s = lado === 'izq' ? 1 : -1;
    const bx = L298.x + s * 0.0175;
    const cx = s * 0.0215;
    const cy = RW + 0.012;
    for (const dz of [-0.0025, 0.0025]) {
      cable([[bx, pcbY + 0.009, L298.z - 0.004 + dz], [bx + s * 0.004, pcbY + 0.03, 0.032 + dz], [s * 0.02, PLACA_Y + 0.018, 0.016 + dz], [s * 0.017, PLACA_Y - 0.004, 0.02 + dz], [cx, cy + 0.002, ZA + dz]], 'energia', `mot_${lado}`);
    }
    for (const [k, dz] of [[0, -0.0045], [1, 0.0045]]) {
      const ex = lado === 'izq' ? ESP.x + 0.0127 : ESP.x - 0.0127;
      const ez = ESP.z - 0.026 + k * 0.004;
      cable([[cx, cy + 0.002, ZA + dz], [s * 0.012, PLACA_Y - 0.004, 0.012 + dz], [s * 0.01, PLACA_Y + 0.012, 0.004 + dz], [s * 0.026, pcbY + 0.012, ez - 0.008], [ex, yE - 0.002, ez]], 'encoder', `enc_${lado}_${k ? 'b' : 'a'}`);
    }
  }

  // ------------------------------------------------------------ componentes: etiquetas de pieza, selección y resaltado
  const tag = (obj, id) => obj.traverse((o) => (o.userData.comp = id));
  tag(esp, 'esp32');
  tag(mpu, 'mpu');
  tag(tcrtG, 'tcrt');
  tag(usF, 'us_front');
  tag(usR, 'us_rear');
  tag(bat, 'bateria');
  tag(lm, 'bateria');
  tag(l298, 'traccion');
  tag(chasis, 'traccion');
  motoresG.forEach((g) => tag(g, 'traccion'));
  anchors.traccion = anchors.rueda_izq;
  anchors.bateria = anchors.bat;
  anchors.esp32 = anchors.esp;

  const piezas = {
    esp32: [esp],
    mpu: [mpu],
    tcrt: [tcrtG],
    us_front: [usF],
    us_rear: [usR],
    bateria: [bat, lm],
    traccion: [...motoresG, l298, placa],
  };
  root.updateMatrixWorld(true);
  const resaltes = {};
  for (const [id, objs] of Object.entries(piezas)) {
    resaltes[id] = new THREE.Group();
    resaltes[id].visible = false;
    for (const o of objs) {
      const bb = new THREE.Box3().setFromObject(o).expandByScalar(0.003);
      const sz = bb.getSize(new V3());
      const ce = bb.getCenter(new V3());
      const caja = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(sz.x, sz.y, sz.z)), new THREE.LineBasicMaterial({color: '#FFD23F', depthTest: false, transparent: true}));
      caja.position.copy(ce);
      caja.renderOrder = 10;
      caja.userData.nopick = true;
      resaltes[id].add(caja);
    }
    root.add(resaltes[id]);
  }
  const pickables = [];
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && o.userData.comp && !o.userData.nopick) pickables.push(o);
  });

  // ------------------------------------------------------------ sombras
  root.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && !o.userData.nopick) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  placa.castShadow = false;

  const M = new THREE.Matrix4();
  const P = new V3();
  const COL = {critica: '#F2603D', precaucion: '#E8B90C', libre: '#0F9D84'};
  const ajustaCono = (c, zona, dist, t) => {
    const pulso = 0.5 + 0.5 * Math.sin(t * 7);
    const roja = zona === 'critica' ? 0.36 + 0.12 * pulso : 0.06;
    const ambar = zona === 'precaucion' ? 0.28 + 0.08 * pulso : zona === 'critica' ? 0.12 : 0.05;
    c.roja.material.opacity = roja;
    c.roja.children[0].material.opacity = Math.min(1, roja * 3);
    c.ambar.material.opacity = ambar;
    c.ambar.children[0].material.opacity = Math.min(1, ambar * 3);
    const hay = Number.isFinite(dist) && dist < 0.55;
    c.marca.visible = hay;
    if (hay) {
      c.marca.position.set(0, 0, US_CARA + dist);
      c.marca.material.color.set(COL[zona]);
    }
  };
  // s: {ang: {izq, der} ángulo de rueda, arm: {izq, der} ángulo visual del inducido, xray, wires, t,
  //     flow: {id} fase 0..1 por cable, act: {id: 0..1} intensidad, hall: {izq: [a,b], der: [a,b]},
  //     sens: [0|1 ×4], zonaF, zonaR, dF, dR, sel: id del componente resaltado o null}
  const update = (s) => {
    for (const lado of ['izq', 'der']) {
      const {parts} = motores[lado];
      parts.rueda.rotation.x = s.ang[lado];
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
    placaMat.opacity = PLACA_OP * (1 - 0.75 * s.xray);
    // regleta TCRT5000: LED de estado y huella sobre el piso
    sensores.forEach((q, i) => {
      const on = !!s.sens[i];
      q.ind.material.color.set(on ? '#2EE6A8' : '#1b3a30');
      q.ind.material.emissive.set(on ? '#2EE6A8' : '#000000');
      q.ind.material.emissiveIntensity = on ? 1.2 : 0;
      q.huella.material.color.set(on ? '#2EE6A8' : '#7f9a93');
      q.huella.material.opacity = on ? 0.95 : 0.4;
    });
    ajustaCono(conoF, s.zonaF, s.dF, s.t);
    ajustaCono(conoR, s.zonaR, s.dR, s.t);
    for (const id in resaltes) resaltes[id].visible = s.sel === id;
    if (s.sel) {
      const k = 0.65 + 0.35 * Math.sin(s.t * 6);
      resaltes[s.sel].children.forEach((c) => (c.material.opacity = k));
    }
    // cables: los puntitos corren según la intensidad
    const wv = s.wires;
    cablesG.visible = wv > 0.01;
    for (const c of cables) {
      c.mat.opacity = wv;
      c.mat.depthWrite = wv > 0.98;
      const act = s.act[c.id] ?? 0;
      const ph = s.flow[c.id] ?? 0;
      c.dots.material.opacity = wv * Math.min(1, act * 1.4);
      for (let i = 0; i < c.n; i++) {
        const u = (((ph + i / c.n) % 1) + 1) % 1;
        c.curve.getPointAt(u, P);
        const sc = act > 0.02 ? 1 : 0.0001;
        M.makeScale(sc, sc, sc).setPosition(P);
        c.dots.setMatrixAt(i, M);
      }
      c.dots.instanceMatrix.needsUpdate = true;
    }
    ledL.material.emissiveIntensity = 0.2 + 1.2 * Math.max(s.act.ena ?? 0, s.act.enb ?? 0);
    led.material.emissiveIntensity = 0.5 + 0.5 * Math.sin(s.t * 9);
  };

  return {root, update, anchors, cables, motores, pickables};
}
