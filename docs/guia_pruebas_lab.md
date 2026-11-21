# Guía de pruebas de laboratorio · 18 de noviembre de 2026

**Proyecto:** Robot móvil para transporte de componentes en el laboratorio con app y alertas
**Autores:** Iliana Cascitelli · Andrea _[apellido]_
**Firmware bajo prueba:** `firmware/robot_integrado.ino` — 35.614 bytes · 71 % flash · 15 % RAM · lógica de órdenes y ACK validada en PC (13/13 tests, MQTT falso)
**Hardware del 18/11:** ESP32 DevKit 30 pines (CP2102) **solo**, alimentado por USB — sin L298N, sensores ni batería (el pedido llega a Miami 15-28 dic)
**Duración prevista:** 1 h 30 min → A: 40 min · B: 40 min · margen: 10 min (el bloque D, 20 min, se hace con el margen o en la sesión siguiente)
**Versiones:** core `esp32:esp32` 3.3.12 · librería `MQTT` 2.5.3 · `arduino-cli` 1.6.0

> ⚠️ **Alcance real del 18/11 = prueba H0.** Solo ESP32 + Wi-Fi + MQTT. El bloque B (latencia) se hace
> sin hardware móvil; el **bloque C (PD) queda pospuesto** hasta que lleguen motores, encoders y sensores.

> Regla de la sesión: **el firmware no se toca durante las pruebas**, salvo las 3 constantes del
> bloque C (líneas 140-142). Todo cambio se anota en `docs/bitacora/`.

---

## 0. Checklist previo (10 min, antes de energizar)

- [ ] `firmware/secrets.h` tiene el SSID y la clave de la red (líneas 17 y 18)
- [ ] Cable USB-C **de datos** + puerto del laptop (alimenta el ESP32)
- [ ] Laptop con `arduino-cli` 1.6.0 en el PATH (`arduino-cli version` responde)
- [ ] MQTTX instalado y conectado a `broker.hivemq.com:1883`
- [ ] App Flutter abierta en `https://ilianavsc.github.io/tg-robot-ucab/app/` (para el bloque D)
- [ ] Hotspot 2,4 GHz del celular listo (la red UCAB es WPA2-Enterprise y **no** funciona con este firmware)

---

## Comandos base (PowerShell)

```powershell
# Puerto del ESP32 (CP2102)
arduino-cli board list

# Compilar  (el junction robot_integrado apunta a la carpeta firmware/ real)
arduino-cli compile -b esp32:esp32:esp32 --build-path "$env:TEMP\build_robot" "C:\Users\ivsc\10112026\robot_integrado"

# Subir  (cambiar COM5 por el puerto real)
arduino-cli upload -b esp32:esp32:esp32 -p COM5 --build-path "$env:TEMP\build_robot" "C:\Users\ivsc\10112026\robot_integrado"

# Monitor serie  (el de esta guía)
arduino-cli monitor -p COM5 -c baudrate=115200

# Monitor serie con marca de tiempo por línea (necesario para el bloque B)
arduino-cli monitor -p COM5 -c baudrate=115200 --timestamp

# Cerrar el monitor: Ctrl + C
```

Si se usa otra laptop, ajustar la ruta del sketch; el nombre de la carpeta **debe** ser
`robot_integrado` o `arduino-cli` no compila.

---

## Bloque A · Conexión Wi-Fi y MQTT (40 min)

**Objetivo:** demostrar que el ESP32 se asocia a la red, obtiene IP y completa el handshake MQTT.

### A.1 · Wi-Fi
1. [ ] Conectar el ESP32 por USB. Debe encender su LED de alimentación; no se usa batería.
2. [ ] Abrir el monitor serie a 115200. En los primeros 15 s debe aparecer, en este orden:
   ```
   Red configurada: NOMBRE_DE_LA_RED
   Robot integrado listo.
   Wi-Fi listo, IP 192.168.X.X
   MQTT conectado
   ```
