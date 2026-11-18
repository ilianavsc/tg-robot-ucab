# Ficha técnica de sensores · P02 (Los sentidos del robot)

Fuente única de verdad para el montaje y calibración de los sensores cuando llegue
el hardware físico (pedido en Miami, entrega 15-28 dic). Valores extraídos del
firmware `firmware/robot_integrado.ino` (rama `main`).

## 1 · 4× TCRT5000 (seguidor de línea)

| Dato | Valor |
|---|---|
| Pines (ADC1, orden izq → der) | `36` (VP), `39` (VN), `34`, `35` |
| Alimentación | **3,3 V** (nunca 5 V: quemaría el ADC, los GPIO 34-39 son solo entrada) |
| Separación entre sensores | `SEP_MM = 18 mm` |
| Posición respecto al centro (mm) | **`[27, 9, -9, -27]`** (positivo = izquierda) |
| Altura de montaje | **6-8 mm** sobre el piso |
| Rango ADC | 12 bits, atenuación `ADC_11db` (0-3,1 V) |

**Umbrales del firmware** (`robot_integrado.ino`):
```cpp
const float SEP_MM  = 18.0f;
const int   ADC_PISO  = 500;    // piso claro (valor supuesto, calibrar)
const int   ADC_CINTA = 3300;   // cinta negra (valor supuesto, calibrar)
const float UMBRAL    = 0.20f;  // < 20 % se cuenta como piso
const float SUMA_MIN  = 0.30f;  // suma mínima para "veo la línea"
```

**Calibración ADC (al montar):**
1. Medir `AO` de cada sensor sobre **piso claro** → anotar (ese es `ADC_PISO`).
2. Medir `AO` sobre la **cinta negra** → anotar (ese es `ADC_CINTA`).
3. Negro debe dar **más** tensión que blanco; si no, el módulo está invertido.
4. Ajustar la altura a 6-8 mm y verificar en el Monitor Serie (115200): sobre la
   cinta no debe aparecer `PERDIDA`; sobre piso claro sí.

## 2 · 2× HC-SR04P (obstáculos: adelante / atrás)

| Dato | Valor |
|---|---|
| TRIG (común a los 2) | GPIO **23** (`PIN_ULTRA_TRIG_FRENTE` = `PIN_ULTRA_TRIG_ATRAS` = 23) |
| ECHO frente | GPIO **33** |
| ECHO atrás | GPIO **5** |
| GPIO 15 | **reservado**: TRIG trasero separado (opcional, ver abajo) |
| Alimentación | **3,3 V** (HC-SR04P). El HC-SR04 de 5 V exige divisor 1k/2k en ECHO |
| Lectura | ISR por flanco (`IRAM_ATTR` + `micros()`), **alternada**: frente en ciclos pares, atrás en impares (100 ms por ciclo → cada sensor cada 200 ms) |
| Fallo de sensor | 3 lecturas propias sin ningún pulso (600 ms) → `frente_ok`/`atras_ok = false`; se recupera con 2 ecos |
| Fórmula | `cm = ancho_us / 58` (58 µs/cm ida y vuelta) · rango útil 2-400 cm · `0` = sin eco |

**Umbrales de obstáculo (RF-05 / RNF-07):**
```cpp
const float UMBRAL_PARADA_CM = 20.0f;  // < 20 cm → detener() + alerta "obstaculo"
const float UMBRAL_AVISO_CM  = 50.0f;  // 20-50 cm → zona de aviso (ámbar)
// > 50 cm → despejado (verde)
```

**Contrato MQTT:**
- `ucab-tg-sf/robot/ultrasonido` (QoS 0, cada 0,5 s): `{"frente_cm":X,"atras_cm":Y,"frente_ok":true,"atras_ok":true,"t":<millis>}`

**TRIG común vs. separado:** con el TRIG común, los dos módulos emiten en cada disparo;
la alternancia solo hace que se escuche uno por ciclo. Si en la prueba física aparecen
lecturas cortas falsas (eco cruzado), cablear el TRIG del trasero a **GPIO 15** y cambiar
en el firmware `PIN_ULTRA_TRIG_ATRAS = 15`. Registrar el resultado en
[`prototipos/P02-sensores/README.md`](../prototipos/P02-sensores/README.md).
- `ucab-tg-sf/robot/estado` (QoS 0, cada 2 s): incluye `linea_mm` (posición de la línea)

## 3 · Reglas de seguridad eléctrica

1. GND común entre ESP32, sensores y puente H.
2. TCRT5000 y HC-SR04P **siempre a 3,3 V**; el `AO`/`ECHO` nunca a más de 3,3 V.
3. Pull-down de 10 kΩ en IN1-IN4 del L298N (evita el tirón al arrancar).
4. GPIO 5 y 15 son pines de arranque: como ECHO leen LOW en reposo (sin riesgo),
   pero no conectarlos a nada que los fuerce HIGH durante el boot.
