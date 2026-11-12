# P01 MQTT base

**Fase:** I (Revisión y levantamiento)
**Responsables:** Iliana Semprun y Andrea Ferrer
**Tarea en GitHub:** #2
**Versión:** 2.1 (11/11/2026). Versión 1: 10/11/2026.
**Estado:** cerrado, 7 de 7 pruebas pasadas.

👉 **Versión visual:** [index.html](index.html) · **Banco de pruebas:** [banco.html](banco.html)

## En una frase
El robot y la app nunca se hablan directo: los dos le entregan sus mensajes a un cartero central (el broker), y él los reparte a quien los esté esperando.

## La comparación
MQTT funciona como un correo: hay buzones con nombre (tópicos), cartas normales (QoS 0), certificadas (QoS 1) y de entrega única (QoS 2), y una carta firmada que el cartero entrega si el robot desaparece (última voluntad, LWT).

## 1. Objetivo
Comunicar el ESP32 con el broker MQTT. Es la base de todo el sistema: por aquí viajan el estado del robot, los pedidos de la app y las alarmas.

## 2. Requisito que valida
- El robot recibe pedidos y confirma cada uno con su número.
- El robot informa su estado de forma periódica.
- El sistema sabe cuándo el robot se desconecta.
- Las alarmas llegan una sola vez (QoS 2).

## 3. Simulador y herramientas
- **Wokwi:** ESP32 DevKit C v4, red `Wokwi-GUEST`. Proyecto: https://wokwi.com/projects/480338785084042241
- **Broker:** `broker.hivemq.com`, puerto 1883 (ESP32) y 8884 WebSocket seguro (banco). Público, solo para desarrollo.
- **Banco de pruebas:** [banco.html](banco.html), en el navegador. Envía pedidos, cuenta respuestas, mide tiempos y descarga CSV.
- **Librería:** `MQTT` de Joel Gaehwiler (QoS 0, 1 y 2). Se descartó PubSubClient porque solo publica con QoS 0.

Código en `codigo/`: `sketch.ino` (versión 2.1), `diagram.json`, `libraries.txt`. La versión 1 está en `codigo/v1/`.

## 4. Cómo se prueba (protocolo)
1. Abrir el proyecto en Wokwi y presionar ▶️.
2. Abrir el banco de pruebas y tocar **Conectar al broker**.
3. Hacer las pruebas T1 a T7 en orden y guardar las evidencias en `evidencias/`.

## 5. Criterios de éxito
| Prueba | Qué se mide | Criterio |
|---|---|---|
| T1 | Aviso "en línea" al conectar | Llega con QoS 1 y retenido |
| T2 | Estado periódico (QoS 0) | Uno cada 2 s aprox. (en Wokwi puede ser más lento) |
| T3 | Un pedido y su confirmación (QoS 1) | La confirmación trae el mismo número de pedido |
| T4 | 50 pedidos seguidos | 50 de 50 confirmados |
| T5 | 10 alarmas (QoS 2) | 10 recibidas, ninguna repetida |
| T6 | Aviso "desconectado" (LWT) | En menos de 30 s |
| T7 | Reconexión | Vuelve a decir "en línea" solo |

## 6. Resultado (versión 2.1, 11/11/2026)
| Prueba | Resultado | Evidencia |
|---|---|---|
| T1 | ✅ Robot en línea | `evidencias/01-T1-T2-en-linea-y-estado.png` |
| T2 | ✅ 34 estados, uno cada 2,0 s | `evidencias/01-T1-T2-en-linea-y-estado.png` |
| T3 | ✅ P-0001 confirmado en 899 ms (versión 1: ~8 s) | `evidencias/02-T3-un-pedido.png` |
| T4 | ✅ 50 de 50 · mín 678 ms, prom 4133 ms, mediana 4294 ms, máx 8023 ms | `evidencias/04-T4-v2.1-50-de-50.png`, `datos/T4-v2.1-50-de-50.csv` |
| T5 | ✅ 10 alarmas, ninguna repetida | `evidencias/05-T5-10-alarmas.png`, `datos/registro-mensajes-T4-a-T7.csv` |
| T6 | ✅ "desconectado" a los 22 s (teoría: 1,5 × 15 s = 22,5 s) | `evidencias/06-T6-desconectado-22s.png` |
| T7 | ✅ "en línea" otra vez y estado desde 1 | `evidencias/07-T7-en-linea-otra-vez.png` |

### Configuración clave (versión 2.1)
- `mqtt.setOptions(15, false, 10000)` → keep alive 15 s, sesión persistente y espera de 10 s.
- QoS 1 garantiza la entrega mientras la sesión existe: por eso se usa junto con sesión persistente.
- Los tiempos crecen a lo largo de la prueba porque se envió 1 pedido por segundo, más rápido de lo que responde el robot simulado (se forma una fila). No se perdió ninguno.

**Versión 1 (10/11/2026):** pasaron estado, "en línea", "desconectado", reconexión y un pedido con confirmación. Evidencias en `evidencias/v1/`.

## 7. Qué se reutiliza en el robot real
- El árbol de tópicos y su QoS.
- Las funciones de conexión, reconexión y última voluntad.
- La forma de recibir pedidos y confirmarlos con su número.
- El banco de pruebas, que sirve igual con el ESP32 físico.

## 8. Qué falta validar con hardware
- Tiempo real de respuesta (pedido → confirmación) con el ESP32 físico.
- Conexión desde el Wi-Fi del laboratorio (H0).
- Broker privado con usuario, contraseña y TLS para las pruebas finales.

## 9. Para el tomo
- Tabla de tópicos y QoS (arquitectura de comunicación).
- Tabla de criterios y resultados de esta ficha.
- Gráfica de tiempos de los 50 pedidos (sale del banco de pruebas) y el CSV.