3. [ ] Anotar la IP y los segundos que tardó en aparecer `Wi-Fi listo` (cronómetro desde el reset).

### A.2 · MQTT
4. [ ] En MQTTX suscribirse a `ucab-tg-sf/robot/#` (QoS 1).
5. [ ] Verificar que llega `estado` **cada 2 s** y que `conexion` trae `en linea` (retenido).
6. [ ] Publicar en `ucab-tg-sf/robot/ordenes`:
   ```json
   {"id":"A-01", "cmd":"adelante", "vel":0.5}
   ```
   > El firmware acepta JSON con o sin espacios desde el parche de la v2.
7. [ ] Confirmar en el monitor: `Pedido #1 (A-01): ...` y `Modo MANUAL: adelante`.
8. [ ] Confirmar que llega el ACK en `ucab-tg-sf/robot/ordenes/ack` con el mismo `id`.
9. [ ] No mandar órdenes durante 6 s: debe imprimir `Manual sin ordenes por 5 s: FRENO y quedo en MANUAL (fail-safe)`, publicar la alerta `timeout_manual` y el estado con `"estado":"manual","parada":"timeout"`. El robot **no** debe pasar a autónomo.
   - [ ] Desconectar el cable ECHO del ultrasonido frontal con el robot en `adelante`: a los ≈ 0,6 s debe aparecer `FALLO ultrasonido FRENTE`, los motores en 0 y la alerta `fallo_sensor_frente`. Reconectar: vuelve a `US ok/ok`.

### A.3 · Pruebas de caída (importante para la seguridad)
10. [ ] Publicar `{"id":"A-02","cmd":"adelante"}` y luego alejar el celular/router hasta que caiga el Wi-Fi.
    - [ ] El monitor muestra `Wi-Fi caido` y `PARO POR RED: motores detenidos hasta nueva orden` (sin motores no hay movimiento, pero el latch de seguridad **sí** se activa y es observable).
    - [ ] Al volver la red, reconecta solo y **no** reaplica la orden hasta recibir una nueva.

### Fallos típicos del bloque A

| Síntoma | Causa | Solución |
|---|---|---|
| `AVISO: edita secrets.h` | credenciales del ejemplo | editar líneas 17-18 de `secrets.h` |
| `Wi-Fi: reintentando...` infinito | red de 5 GHz o WPA2-Enterprise | usar hotspot 2,4 GHz con clave normal |
| Conecta a Wi-Fi pero no a MQTT | broker caído o puerto 1883 bloqueado | probar `broker.hivemq.com` desde MQTTX en el celular |

---

## Bloque B · Medición de latencia MQTT (50 min)

**Métrica:** RTT extremo a extremo = tiempo entre pulsar *enviar* en MQTTX y ver el ACK del robot.
Incluye subida por Wi-Fi + broker público + procesamiento del robot + vuelta.

### B.1 · Procedimiento
1. [ ] Abrir `arduino-cli monitor -p COM5 -c baudrate=115200 --timestamp` en una ventana.
2. [ ] En MQTTX activar el reloj/`timestamp` del log de mensajes y suscribirse a `.../ordenes/ack`.
3. [ ] Enviar **10 veces** esta orden, separadas 5 s (no mueve el robot, es segura):
   ```json
   {"id":"B-01", "cmd":"frenar"}
   ```
4. [ ] Anotar `t_envío` y `t_ACK` de cada repetición en la tabla B.1.
5. [ ] Calcular: **mediana**, mínimo y máximo de las 10.
6. [ ] Comparar con la marca de tiempo del monitor (`Pedido #N`) para separar el retardo de la app del de la red.

### B.2 · Registro de latencia

