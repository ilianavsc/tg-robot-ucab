# Navegación teach-and-repeat · núcleo portable + test harness

- Fuente única de verdad de la pista: [`../pista_canonica.json`](../pista_canonica.json)
- Núcleo determinista puro: [`teach_and_repeat.js`](teach_and_repeat.js)
- Harness automatizado: [`teach_and_repeat.test.js`](teach_and_repeat.test.js)

El núcleo implementa la **repetición** de una ruta **enseñada** (teach-and-repeat):
la fase de enseñanza graba tramos, rumbos y balizas; la de repetición los ejecuta
sin UI ni hardware específico. No usa "IA".

## Estados (exactamente 5)

| # | Estado | Qué hace |
|---|---|---|
| 1 | `FOLLOW_LINE` | Sigue la cinta con corrección PD sobre los 4 TCRT5000 |
| 2 | `LINE_LOST_CHECK` | Buffer de 500 ms para distinguir un hueco real de un fallo de lectura |
| 3 | `HEADING_HOLD` | Mantiene rumbo por giroscopio en tramos sin cinta |
| 4 | `WAIT_BEACON` | Valida llegada al extremo por RSSI BLE |
| 5 | `REACQUIRE_LINE` | Reengancha la cinta tras el tramo sin cinta |

## Transiciones relevantes en `HEADING_HOLD`

Orden de evaluación en cada paso (la seguridad manda primero):

1. Deriva de rumbo `> 30°` → **parada de seguridad** (latch, `deriva_excesiva`).
2. RSSI `>= -80 dBm` **y** ya se salió del inicio → **`WAIT_BEACON` directo**, sin pasar por
   `REACQUIRE_LINE` (el hueco de cinta termina en el extremo y lo valida la baliza). Junto a la
   baliza de salida (inicio) no se activa.
3. La línea reaparece → `REACQUIRE_LINE` → `FOLLOW_LINE`.
4. `4000 ms` sin línea en total → **parada de seguridad** (latch, `timeout_sin_linea`).

### Límite de 4 s: NO se amplía

`tiempoMaxSinLineaMs = 4000` es el **límite de seguridad ante la deriva del MPU-6050**: sin cinta el
rumbo solo lo sostiene el giroscopio y su error crece con el tiempo. A la velocidad base, un hueco
de cinta de más de ~4,5 m (incluye los 500 ms de `LINE_LOST_CHECK`) **no se cruza**: termina en
`timeout_sin_linea`. La única forma de terminar un hueco largo antes del timeout es que lo cierre
una baliza de extremo (punto 2). Ver también `specs/pista_canonica.json` → `notas`.

## Fail-safe frontal (cruza todos los estados)

- `frente < 20 cm` → **parada crítica** (velocidad 0, estado intacto; se reanuda al despejar).
- `20–50 cm` → **precaución** (velocidad a la mitad).

## Balizas BLE

Exactamente **2**, una en cada extremo. La llegada se valida solo en el extremo
final: detección a `RSSI >= -80 dBm`, llegada a `RSSI >= -52 dBm`. En el inicio
(RSSI alto) el robot **no** se da por llegado.

## Ejecutar el harness

```bash
node specs/navegacion/teach_and_repeat.test.js
```

Salida esperada: `13/13 pruebas en verde (100%)`.

Cubre (13 casos): recorrido nominal con línea, tramo sin cinta (`HEADING_HOLD` → `REACQUIRE_LINE`),
rampa de beacon (`-80 → -52`), pérdida prolongada (timeout), deriva excesiva del
giroscopio, obstáculo `< 20 cm` interrumpiendo `FOLLOW_LINE` y `HEADING_HOLD`,
precaución `20–50 cm`, consistencia de umbrales contra `pista_canonica.json`, la transición directa `HEADING_HOLD` → `WAIT_BEACON` (y que no se activa junto a la baliza de salida ni por encima de la deriva excesiva) y que el timeout de 4 s sigue intacto.

## Portabilidad 1:1 a C++ (ESP32)

El módulo JS está escrito en un dialecto portable: enum numérico, struct plano y
funciones libres, sin closures ni clases. El mapeo directo:

```cpp
enum Estado {
  FOLLOW_LINE, LINE_LOST_CHECK, HEADING_HOLD, WAIT_BEACON, REACQUIRE_LINE
};

struct Nav {
  Estado estado;
  uint32_t perdidaMs;
  float rumboObjetivo;
  bool haSalidoDeInicio;
  bool paradaSeguridad;
  bool llegada;
};

struct Entradas {
  float n[4];      // TCRT5000 normalizados 0..1
  float yaw;       // grados (MPU-6050)
  int   rssi;      // dBm (BLE)
  float frenteCm;  // 0 = sin eco
  uint32_t dtMs;
  bool tramoSinCinta;
  float rumboTramo;
};

struct Salida {
  Estado estado;
  float vIzq, vDer;
  bool frenadoCritico, precaucion, paradaSeguridad, llegada;
  const char* evento;
};

Salida paso(Nav& nav, const Entradas& e);
```

Cada función JS (`clamp`, `anguloNormalizado`, `posicionLinea`, `paso`) tiene su
equivalente C++ con la misma firma. El harness valida la lógica; el puerto C++ se
copia siguiendo este mapeo y se integra al `controlar()` del firmware.
