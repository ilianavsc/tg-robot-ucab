// Las fichas de cada componente: texto fijo + datos en vivo. Todo viene del firmware y de los documentos del proyecto.

const num = (v, d = 2) => v.toFixed(d).replace('.', ',');
export const fmtDist = (d) => (!Number.isFinite(d) ? 'sin eco (> 4 m)' : d < 1 ? `${Math.round(d * 100)} cm` : `${num(d)} m`);
const ZONA_TXT = {critica: 'crítica (< 20 cm)', precaucion: 'precaución (20–50 cm)', libre: 'libre (> 50 cm)'};

function lecturaLinea(s) {
  const k = s.join('');
  if (k === '0000') return 'línea perdida';
  if (k === '0110') return 'centrado en la línea';
  const izq = s[0] + s[1];
  const der = s[2] + s[3];
  if (izq > der) return 'la línea queda a la izquierda';
  if (der > izq) return 'la línea queda a la derecha';
  return 'sobre la línea';
}

const PEND_MED = '[PENDIENTE DE MEDICIÓN FÍSICA]';
const PEND_FW = '[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]';

export const FICHAS = {
  tcrt: {
    nombre: 'Regleta de 4 sensores TCRT5000',
    corto: 'TCRT5000 ×4',
    color: '#0F9D84',
    rol: 'Cuatro sensores reflectivos infrarrojos, al frente y bajo el chasis. Miden el contraste de la cinta negra de 19 mm sobre el piso claro: cada uno entrega 1 si ve la cinta y 0 si no.',
    datos: [
      ['Pines (ADC1)', 'GPIO 36 (VP) · 39 (VN) · 34 · 35'],
      ['Orden', 'S1…S4, de izquierda a derecha'],
      ['Separación', '18 mm entre sensores'],
      ['Cinta', 'negra, 19 mm, sobre piso de granito'],
      ['Lazo', 'PD a 100 Hz sobre el error ponderado (P08)'],
    ],
    vivo: (v) => [
      ['Lectura', `[${v.sens.join(', ')}]`],
      ['Posición', lecturaLinea(v.sens)],
    ],
    estado: ['aviso', 'Simulado, falta medir'],
    nota: `En la demo cada sensor ve un círculo de ⌀ 8 mm (supuesto de simulación). Umbral de reflectancia y altura de montaje ${PEND_MED}.`,
  },
  us_front: {
    nombre: 'HC-SR04P frontal',
    corto: 'HC-SR04P frontal',
    color: '#E8B90C',
    rol: 'Ultrasonido que vigila el frente. Mide el tiempo del eco y lo convierte en distancia, con un haz de ±15°.',
    datos: [
      ['Pines', 'TRIG GPIO 23 · ECHO GPIO 33'],
      ['Lectura', 'alternada con el trasero: frente en ciclos pares, 100 ms por ciclo'],
      ['Zonas', '< 20 cm crítica (rojo) · 20–50 cm precaución (ámbar) · > 50 cm libre'],
      ['Fail-safe', 'con < 20 cm el firmware detiene avance, giros y modo autónomo; solo deja retroceder'],
      ['Sensor fallido', '3 lecturas sin eco (600 ms) marcan frente_ok = false'],
    ],
    vivo: (v) => [
      ['Distancia', fmtDist(v.dF)],
      ['Zona', ZONA_TXT[v.zonaF]],
    ],
    estado: ['aviso', 'Simulado, falta medir'],
    nota: 'En esta demo el robot solo reduce la velocidad al entrar en 20–50 cm para que se vea la zona (como el modo demo de la app). El firmware real avisa y, por debajo de 20 cm, detiene el avance.',
  },
  us_rear: {
    nombre: 'HC-SR04P trasero',
    corto: 'HC-SR04P trasero',
    color: '#E8B90C',
    rol: 'Ultrasonido que vigila la retaguardia. El firmware solo permite retroceder si atrás hay ≥ 20 cm y el sensor es válido.',
    datos: [
      ['Pines', 'TRIG GPIO 15 (separado del frontal) · ECHO GPIO 5'],
      ['TRIG propio', 'un TRIG por módulo: el trasero ya no comparte pin con el frontal (GPIO 23)'],
      ['Lectura', 'alternada: atrás en ciclos impares, 100 ms por ciclo'],
      ['Zonas', '< 20 cm crítica (rojo) · 20–50 cm precaución (ámbar) · > 50 cm libre'],
      ['Sensor fallido', '3 lecturas sin eco (600 ms) marcan atras_ok = false y bloquean el retroceso'],
    ],
    vivo: (v) => [
      ['Distancia', fmtDist(v.dR)],
      ['Zona', ZONA_TXT[v.zonaR]],
    ],
    estado: ['aviso', 'Simulado, falta medir'],
    nota: 'Los conos de la demo son una ayuda visual del haz; no hay ningún sensor real conectado todavía.',
  },
  esp32: {
    nombre: 'ESP32 móvil (DevKit de 30 pines)',
    corto: 'ESP32 móvil',
    color: '#6B4EE6',
    rol: 'Controlador principal del robot: lee los sensores, calcula el control diferencial de las ruedas y se comunica con la app por MQTT. Es el único microcontrolador a bordo.',
    datos: [
      ['Firmware', 'robot_integrado.ino: modo autónomo (PD a 100 Hz) y modo manual por MQTT'],
      ['Motores (L298N)', 'ENA 25 · IN1 26 · IN2 27 · ENB 14 · IN3 4 · IN4 13, PWM a 20 kHz'],
      ['Encoders', 'GPIO 18 / 19 (izq) · 16 / 17 (der), interrupciones'],
      ['MQTT', 'estado, órdenes (QoS 1), ack, ultrasonido y alertas (QoS 2)'],
      ['Balizas BLE', 'dos ESP32 fijos en los extremos de la pista (no van en el robot)'],
    ],
    vivo: (v) => [
      ['PWM izquierdo (ENA)', `${Math.round(v.mot.dutyIzq * 100)} %`],
      ['PWM derecho (ENB)', `${Math.round(v.mot.dutyDer * 100)} %`],
    ],
    estado: ['hecho', 'Firmware integrado'],
    nota: `El escaneo BLE de las balizas ${PEND_FW}.`,
  },
  mpu: {
    nombre: 'MPU-6050 (IMU)',
    corto: 'MPU-6050',
    color: '#2c4fb8',
    rol: 'Acelerómetro y giroscopio de 6 ejes en el centro del chasis. Está pensado para mantener el rumbo relativo (heading hold) con el giroscopio en los tramos sin cinta; no hay magnetómetro.',
    datos: [
      ['Bus I²C', 'SDA GPIO 21 · SCL GPIO 22 · INT GPIO 2'],
      ['Uso previsto', 'rumbo relativo (heading hold) dentro de teach-and-repeat'],
      ['Ejes del módulo', 'x rojo · y verde · z azul'],
    ],
    vivo: (v) => [
      ['Giro en z (ideal)', `${num((v.w * 180) / Math.PI, 0)} °/s`],
      ['Rumbo relativo (ideal)', `${num((((v.th * 180) / Math.PI) % 360 + 360) % 360, 0)} °`],
    ],
    estado: ['pendiente', 'Pendiente de integración'],
    nota: `La lectura de la MPU-6050 ${PEND_FW}; el firmware solo reserva el bus I²C. Los valores de arriba son ideales (sin deriva). Esta demo no ejecuta teach-and-repeat: esa lógica de 5 estados vive en el Simulador 2 V2.`,
  },
  traccion: {
    nombre: 'Tracción diferencial + chasis PLA',
    corto: 'Tracción + chasis PLA',
    color: '#F2603D',
    rol: 'Dos motores DC con caja reductora, uno por rueda, sobre un chasis impreso en PLA con una rueda loca atrás. Para girar, una rueda va más rápido que la otra.',
    datos: [
      ['Motor', 'Emoshayoga JGA25-371 «Speed 200»: 280 rpm en vacío a 12 V, reducción 1:21,3'],
      ['Encoders', 'efecto Hall, 11 pulsos por vuelta y canal (imán de 22 polos)'],
      ['Driver', 'L298N, caída de unos 2,1 V'],
      ['Ruedas', 'Ø 65 mm, distancia entre ruedas 180 mm'],
      ['Chasis', 'placa de PLA con la rueda loca atrás'],
    ],
    vivo: (v) => [
      ['Velocidad', `${num(v.v)} m/s`],
      ['Giro', `${num((v.w * 180) / Math.PI, 0)} °/s`],
      ['Rueda izq / der', `${Math.round(v.mot.rpmIzq)} / ${Math.round(v.mot.rpmDer)} rpm`],
      ['PWM izq / der', `${Math.round(v.mot.dutyIzq * 100)} / ${Math.round(v.mot.dutyDer * 100)} %`],
      ['Encoder izq / der', `${Math.round(v.mot.encIzq)} / ${Math.round(v.mot.encDer)} Hz`],
    ],
    estado: ['aviso', 'Simulado, falta medir'],
    nota: `Modelo único de la simulación. La velocidad de la demo (≈ 0,40 m/s), la caída del driver y el factor de carga son supuestos ${PEND_MED}.`,
  },
  bateria: {
    nombre: 'Batería 3S Li-Ion (3 × 18650)',
    corto: 'Batería 3S',
    color: '#2a7fb8',
    rol: 'Alimenta todo el robot: unos 12 V al L298N y, a través del regulador LM2596, 5 V al ESP32. Va en la zona trasera del chasis.',
    datos: [
      ['Rango', '9,90 V (corte) a 12,60 V (llena); nominal 11,1 V'],
      ['Medición', 'ADC en GPIO 32 con divisor de 100 kΩ / 22 kΩ'],
      ['Alertas', 'aviso a 10,30 V · corte a 9,90 V (rearme sobre 10,10 V)'],
      ['Regulador', 'LM2596 a 5 V para el ESP32'],
    ],
    vivo: (v) => [
      ['Tensión (supuesta)', '11,1 V nominal'],
      ['Corriente de motores', `${num(v.mot.corriente)} A (modelo)`],
    ],
    estado: ['aviso', 'Simulado, falta medir'],
    nota: `En la demo la tensión es fija: no se descarga. Capacidad y autonomía ${PEND_MED}.`,
  },
};