| # | Hora | t envío (ms) | t ACK (ms) | RTT (ms) | id usado | Observaciones |
|---|---|---|---|---|---|---|
| 1 | | | | | B-01 | |
| 2 | | | | | B-02 | |
| 3 | | | | | B-03 | |
| 4 | | | | | B-04 | |
| 5 | | | | | B-05 | |
| 6 | | | | | B-06 | |
| 7 | | | | | B-07 | |
| 8 | | | | | B-08 | |
| 9 | | | | | B-09 | |
| 10 | | | | | B-10 | |
| **Mediana** | | | | | | |
| **Máximo** | | | | | | |

### B.3 · Registro de estabilidad del enlace

| Métrica | Valor | Cómo se midió |
|---|---|---|
| IP asignada | | monitor serie, tras `Wi-Fi listo` |
| Segundos hasta `MQTT conectado` | | cronómetro desde el reset |
| Mensajes `estado` recibidos en 60 s (esperado: 30) | | contador de MQTTX |
| Huecos > 3 s entre `estado` | | timestamps de MQTTX |
| Segundos de reconexión tras caída de red | | cronómetro |

---

## Bloque D · Prueba física con la App Flutter (20 min)

**Objetivo:** repetir con el ESP32 real el ciclo que ya funciona en el simulador P10: orden desde la app, recepción en el robot, ACK de vuelta. Flujo corto también en `docs/centro_de_pruebas.md`.

### D.1 · Flujo
1. [ ] **Conectar el ESP32** por USB; en el monitor deben salir `Wi-Fi listo` y `MQTT conectado`.
2. [ ] **Abrir la App** (`https://ilianavsc.github.io/tg-robot-ucab/app/`). Si dice MODO DEMO, salir de él y pulsar **Conectar**. Debe decir `Enlace MQTT · HiveMQ` (el ESP32 usa HiveMQ).
3. [ ] Comprobar que llega la telemetría cada 2 s.
4. [ ] **Enviar orden:** pulsar **Frenar** (segura, no mueve nada).
5. [ ] **Verificar ACK:** la caja de la app pasa de gris a ámbar a verde (`confirmó "frenar" en N ms`) y el monitor muestra `Pedido #1 (<uuid>): ...`.
6. [ ] **Latencia:** repetir 10 veces, una cada 5 s, y llenar la tabla D.2.
7. [ ] Pulsar **Auto · seguir la línea solo**: monitor con `Modo AUTONOMO` y ACK verde.

### D.2 · Registro de latencia (app → ESP32 → app)

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

> Esta medida viene de la app, no de MQTTX: incluye el WebSocket del navegador hacia HiveMQ. Para el RNF-04 anotar mediana y máximo.

### Fallos típicos del bloque D

| Síntoma | Causa | Solución |
|---|---|---|
| La app dice EMQX o Mosquitto | HiveMQ falló y la app usó el respaldo | **Desconectar** y **Conectar** hasta ver HiveMQ |
| Caja ámbar que no pasa a verde | El ESP32 no recibió la orden | Mirar el monitor: si no sale `Pedido #`, revisar el broker |
| ACK verde con ~300 ms exactos | Es el Modo Demo (ACK simulado) | Salir del Modo Demo |
| Tras una caída de red no llega el ACK | Se reenvía al reconectar | Esperar `MQTT conectado`; el ACK pendiente sale solo |

---

## Bloque C · Calibración del PD (POSPUESTO — no aplica el 18/11)

> ⏸️ **No se ejecuta hoy.** Requiere motores, encoders y los 4 TCRT5000, que llegan al casillero de
> Miami entre el **15 y el 28 de diciembre**. Se deja redactado para cuando llegue el hardware.

**Objetivo:** encontrar `PD_BASE` y `PD_KP` con los que el robot recorra 2 m de recta sin zigzag
y tome la curva sin perder la línea.

**Criterio de aceptación:** `|linea_mm| < 9 mm` en recta · sin pérdida de línea en la curva ·
sin oscilación sostenida del PWM (variación < 0,15 entre picos).

### C.1 · Punto de partida
Valores actuales del firmware (líneas 140-142, **no cambiar KD**):

