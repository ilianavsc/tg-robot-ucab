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

Salida esperada: `9/9 pruebas en verde (100%)`.

Cubre: recorrido nominal con línea, tramo sin cinta (`HEADING_HOLD` → `REACQUIRE_LINE`),
rampa de beacon (`-80 → -52`), pérdida prolongada (timeout), deriva excesiva del
giroscopio, obstáculo `< 20 cm` interrumpiendo `FOLLOW_LINE` y `HEADING_HOLD`,
precaución `20–50 cm`, y consistencia de umbrales contra `pista_canonica.json`.

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
