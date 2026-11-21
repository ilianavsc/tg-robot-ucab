# Simulador 2 V2 · teach-and-repeat sobre las 2 pistas de SIM1

Gemelo digital de **movimiento** (SIL). Se abre por http (no por `file://`): carga `specs/navegacion/teach_and_repeat.js`, `specs/pista_canonica.json` y las pistas de SIM1 (`../P08-seguidor-linea/avance-01-simulador-3d/codigo/pista.js`) sin copiarlos.

## Flujo
1. **Pista 1 o 2** (las dos de SIM1): A = circuito histórico de 8,05 m · B = recorrido canónico de 9,0 m (tramos T1–T4 y puntos de control de la especificación).
2. **Enseñar (Teach):** pone toda la cinta y el robot recorre la pista siguiendo la línea; el giroscopio anota su rumbo (suavizado) celda a celda.
3. **Retirar cinta:** solo tramos **rectos** que la pasada recorrió (T2 de la pista B). La pista A no tiene ningún recto de 1,5 m: se enseña y se repite con cinta completa.
4. **Repetir (Repeat):** el núcleo cruza el hueco con `HEADING_HOLD` usando el rumbo enseñado y la baliza valida la llegada.

## Estado del gemelo digital
```json
{"pista":"B","x":0.305,"y":-0.270,"angulo":0.0,"velocidad_ms":0.46,"frente_cm":160,"atras_cm":160,"alerta":"ninguna","s_m":0.0}
```
- `x`, `y`: metros del mundo de SIM1 (`y` = Z de SIM1). `angulo`: grados, 0 = +x, antihorario, −180…180. `s_m`: metros sobre la pista; el mapa de la app usa `s_m / largo_m`.
- `alerta`: `ninguna | obstaculo | obstaculo_atras | timeout_sin_linea | deriva_excesiva`.
- Solo `estado` y `ultrasonido` existen en el firmware real (`gemelo_estado.js → aContratoApp`); la posición es solo del gemelo. La app (`app/`) no se tocó: sus estaciones (3,78 / 6,3 m) todavía no coinciden con las de la especificación (3,0 / 4,5 / 7,5 / 9,0 m).

## Radar (de P13)
Ficha roja arrastrable sobre la pista (o Enter sobre la ficha: 90 cm delante; Supr la retira). Cada HC-SR04P tiene un cono de ±15° con zonas crítica (< 20 cm) y precaución (20–50 cm), ondas y eco. Limitador de planta: rampa de 0,55 m/s² al frenar; parada completa a < 20 cm; la simulación nunca se pausa. Velocímetro de 0,00 a 0,46 m/s. La ranura de alertas tiene altura fija (delta = 0 px).

## Supuestos (SIL, [PENDIENTE DE MEDICIÓN FÍSICA])
- Física de SIM1: PWM 1,0 = 0,572 m/s (0,8 = 0,457 m/s), ruedas de 0,18 s, 0,18 m entre ruedas, TCRT5000 a 6 cm del eje.
- En un circuito cerrado las balizas B1 y B2 coinciden: el RSSI se calcula por **distancia recorrida** (no euclidiana) y la detección es a 0,40 m, porque en `WAIT_BEACON` el núcleo avanza sin seguir la línea y el último tramo de la pista B solo es recto 0,45 m.
- El núcleo solo trae el término **P** de la corrección de línea; el firmware real y SIM1 usan PD. Con las ruedas de 0,18 s el P solo no sostiene las curvas de 22–27 cm, así que la planta añade el **D del firmware** (`KD_LINEA_FW = 0,0015`). Pendiente: llevar el D al núcleo (`specs/`, fuera de este cambio).
- El hueco de 1,5 m de T2 se cruza en ≈ 3,8 s de los 4 s de seguridad (margen ≈ 0,2 s con la velocidad real). El límite de 4 s no se toca.
- La MPU-6050 y el escaneo BLE están **[PENDIENTE DE INTEGRACIÓN EN FIRMWARE]**.

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html` | Interfaz (6 paneles `<details>` cerrados por defecto) |
| `simulador_movimiento.js` | Planta: Frenet con curvatura, sensores, enseñanza, limitador, obstáculos del mundo |
| `pistas_sim1.js` | Adaptador de las pistas de SIM1 (κ(s), pose, rectitud) |
| `radar_us.js` | Lógica del radar de P13 (cono, rampa, velocímetro) |
| `gemelo_estado.js` | Estado del gemelo y puente con la app |
| `simulador_movimiento.test.js`, `pistas_radar.test.js` | 38 pruebas en Node (CI): `node prototipos/simulador-2-v2-teach-and-repeat/simulador_movimiento.test.js` |
