# Tópicos MQTT

Prefijo común: `ucab-tg-sf/robot/`

Fuente de verdad del contrato: `firmware/robot_integrado.ino`. El ESP32 virtual
(`prototipos/P10-simulador-esp32/`) y la App Flutter (`app/lib/core/mqtt/mqtt_service.dart`)
usan exactamente estos nombres de campo.

| Tópico | Quién lo envía | QoS | Retenido | Para qué |
|---|---|---|---|---|
| `ucab-tg-sf/robot/estado` | Robot → app | 0 | No | Batería, modo, línea, velocidades y motivo de parada (cada 2 s) |
| `ucab-tg-sf/robot/ultrasonido` | Robot → app | 0 | No | Distancias de los 2× HC-SR04P y validez de cada sensor (cada 0,5 s) |
| `ucab-tg-sf/robot/ordenes` | App → robot | 1 | No | Órdenes de movimiento y pedidos de componentes |
| `ucab-tg-sf/robot/ordenes/ack` | Robot → app | 1 | No | Confirmación de cada orden recibida |
| `ucab-tg-sf/robot/alertas` | Robot → app | 2 | No | Obstáculo, fallo de sensor, batería, timeout manual, antirrobo |
| `ucab-tg-sf/robot/conexion` | Robot (y broker por LWT) | 1 | Sí | `"en linea"` o `"desconectado"` |

## `estado` (robot → app, QoS 0, cada 2 s)

```json
{"n":42,"estado":"autonomo","bateria":87,"bateria_v":11.94,"ordenes":3,
 "linea_mm":-2.1,"v_izq":0.41,"v_der":0.41,"parada":"ninguna","t":118340}
```

| Campo | Tipo | Significado |
|---|---|---|
| `n` | entero | Contador de mensajes de estado |
| `estado` | texto | `autonomo` o `manual` |
| `bateria` | entero | % entre 9,90 V (0 %) y 12,60 V (100 %), Li-Ion 3S |
| `bateria_v` | decimal | Tensión medida (V). `0.00` = sin batería medida (reposo / USB): no es alarma |
| `ordenes` | entero | Órdenes recibidas desde el arranque |
| `linea_mm` | decimal | Error de línea (+ = línea a la izquierda). 4× TCRT5000 en `[27, 9, -9, -27] mm`; `±32.4` = línea perdida |
| `v_izq`, `v_der` | decimal | Velocidad de cada rueda (m/s, con signo) |
| `parada` | texto | Motivo de los motores en 0: `ninguna`, `obstaculo_frente`, `obstaculo_atras`, `fallo_sensor_frente`, `fallo_sensor_atras`, `timeout`, `red`, `arranque` |
| `t` | entero | `millis()` del robot |

El P10 añade además `sensores` (`[0,1,1,0]`, lectura binaria de los 4 TCRT5000) para pintar la regleta.

## `ultrasonido` (robot → app, QoS 0, cada 0,5 s)

```json
{"frente_cm":84.0,"atras_cm":151.5,"frente_ok":true,"atras_ok":true,"t":29452}
```

| Campo | Tipo | Significado |
|---|---|---|
| `frente_cm` | decimal | Distancia del HC-SR04P delantero (cm, 2–400). `0.0` = nada en rango **o** sin eco |
| `atras_cm` | decimal | Igual, sensor trasero |
| `frente_ok` | booleano | `false` = sensor delantero en **fallo**: 5 disparos seguidos sin ningún pulso de eco (500 ms). Vuelve a `true` con 3 ecos válidos |
| `atras_ok` | booleano | Igual, sensor trasero |
| `t` | entero | `millis()` del robot |

Cómo leer un `0.0`: con `*_ok = true` el módulo respondió con el pulso de timeout
(~38 ms, nada en 4 m) → **despejado**. Con `*_ok = false` no hubo respuesta → **no se
asume camino libre**.

Umbrales (RF-05): `< 20 cm` parada, `20–50 cm` aviso, `> 50 cm` despejado.

## `ordenes` (app → robot, QoS 1)

```json
{"id":"0d1c…","cmd":"adelante"}
{"id":"P-0002","cmd":"izquierda","vel":0.6}
{"id":"P-0001","componente":"Resistencia 1k","cantidad":5,"estante":"A3"}
```

- Con `cmd` (`adelante`, `atras`, `izquierda`, `derecha`, `frenar`, `auto`) es una orden
  de movimiento: pasa a MANUAL (o a AUTÓNOMO con `auto`). `vel` (0–1) es opcional.
- Sin `cmd` es un pedido de componente: solo se confirma.
- **Fail-safe:** en MANUAL, 5 s sin órdenes → el robot frena y **se queda en MANUAL**
  (`parada:"timeout"`). Nunca vuelve solo a AUTÓNOMO; lo libera la siguiente orden.

## `ordenes/ack` (robot → app, QoS 1)

```json
{"id":"0d1c…","recibidas":3,"t":29452}
```

## `alertas` (robot → app, QoS 2)

```json
{"n":7,"tipo":"obstaculo","prueba":false,"valor":14.2,"t":118340}
```

| `tipo` | Cuándo | `valor` |
|---|---|---|
| `obstaculo` | Frente < 20 cm (una vez por episodio) | cm |
| `obstaculo_atras` | Se pidió retroceder con atrás < 20 cm | cm |
| `fallo_sensor_frente` | 500 ms sin eco delantero | — |
| `fallo_sensor_atras` | 500 ms sin eco trasero | — |
| `bateria_critica` | Batería ≤ 10,30 V (aviso preventivo) | V |
| `bateria_baja` | Batería < 9,90 V (corte seguro) | V |
| `timeout_manual` | 5 s sin órdenes en MANUAL | s (5) |
| `antirrobo` / `antirrobo_imu` | Botón BOOT, tecla `t` (`prueba:true`) o IMU | — |

El firmware **frena primero** y encola la alerta; la publica desde `loop()`, fuera del
lazo de control de 100 Hz (un publish QoS 2 puede tardar hasta 1 s). Sin conexión, la
alerta espera en cola y sale al reconectar.

La App (P11) también deduce alertas de `estado` y `ultrasonido` (obstáculo, proximidad,
fallo de sensor, batería ≤ 10,3 V ignorando 0,00 V) y marca "confirmada por el robot"
cuando llega la misma alerta por este tópico.

## Por qué cada QoS
- **QoS 0 (estado, ultrasonido):** llegan periódicamente; si se pierde uno, llega el siguiente.
- **QoS 1 (órdenes y confirmaciones):** cada pedido debe llegar al menos una vez.
- **QoS 2 (alertas):** una alerta debe llegar exactamente una vez.

Probado en el prototipo P01 (ver `prototipos/P01-mqtt-base`) y en el Gemelo Digital
(P10 + App P09).
