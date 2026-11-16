# Checklist de hardware · Laboratorio 18 de noviembre de 2026

**Proyecto:** Robot móvil para transporte de componentes en el laboratorio con app y alertas
**Firmware:** `firmware/robot_integrado.ino` (v2, 35.614 bytes · 71 % flash · 15 % RAM)
**Hardware:** ESP32 DevKit 30 pines · L298N · 4× TCRT5000 · 2 encoders · 2× JGA25-371 · batería 3S
**Llenar antes de salir:** multímetro, resistencias y cables confirmados en la mochila

> **Regla de oro:** la batería se conecta **al final** y se desconecta **antes** de tocar cualquier cable.
> Todo el cableado se arma con la placa apagada y el USB desconectado.

---

## 1. Seguridad eléctrica

### A · TCRT5000 a 3,3 V — NUNCA a 5 V

- Alimentar **VCC de los 4 módulos desde el pin `3V3` del ESP32** (no desde `VIN`, no desde el L298N).
- **Por qué:** la salida `AO` entrega de 0 V a VCC. A 5 V, el `AO` llega a 5 V y el ADC del ESP32
  tolera **3,3 V** → se quema la entrada. Los GPIO 36, 39, 34 y 35 son **solo entrada**: no hay
  protección ni forma de recuperarlos.
- Consumo: 4 × ~20 mA = **~80 mA**. Está dentro del regulador del DevKit, pero si aparecen
  reinicios aleatorios, alimentar los sensores desde una fuente aparte **con GND común**.
- Si un módulo no arranca a 3,3 V: alimentarlo a 5 V y poner un **divisor 10 kΩ / 20 kΩ** en el `AO`
  antes de entrar al ESP32. Nunca conectar el `AO` directo.

- [ ] Los 4 `VCC` de los TCRT5000 miden **3,3 V** con el multímetro (no 5 V)
- [ ] El `AO` de cada sensor mide **≤ 3,3 V** en su punto más alto

### B · Resistencias pull-down de 10 kΩ en IN1, IN2, IN3 e IN4

- Un resistor de **10 kΩ de cada IN a GND** (4 resistencias en total).
- **Por qué:** durante el arranque, GPIO 26, 27, 4 y 13 quedan flotando y **GPIO 14 saca una señal
  de reloj** mientras el chip bota. Con los IN flotantes, el L298N puede interpretar "adelante" y el
  robot da un **tirón** antes de que `setup()` ponga todo en LOW.
- Verificación: robot **en el aire**, batería conectada, pulsar RESET → **las ruedas no deben girar**
  en ningún momento antes de que salga `Robot integrado listo.` por el monitor serie.

- [ ] 10 kΩ entre IN1 (GPIO 26) y GND
- [ ] 10 kΩ entre IN2 (GPIO 27) y GND
- [ ] 10 kΩ entre IN3 (GPIO 4) y GND
- [ ] 10 kΩ entre IN4 (GPIO 13) y GND

### C · Polaridad de los sensores: negro = alto, blanco = bajo

El firmware asume `ADC_CINTA = 3300` (cinta negra) y `ADC_PISO = 500` (piso claro). Si un módulo
entrega la señal al revés, **el PD se aleja de la línea** en vez de seguirla.

**Prueba definitiva (multímetro), 2 minutos por sensor:**
1. Medir `AO` del sensor con el robot sobre **piso claro** → anotar voltaje (esperado: bajo, ~0,4 V).
2. Medir `AO` del mismo sensor sobre la **cinta negra** → anotar voltaje (esperado: alto, ~2,7 V).
3. **Negro debe dar MÁS tensión que blanco.** Si no, ese sensor está invertido.

**Prueba funcional (monitor serie), sin código:**
1. Levantar el robot y poner la cinta negra justo debajo de la regleta.
2. Leer la telemetría de 1 s:
   ```
   [autonomo] linea   -2.1 mm | P -0.06 D  0.00 | PWM izq  0.86 der  0.74 | ...
   ```
   Sobre la cinta **no** debe aparecer `PERDIDA` y `linea_mm` debe quedar cerca de 0.
3. Quitar la cinta (piso claro): debe aparecer `PERDIDA`.
4. Si el comportamiento es al revés → polaridad invertida, **no seguir con la prueba del PD**.

- [ ] Los 4 sensores verificados con multímetro (negro > blanco)
- [ ] Telemetría confirma: cinta = "veo línea", piso = `PERDIDA`

### Otros riesgos (5 puntos)

1. **GND común** entre batería, L298N y ESP32. Sin él, los sensores leen basura.
2. **No alimentar el ESP32 por `VIN` desde el L298N** mientras el USB está conectado (retorno de tensión).
3. Quitar los **puentes ENA/ENB** del L298N: los usa el PWM del firmware (GPIO 25 y 14).
4. Medir la batería **antes** de conectar: si está por debajo de **9,9 V**, cargarla (la alarma salta ahí).
5. Revisar que ningún cable toque el disipador del L298N ni las ruedas en movimiento.

