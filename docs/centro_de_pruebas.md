# Centro de pruebas · flujo de la prueba física

**Objetivo:** comprobar con un ESP32 real lo mismo que ya funciona en el simulador P10: la app envía una orden, el robot la recibe y confirma con un ACK.

**Qué se prueba:** `firmware/robot_integrado.ino` + App Flutter (P09).
**Qué NO se prueba aún:** motores, sensores y batería (el pedido llega a Miami el 15-28 dic). El ESP32 va solo, por USB.

---

## Estado del firmware antes de la prueba

- **Firmware C++ validado (13/13 tests).** Son pruebas en el PC de la lógica de órdenes y ACK, con un MQTT falso. No sustituyen la prueba en el ESP32 real: para eso es este documento.
- El ACK sale idéntico al del simulador P10:
  `{"id":"<uuid>","recibidas":N,"t":millis}`
- Si no hay red, el ACK **no se pierde**: se reintenta al reconectar.

---

## Flujo exacto (5 pasos, unos 15 min)

### Paso 1 · Conectar el ESP32 (3 min)
1. Revisa que `firmware/secrets.h` tenga la red 2,4 GHz (hotspot del celular) y `broker.hivemq.com`, puerto 1883.
2. Conecta el ESP32 al laptop con un cable USB **de datos**.
3. Sube el firmware y abre el monitor serie a 115200 (comandos en `guia_pruebas_lab.md`).
4. Espera estas líneas: `Wi-Fi listo, IP ...` y `MQTT conectado`.

**Listo cuando:** ves `MQTT conectado` en el monitor.

### Paso 2 · Abrir la App Flutter (2 min)
1. Abre `https://ilianavsc.github.io/tg-robot-ucab/app/` en el celular o el laptop.
2. Si aparece **MODO DEMO**, pulsa **Desconectar** o **Conectar** para salir de él.
3. Pulsa **Conectar**.
4. Mira el nombre del broker: debe decir **HiveMQ**.

**Listo cuando:** la app dice `Enlace MQTT · HiveMQ` y empieza a mostrar la telemetría del ESP32 (llega cada 2 s).

> Si dice EMQX o Mosquitto, el ESP32 no la ve (usa HiveMQ). Pulsa **Desconectar** y **Conectar** otra vez.

### Paso 3 · Enviar una orden (1 min)
1. En la tarjeta de órdenes pulsa **Frenar** (es la orden segura: no mueve nada).
2. Anota la hora.

### Paso 4 · Verificar el ACK (3 min)
1. En la app, la caja "último ACK" pasa de gris a ámbar (esperando) y luego a verde: `confirmó "frenar" en N ms`.
2. En el monitor serie debe salir: `Pedido #1 (<uuid>): {"id":...,"cmd":"frenar"}`.
3. Anota en la tabla de abajo el número `N` (ms).

**Listo cuando:** la caja está en verde y el monitor muestra `Pedido #1`.

### Paso 5 · Repetir y medir la latencia (6 min)
1. Pulsa **Frenar** 10 veces, una cada 5 s.
2. Anota los 10 tiempos en la tabla.
3. Calcula la mediana y el máximo.
4. Prueba también **Auto · seguir la línea solo**: el monitor debe decir `Modo AUTONOMO` y la app, ACK en verde.

---

## Tabla de resultados

| # | Orden | ACK en la app (ms) | `Pedido #` en el monitor | ¿Verde? |
|---|---|---|---|---|
| 1 | frenar | | | |
| 2 | frenar | | | |
| 3 | frenar | | | |
| 4 | frenar | | | |
| 5 | frenar | | | |
| 6 | frenar | | | |
| 7 | frenar | | | |
| 8 | frenar | | | |
| 9 | frenar | | | |
| 10 | frenar | | | |
| **Mediana** | | | | |
| **Máximo** | | | | |

---

## Si algo no aparece

| Ubicación | Causa | Solución |
|---|---|---|
| Monitor serie, sin `MQTT conectado` | Red de 5 GHz o WPA2-Enterprise | Usar el hotspot 2,4 GHz del celular |
| App, no llega telemetría | La app usa otro broker | Desconectar y Conectar hasta ver HiveMQ |
| App, caja ámbar que no pasa a verde | El ESP32 no recibió la orden | Mirar el monitor: ¿sale `Pedido #`? Si no sale, revisar el broker |
| App, dice MODO DEMO | El ACK es simulado (300 ms) | Salir del Modo Demo y pulsar Conectar |
| Monitor, `Wi-Fi caido` | Se cayó la red | Esperar: reconecta solo y reenvía los ACK pendientes |

---

## Para el jurado

Mismo flujo, sin hardware: abrir `prototipos/centro-pruebas.html` (P10 → P01 → P09). La prueba física de este documento es la versión con el ESP32 real.
