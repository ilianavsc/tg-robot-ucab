# P02 · Los sentidos del robot — Registro de mediciones físicas (HIL)

> **Estado:** plantilla vacía, lista para diciembre (llegada del hardware: 15–28 dic 2026).
> **Ficha técnica (pines, umbrales, calibración):** [`docs/sensores.md`](../../docs/sensores.md)
> **Firmware bajo prueba:** [`firmware/robot_integrado.ino`](../../firmware/robot_integrado.ino)
> **Contrato MQTT:** [`docs/arquitectura/topicos-mqtt.md`](../../docs/arquitectura/topicos-mqtt.md)

## SIL vs. HIL

| Nivel | Qué es | Dónde está | Estado |
|---|---|---|---|
| **SIL** (*Software In the Loop*) | La lógica del firmware se ejecuta sin hardware: compilada en el PC con imitaciones del core ESP32, o emulada en el navegador | `firmware/pruebas_pc/` (58/58), P10 "Inyección de Eventos Virtuales (SIL)", Modo Demo de la App | Hecho (corre en GitHub Actions) |
| **HIL** (*Hardware In the Loop*) | El mismo firmware en el **ESP32 real** con los **sensores reales**, observado desde la App | **Este archivo** | Pendiente (diciembre) |

Regla: un resultado solo pasa de "validado en simulación" a "validado" cuando tiene su
fila HIL llena aquí, con fecha, condiciones y evidencia (foto, video o captura del
Monitor Serie / App).

## Datos de la sesión

| Campo | Valor |
|---|---|
| Fecha | |
| Responsable(s) | |
| Lugar (pasillo / laboratorio) | |
| Commit del firmware (`git rev-parse --short HEAD`) | |
| Core ESP32 (Arduino IDE) | |
| Uso de flash / RAM al compilar | |
| Tensión de batería al inicio (V, multímetro) | |
| Tipo de piso / iluminación | |

## 1 · 4× TCRT5000 (línea) — calibración ADC

Posición respecto al centro: `[27, 9, -9, -27] mm` · altura 6–8 mm · ADC1 12 bits.

| Sensor | GPIO | Altura (mm) | ADC piso claro | ADC cinta negra | Contraste (negro − claro) | ¿OK? |
|---|---|---|---|---|---|---|
| S1 (+27 mm) | 36 | | | | | |
| S2 (+9 mm) | 39 | | | | | |
| S3 (−9 mm) | 34 | | | | | |
| S4 (−27 mm) | 35 | | | | | |

Valores elegidos para el firmware: `ADC_PISO = ____` · `ADC_CINTA = ____` (hoy 500 / 3300, supuestos).

## 2 · 2× HC-SR04P (obstáculos) — exactitud

Mismo objeto plano (caja de cartón) perpendicular al sensor. 5 lecturas por distancia
(Monitor Serie o tópico `ultrasonido`). Error = promedio medido − cinta métrica.

| Distancia real (cm) | Frente: 5 lecturas (cm) | Frente: promedio / error | Atrás: 5 lecturas (cm) | Atrás: promedio / error |
|---|---|---|---|---|
| 10 | | | | |
| 20 (umbral de parada) | | | | |
| 30 | | | | |
| 50 (umbral de aviso) | | | | |
| 100 | | | | |
| 200 | | | | |
| Sin objeto (> 4 m) | `frente_ok` = | `frente_cm` = | `atras_ok` = | `atras_cm` = |

- [ ] Sin objeto en rango, ¿el módulo da `*_ok = true` con `0.0` (pulso de timeout)? Si da `false`, el clon no entrega pulso: ajustar `FALLO_ECO_MAX` (ver `firmware/pruebas_pc/README.md`).
- [ ] Con el TRIG separado (frente GPIO 23, atrás GPIO 15), ¿aparecen lecturas cortas falsas en un sensor cuando el otro apunta a una pared (eco cruzado ambiental)? Resultado:

## 3 · Reacciones de seguridad (repetir ≥ 20 veces cada una, RNF-08)

| # | Prueba | Esperado (firmware) | Repeticiones OK / total | Medida | Evidencia |
|---|---|---|---|---|---|
| H1 | Obstáculo frontal acercándose a 0,4–0,5 m/s | Se detiene con el frente a **< 20 cm** (RF-05); anotar la distancia final. Alerta `obstaculo` en la App | / 20 | Distancia final (cm): | |
| H2 | Latencia de parada | Desde que el objeto cruza 20 cm hasta ruedas en 0 | / 20 | ms (≈ ≤ 300 esperado): | |
| H3 | Con obstáculo frontal, orden `atras` (atrás despejado) | Retrocede | / 20 | | |
| H4 | Obstáculo delante y detrás (< 20 cm) | No se mueve en ninguna dirección, alerta `obstaculo_atras` al pedir `atras` | / 20 | | |
| H5 | Desconectar ECHO frontal con orden `adelante` | Para en ≈ 600 ms, `frente_ok:false`, alerta `fallo_sensor_frente` | / 20 | ms: | |
| H6 | Reconectar ECHO frontal | `frente_ok:true` en ≈ 400 ms, se puede avanzar con una orden | / 20 | | |
| H7 | Manual sin órdenes 5 s | Frena, se queda en MANUAL, alerta `timeout_manual`, `parada:"timeout"` | / 20 | s: | |
| H8 | Fuente regulable bajando a 9,85 V (sin motores) | `parada:"corte_bateria"`, alerta `bateria_critica` | / 20 | V de corte medido: | |
| H9 | Fuente subiendo a 10,05 V y luego a 10,40 V | Sigue bloqueado a 10,05 V; a 10,40 V se mueve solo tras una orden nueva | / 20 | V de rearme medido: | |
| H10 | Misma orden (mismo `id`) publicada 2 veces desde MQTTX | Se ejecuta 1 vez, 2 acks con el mismo `recibidas` | / 20 | | |

## 4 · Observaciones e incidencias

| Fecha | Qué pasó | Causa | Cambio aplicado (commit) |
|---|---|---|---|
| | | | |

## 5 · Conclusión para el tomo

_(Completar al cerrar las pruebas: qué requisitos quedan validados con hardware — RF-05,
RNF-07, RNF-08 — y con qué margen de error.)_