---

## 2. Tabla de conexiones rápidas

| Pin ESP32 | Conecta a | Nota |
|---|---|---|
| `3V3` | VCC de los 4 TCRT5000 | **Nunca 5 V** |
| `GND` | GND común (L298N, sensores, batería −) | Un solo punto de referencia |
| `25` (ENA) | ENA del L298N | PWM 20 kHz · quitar el puente |
| `26` (IN1) | IN1 del L298N | + 10 kΩ a GND |
| `27` (IN2) | IN2 del L298N | + 10 kΩ a GND |
| `14` (ENB) | ENB del L298N | PWM 20 kHz · quitar el puente |
| `4` (IN3) | IN3 del L298N | + 10 kΩ a GND |
| `13` (IN4) | IN4 del L298N | + 10 kΩ a GND |
| `18` / `19` | Encoder izquierdo A / B | `INPUT_PULLUP` interno |
| `16` / `17` | Encoder derecho A / B | `INPUT_PULLUP` interno |
| `36` (VP) | TCRT5000 más a la izquierda (AO) | ADC1 · solo entrada |
| `39` (VN) | TCRT5000 2.º desde la izquierda (AO) | ADC1 · solo entrada |
| `34` | TCRT5000 3.º desde la izquierda (AO) | ADC1 · solo entrada |
| `35` | TCRT5000 más a la derecha (AO) | ADC1 · solo entrada |
| `32` | Divisor batería (100 kΩ / 22 kΩ) | 12,6 V → 2,27 V |
| `0` (BOOT) | Pulsador a GND | Alarma de prueba |
| `21` / `22` | *(reservado)* SDA / SCL de la MPU6050 | No conectar todavía |
| `2` | *(reservado)* INT de la MPU6050 | No conectar todavía |

---

## 3. Antes de energizar (60 segundos)

- [ ] Ningún cable suelto ni pelado; revisar continuidad del GND común
- [ ] Ningún `AO` de sensor conectado a más de 3,3 V
- [ ] Las 4 pull-down de 10 kΩ puestas y soldadas/firmes
- [ ] Batería medida (≥ 9,9 V; ideal 12,0 V) y conector sin inversión de polaridad
- [ ] Robot sobre un taco de madera: **las ruedas al aire** para la primera prueba
- [ ] Monitor serie abierto **antes** de conectar la batería

**Primera energización (con ruedas al aire):**
```powershell
arduino-cli monitor -p COM5 -c baudrate=115200 --timestamp
```
- [ ] Sale `Robot integrado listo.` en menos de 2 s
- [ ] Las ruedas **no se mueven** durante los primeros 1,5 s
- [ ] Sale `Wi-Fi listo, IP ...` o `Wi-Fi: reintentando...` (ambos son normales)

---

## 4. Herramientas y materiales para llevar

| Item | Cantidad | Para qué |
|---|---|---|
| Multímetro con puntas | 1 | Tensión de sensores, batería, continuidad |
| Resistencias 10 kΩ (¼ W) | 4 (+4 de repuesto) | Pull-down de IN1-IN4 |
| Resistencias 10 kΩ + 20 kΩ | 2 + 2 | Divisor de emergencia para un `AO` a 5 V |
| Cables dupont macho-hembra | 20 | Sensores y señales |
| Cables dupont macho-macho | 10 | Puentes y GND común |
| Cable USB-C **de datos** | 1 | No sirve uno de solo carga |
| Destornillador plano/estrella pequeño | 1 | Borneras del L298N y soportes |
| Cinta negra de 19 mm | 1 rollo | Pista de prueba y arreglos |
| Tijeras o cutter | 1 | Cortar cinta |
| Cinta aislante | 1 | Aislar uniones y el disipador |
| Bridas / velcro | 4 | Sujetar cables y batería |
| Batería 3S + cargador | 1 + 1 | Autonomía de la sesión |
| Protoboard | 1 | Solo para el GND común y las pull-down |
| Laptop + cargador | 1 | Arduino IDE, MQTTX, arduino-cli |
| Celular con hotspot 2,4 GHz | 1 | Plan B de red |

---

## 5. Plan B si algo falla

| Síntoma | Causa probable | Acción inmediata |
|---|---|---|
| Los sensores no leen y el ADC da 0 | falta GND común o VCC en 5 V | revisar GND y alimentar a 3,3 V |
| Las ruedas giran al revés | cables de motor invertidos | cruzar los dos cables del motor en la bornera |
| Una rueda no gira | ENA/ENB con puente puesto | quitar el puente y medir PWM con el multímetro |
| Reinicios al encender motores | caída de tensión de la batería | cargar batería; separar la alimentación de sensores |
| `linea_mm` se dispara a ±27 mm y `PERDIDA` | sensores lejos de la cinta | bajar a 6-8 mm del piso y repetir la prueba C |

---

**Verificado por:** ____________________ · **Fecha:** ____/11/2026 · **Hora:** ______
