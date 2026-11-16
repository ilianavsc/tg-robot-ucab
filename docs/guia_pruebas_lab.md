# Guía de pruebas de laboratorio · 18 de noviembre de 2026

**Proyecto:** Robot móvil para transporte de componentes en el laboratorio con app y alertas
**Autores:** Iliana Cascitelli · Andrea _[apellido]_
**Firmware bajo prueba:** `firmware/robot_integrado.ino` — 35.614 bytes · 71 % flash · 15 % RAM
**Hardware:** ESP32 DevKit 30 pines (CP2102) · L298N · 4× TCRT5000 · 2 encoders · batería 3S
**Duración prevista:** 3 h 20 min → A: 40 min · B: 50 min · C: 70 min · margen: 40 min
**Versiones:** core `esp32:esp32` 3.3.12 · librería `MQTT` 2.5.3 · `arduino-cli` 1.6.0

> Regla de la sesión: **el firmware no se toca durante las pruebas**, salvo las 3 constantes del
> bloque C (líneas 140-142). Todo cambio se anota en `docs/bitacora/`.

---

## 0. Checklist previo (10 min, antes de energizar)

- [ ] `firmware/secrets.h` tiene el SSID y la clave de la red (líneas 17 y 18)
- [ ] Batería 3S cargada: **≥ 12,0 V** medidas con multímetro
- [ ] Laptop con `arduino-cli` 1.6.0 en el PATH (`arduino-cli version` responde)
- [ ] MQTTX instalado y conectado a `broker.hivemq.com:1883`
- [ ] Pista armada: cinta negra 19 mm sobre piso claro, 2 m rectos + 1 curva
- [ ] Plan B de red: hotspot 2,4 GHz del celular (la red UCAB es WPA2-Enterprise y **no** funciona con este firmware)

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
1. [ ] Energizar el robot. No debe moverse durante los primeros **1,5 s** (espera de arranque).
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
9. [ ] Dejar el robot quieto 6 s: debe imprimir `Manual sin ordenes por 5 s: vuelvo a AUTONOMO (seguridad)`.

### A.3 · Pruebas de caída (importante para la seguridad)
10. [ ] En modo MANUAL y con `adelante`, alejar el celular/router hasta que caiga el Wi-Fi.
    - [ ] El robot **se detiene de inmediato** (no sigue a ciegas).
    - [ ] El monitor muestra `Wi-Fi caido` y `PARO POR RED: motores detenidos hasta nueva orden`.
    - [ ] Al volver la red, reconecta solo y **no** se mueve hasta recibir una orden.
11. [ ] En modo AUTÓNOMO sobre la línea, repetir la caída de red.
    - [ ] El robot **sigue siguiendo la línea** con el PD.

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

## Bloque C · Calibración del PD (70 min)

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
| Pruebas A y B | Andrea _[apellido]_ | | |
| Pruebas C y firmware | Iliana Cascitelli | | |

- [ ] Batería desconectada y robot guardado
- [ ] Resultados copiados a `docs/bitacora/semana-___.md`
- [ ] Constantes finales del bloque C registradas en el commit correspondiente
