# P08 Seguir la línea · Avance 1: simulador 3D

**Fase:** I (adelanto de P08, planificado para la semana 13)
**Fecha:** 14 nov 2026

👉 **Versión visual:** [index.html](index.html) · **Simulador:** [simulador.html](simulador.html)

## En una frase
Cuatro sensores miran el piso; el ESP32 calcula dónde quedó la cinta negra y acelera una rueda y frena la otra para volver a ella.

## La comparación
Como manejar mirando las líneas del canal: si el carro se va a un lado, giras el volante hacia el otro, y lo enderezas antes de pasarte.

## 1. Objetivo
Probar en simulación el control PD del seguidor de línea con el motor que se compró (JGA25-371 Speed 200), el driver L298N y 4 sensores TCRT5000, antes de tener el hardware.

## 2. Requisito que valida
- RF-04: ir por la línea del mostrador al estante y volver (en simulación, sobre una pista provisional).
- RNF-03: velocidad entre 0,35 y 0,6 m/s.

## 3. Simulador y enlace
- Simulador 3D en el navegador (three.js y el kit [teardown](https://github.com/elvarofficial/teardown), MIT). Copia del [simulador de la tracción de P03](../../P03-motores/avance-02-simulador-3d/), que no se modificó.
- El plan original decía Webots. Se usó el simulador web para reutilizar el robot y el modelo del motor de P03.

## 4. Cómo se prueba
- En la página: ARRANCAR, cambiar base, Kp, Kd, separación de sensores, distancia al eje y batería, y mirar la gráfica y los resultados.
- Sin pantalla: `G=1 node codigo/pruebas.mjs KP KD BASE SEP_MM ADELANTE_MM VOLTIOS SEGUNDOS`.

## 5. Criterio de éxito
Completar vueltas sin salirse de la pista, con velocidad promedio dentro de 0,35 a 0,6 m/s, con la batería llena, nominal y baja.

## 6. Resultado
Pista provisional de 8,05 m, curva más cerrada de 22 cm de radio. Valores iniciales: base 80 %, Kp 0,030 por mm, Kd 0,0015 s por mm, sensores a 18 mm entre sí y a 60 mm del eje.

| Prueba | Vuelta | Velocidad | Más lejos de la línea | Resultado |
|---|---|---|---|---|
| Valores iniciales, 11,1 V | 19,7 s | 0,41 m/s | 17 mm | Da la vuelta |
| Batería llena, 12,6 V | 17,1 s | 0,47 m/s | 18 mm | Da la vuelta |
| Batería baja, 9,9 V | 22,5 s | 0,36 m/s | 16 mm | Da la vuelta, justo en la meta |
| Base 100 % | 18,0 s | 0,45 m/s | 26 mm | Da la vuelta, se mece más |
| Sensores a 120 mm del eje | 19,3 s | 0,42 m/s | 14 mm | Da la vuelta |
| Sensores a 30 mm entre sí | 37,0 s | 0,22 m/s | 50 mm | Pierde la línea el 23 % del tiempo |
| Kd = 0 | | | | Se sale |
| Kp = 0,010 | | | | Se sale |
| Sensores a 30 mm del eje | | | | Se sale |

Evidencias en [evidencias/](evidencias/).

## 7. Modelo
- Motor: rpm = 280 × (V / 12) × 0,8; V = (batería − 2,1 V) × PWM. La rueda llega a su velocidad con una constante de 0,18 s.
- Sensor: lectura = piso + (cinta − piso) × (parte de la zona sobre la cinta + granito × 0,6 × resto) + ruido.
- Posición de la línea: promedio de las posiciones de los sensores, pesado por su lectura normalizada (por debajo del 20 % cuenta como 0).
- Si ningún sensor ve la línea, gira hacia el último lado donde la vio.
- PD: corrección = Kp × error + Kd × cambio del error; PWM izquierdo = base − corrección, derecho = base + corrección.

## 8. Supuestos que hay que medir
| Supuesto | Valor | Cómo se mide |
|---|---|---|
| Lectura en piso y en cinta | 500 y 3 300 | Con los TCRT5000 sobre el granito del laboratorio |
| Zona que ve el sensor | radio 3 mm | Pasando el sensor sobre el borde de la cinta |
| Granito | inventado | Foto del piso en la observación del 18 nov |
| Pista | inventada | Distancias de la observación del 18 nov |
| Peso (80 %) y respuesta (0,18 s) | de P03 | Con el encoder en P03 (semana 6) |
| PWM mínimo para arrancar | no se modela | Con el motor real en P03 |

## 9. Siguiente paso
1. Cambiar la pista por el recorrido real del laboratorio (después del 18 nov).
2. Calibrar las lecturas con los TCRT5000 reales y ajustar el umbral.
3. Pasar el control PD al firmware del ESP32 (P07) con los mismos Kp y Kd como punto de partida.

## Código para el ESP32
`codigo-esp32/seguidor_linea/seguidor_linea.ino` (Arduino IDE, core ESP32 3.x). Misma lógica y mismos valores que `codigo/model.js`: BASE 0,8, Kp 0,03, Kd 0,0015, sensores a 18 mm, lazo a 100 Hz. Verificado contra `control()` en 6 casos de lecturas. Pendiente: calibrar `ADC_PISO`, `ADC_CINTA`, `SEP_MM`, `KP` y `KD` con el robot real.
