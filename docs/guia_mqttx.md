# Guía MQTTX · Robot UCAB

> **Qué es:** el banco de pruebas del robot sin escribir una línea de código.
> **Para quién:** Andrea e Iliana, en laboratorio y en la defensa.
> **Qué demuestra:** el ESP32 recibe órdenes, confirma cada pedido y publica telemetría, con la
> misma lógica MQTT que usará la app móvil.
>
> Firmware: `firmware/robot_integrado.ino` (v2) · Broker: `broker.hivemq.com:1883` · MQTTX 1.11+

---

## 0 · Resumen en 60 segundos

| Quiero… | Hago esto |
|---|---|
| Ver que el robot está vivo | suscribirme a `ucab-tg-sf/robot/#` y esperar el `estado` (cada 2 s) |
| Mover el robot | publicar en `ucab-tg-sf/robot/ordenes` un JSON con `"cmd"` |
| Confirmar que me escuchó | leer el ACK en `ucab-tg-sf/robot/ordenes/ack` |
| Probar la alarma | pulsar el botón BOOT del ESP32 y leer `robot/alertas` (QoS 2) |
| Volver a autónomo | publicar `{"id":"X","cmd":"auto"}` o pulsar `o` en el monitor serie |

---

## 1 · Conectar MQTTX al broker

`+ New Connection` y llenar exactamente así:

| Campo | Valor | Nota |
|---|---|---|
| Name | `UCAB-Robot-Lab` | nombre local, no afecta al broker |
| Host | `broker.hivemq.com` | broker público de pruebas |
| Port | `1883` | TCP plano. **No** usar 8883/8884 con este firmware |
| Client ID | *(automático)* | cualquiera sirve; no repetirlo con dos ventanas |
| Username / Password | *(vacío)* | el broker público no pide credenciales |
| Clean Session | `ON` | sesión limpia en cada conexión |
| Keep Alive | `60` s | el robot usa 15 s; el valor del cliente es independiente |

Pulsar **Connect**. El indicador debe quedar en verde y aparece el mensaje retenido de
`ucab-tg-sf/robot/conexion`.

> **Seguridad:** el broker es público. Cualquiera con la URL ve los mensajes. Para la prueba final
> del trabajo de grado hay que migrar a un broker propio o con credenciales (RNF-05 del proyecto).

---

## 2 · Mapa de tópicos (fuente de verdad: el firmware)

Prefijo común: **`ucab-tg-sf/robot/`**

| Tópico | Dirección | QoS | Retenido | Payload | Frecuencia |
|---|---|---|---|---|---|
| `ucab-tg-sf/robot/estado` | robot → app | 0 | No | JSON de telemetría | cada 2 s |
| `ucab-tg-sf/robot/ordenes` | app → robot | 1 | No | JSON con `"cmd"` | bajo demanda |
| `ucab-tg-sf/robot/ordenes/ack` | robot → app | 1 | No | `{"id","recibidas","t"}` | 1 por orden |
| `ucab-tg-sf/robot/alertas` | robot → app | 2 | No | `{"n","tipo","prueba","t"}` | por evento |
| `ucab-tg-sf/robot/conexion` | robot → broker | 1 | **Sí** | `en linea` / `desconectado` (LWT) | al conectar o caer |

**Las dos vistas, para que no haya confusión:**

- **El robot publica** (yo solo escucho): `estado`, `ordenes/ack`, `alertas`, `conexion`.
- **El robot se suscribe** (yo solo publico): `ordenes`.

En MQTTX: **suscribirse** a `ucab-tg-sf/robot/#` con QoS **1** y abrir además
`ucab-tg-sf/robot/alertas` con QoS **2** (el `#` no garantiza recibir el QoS 2 en todos los brokers).

### Payload de `estado`

```json
{"n":42,"estado":"autonomo","bateria":87,"bateria_v":11.94,"ordenes":3,"linea_mm":-2.1,"v_izq":0.41,"v_der":0.52,"t":118340}
```

| Campo | Significado |
|---|---|
| `n` | número de estado (contador) |
| `estado` | `autonomo` o `manual` |
| `bateria` | porcentaje 0-100 (9,9 V = 0 % · 12,6 V = 100 %) |
| `bateria_v` | tensión medida en la batería |
| `ordenes` | cuántas órdenes ha recibido el robot |
| `linea_mm` | posición de la línea respecto al centro (+ = izquierda) |
| `v_izq` / `v_der` | velocidad de cada rueda (m/s, con signo) |
| `t` | `millis()` del robot al publicar |

### Payload de `alertas`

```json
{"n":1,"tipo":"antirrobo","prueba":true,"t":52310}
```
Tipos posibles: `antirrobo` (botón BOOT o tecla `t`), `bateria_baja`, `antirrobo_imu` (reservado).

---

## 3 · Comandos listos para copiar y pegar

Publicar siempre en **`ucab-tg-sf/robot/ordenes`** con **QoS 1**.
`vel` es opcional (0 a 1); si se omite, el robot mantiene la velocidad actual.