```cpp
const float PD_BASE = 0.80f;    // velocidad base (0 a 1)
const float PD_KP   = 0.030f;   // PWM por cada mm de error
const float PD_KD   = 0.0015f;  // PWM por cada mm/s de cambio del error
```

1. [ ] Colocar el robot sobre la línea, en modo AUTÓNOMO (tecla `o` o `{"cmd":"auto"}`).
2. [ ] Hacer 3 pasadas y anotar en la tabla C.1 como **referencia**.
3. [ ] Leer en el monitor la telemetría de 1 s:
   `[autonomo] linea   -3.2 mm | P -0.10 D  0.02 | PWM izq  0.90 der  0.70 | izq 0.41 m/s der 0.52 m/s | bat 11.9 V`

### C.2 · Ajuste de KP
4. [ ] Bajar `PD_KP` a `0.015` y subir de `0.005` en `0.005` hasta que el robot **zigzaguee**.
5. [ ] Elegir el KP **inmediatamente anterior** al zigzag. Si duda, el menor de los dos.
6. [ ] Cada cambio: editar la línea 141 → compilar (≈ 40 s) → subir (≈ 20 s) → 3 pasadas.

### C.3 · Ajuste de PD_BASE
7. [ ] Con el KP elegido, probar `PD_BASE` = `0.60` · `0.70` · `0.80` · `0.90`.
8. [ ] Elegir el mayor que no pierda la línea en la curva ni haga zigzag en la recta.
9. [ ] Anotar tiempos de recorrido: útil para la memoria del trabajo de grado.

> **Aviso técnico:** con `PD_BASE = 0.80` y `PD_KP = 0.030`, a error máximo (> 27 mm) la rueda
> interior puede llegar a PWM negativo (girar al revés). Si se observa ese tirón, bajar `PD_BASE`
> o recortar la salida a `[0, 1]` **después** de la prueba, no durante.

### C.4 · Registro de calibración

| Pasada | PD_BASE | PD_KP | PD_KD | linea_mm máx (mm) | PWM izq | PWM der | ¿Zigzag? | ¿Perdió línea? | Tiempo 2 m (s) |
|---|---|---|---|---|---|---|---|---|---|
| Ref 1 | 0.80 | 0.030 | 0.0015 | | | | | | |
| Ref 2 | 0.80 | 0.030 | 0.0015 | | | | | | |
| Ref 3 | 0.80 | 0.030 | 0.0015 | | | | | | |
| KP 1 | 0.80 | 0.015 | 0.0015 | | | | | | |
| KP 2 | 0.80 | 0.020 | 0.0015 | | | | | | |
| KP 3 | 0.80 | 0.025 | 0.0015 | | | | | | |
| KP 4 | 0.80 | 0.030 | 0.0015 | | | | | | |
| KP 5 | 0.80 | 0.035 | 0.0015 | | | | | | |
| BASE 1 | 0.60 | | 0.0015 | | | | | | |
| BASE 2 | 0.70 | | 0.0015 | | | | | | |
| BASE 3 | 0.80 | | 0.0015 | | | | | | |
| BASE 4 | 0.90 | | 0.0015 | | | | | | |

**Valor final elegido:** `PD_BASE = ______` · `PD_KP = ______` · `PD_KD = ______`

---

## Registro de incidencias

| Hora | Bloque | Qué pasó | Qué se hizo | ¿Se resolvió? |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

---

## Cierre de la sesión

| | Nombre | Firma | Hora |
|---|---|---|---|
| Pruebas A, B y D | Andrea _[apellido]_ | | |
| Pruebas C y firmware | Iliana Cascitelli | | |

- [ ] ESP32 desconectado del USB y guardado
- [ ] Resultados copiados a `docs/bitacora/semana-___.md`
- [ ] Bloque C queda agendado para cuando llegue el hardware (15-28 dic)