export const ORDEN = ['tcrt', 'us_front', 'us_rear', 'esp32', 'mpu', 'traccion', 'bateria'];

// Texto corto de cada etiqueta 3D (versión ancha y versión estrecha)
export const ETIQUETAS = {
  tcrt: {largo: (v) => `4× TCRT5000 · [${v.sens.join(',')}]`, corto: (v) => `TCRT ×4 [${v.sens.join('')}]`},
  us_front: {largo: (v) => `HC-SR04P frontal · ${fmtDist(v.dF)}`, corto: (v) => `US frente · ${fmtDist(v.dF)}`},
  us_rear: {largo: (v) => `HC-SR04P trasero · TRIG GPIO 15 (separado) · ${fmtDist(v.dR)}`, corto: () => 'US trasero · TRIG GPIO 15'},
  esp32: {largo: () => 'ESP32 móvil · MQTT + control diferencial', corto: () => 'ESP32 móvil'},
  mpu: {largo: () => 'MPU-6050 · rumbo (heading hold)', corto: () => 'MPU-6050'},
  traccion: {largo: () => 'Tracción diferencial · chasis PLA', corto: () => 'Tracción + PLA'},
  bateria: {largo: () => 'Batería 3S Li-Ion', corto: () => 'Batería 3S'},
};