| # | Acción | `cmd` | Efecto |
|---|---|---|---|
| 1 | Avanzar | `adelante` | ambas ruedas hacia adelante |
| 2 | Retroceder | `atras` | ambas ruedas hacia atrás |
| 3 | Girar izquierda | `izquierda` | rueda izquierda atrás, derecha adelante |
| 4 | Girar derecha | `derecha` | rueda izquierda adelante, derecha atrás |
| 5 | Detener | `frenar` | IN1 = IN2 = LOW en ambos motores |

```json
{"id":"C-01","cmd":"adelante","vel":0.7}
```

```json
{"id":"C-02","cmd":"atras","vel":0.5}
```

```json
{"id":"C-03","cmd":"izquierda","vel":0.6}
```

```json
{"id":"C-04","cmd":"derecha","vel":0.6}
```

```json
{"id":"C-05","cmd":"frenar"}
```

> **Ojo con las palabras exactas:** el firmware compara cadenas literales. `"atras"` sin tilde y
> `"frenar"` (no `"detener"`, no `"stop"`). Cualquier `cmd` desconocido frena por seguridad.
> Los payloads deben ir **compactos**, sin espacios: el parser tolera espacios desde la v2, pero
> conviene mantener el estándar.

### Órdenes especiales

```json
{"id":"C-06","cmd":"auto"}
```
Vuelve a modo autónomo (sigue la línea con el PD).

```json
{"id":"P-0007","componente":"Resistencia 1k","cantidad":5,"estante":"A3"}
```
Pedido **sin** `cmd`: no mueve el robot, solo se confirma con ACK. Es el flujo real de la app.

---

## 4 · Prueba de humo (10 minutos)

Objetivo: demostrar de punta a punta que el ESP32 responde, y dejar evidencia para el portafolio.

| Paso | Acción | Resultado esperado | ✓ |
|---|---|---|---|
| 1 | Energizar el robot y abrir el Monitor Serie a 115200 | `Robot integrado listo.` y luego `Wi-Fi listo, IP ...` · `MQTT conectado` | ☐ |
| 2 | En MQTTX, suscribirse a `ucab-tg-sf/robot/#` (QoS 1) | llega `conexion` = `en linea` (retenido) | ☐ |
| 3 | Esperar 10 s sin tocar nada | llegan **5 mensajes** de `estado`, uno cada 2 s | ☐ |
| 4 | Publicar el payload 1 (`adelante`) | llega ACK con `"id":"C-01"` y el robot avanza | ☐ |
| 5 | Publicar el payload 5 (`frenar`) | llega ACK con `"id":"C-05"` y el robot se detiene | ☐ |
| 6 | Pulsar el botón BOOT del ESP32 | llega `alertas` con `"tipo":"antirrobo"` y `"prueba":true` | ☐ |
| 7 | Desconectar la batería 15 s y reconectar | `conexion` = `desconectado` (LWT) y luego `en linea` | ☐ |

**Criterio de aprobación:** 7 de 7. Si falla el paso 3, el problema es de red; si falla el 4 o el 5,
es de tópico o de `cmd`.

| Step | Hora | ¿Pasó? | Observación |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |
| 7 | | | |

---

## 5 · Evidencia para el portafolio

**Capturas obligatorias** (5, todas en una sola sesión para que sean coherentes):

1. MQTTX con la conexión en verde y el mensaje `conexion`.
2. La lista de mensajes con 3 o más `estado` seguidos (se ve el intervalo de 2 s).
3. El ACK recibido tras publicar `adelante`.
4. La alerta QoS 2 con su badge `QoS 2` visible.
5. El Monitor Serie con la telemetría de `[autonomo]` y `linea_mm`.

**Cómo nombrarlas** (ordenables y autodescriptivas):

```
assets/img/lab/2026-11-18_01-conexion.png
assets/img/lab/2026-11-18_02-telemetria-2s.png
assets/img/lab/2026-11-18_03-ack-C01.png
assets/img/lab/2026-11-18_04-alerta-qos2.png
assets/img/lab/2026-11-18_05-monitor-serie.png
```

**Caption para la web** (formato fijo, una línea):

> **Fig. N —** *Descripción de lo que se ve.* Prueba de humo MQTT, 18/11/2026. Broker `broker.hivemq.com`.

---

## 6 · Si algo no responde

| Síntoma | Causa | Solución |
|---|---|---|
| No llega ningún `estado` | el robot no está en MQTT | revisar `MQTT conectado` en el monitor |
| Llega `estado` pero no el ACK | se publicó en el tópico equivocado | publicar en `.../robot/ordenes`, no en `.../estado` |
| El ACK llega pero el robot no se mueve | `cmd` mal escrito o modo autónomo | usar `adelante` exacto; el ACK confirma recepción, no la ejecución |
| El robot se detiene a los 5 s en manual | fail-safe del modo manual (5 s sin órdenes) | es el comportamiento diseñado: frena y se queda en manual (`parada:"timeout"`); manda otra orden o `auto` |
| Dos ventanas MQTTX se desconectan entre sí | mismo Client ID | usar el ID automático en cada ventana |
| La alerta no aparece | suscripción sin QoS 2 | suscribirse explícitamente a `.../alertas` con QoS 2 |

---

**Última revisión:** 15/11/2026 · **Autores:** Iliana Cascitelli · Andrea Ferrer
