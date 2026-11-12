# Objetivo 2: tabla comparativa de selección de hardware

Borrador para el tomo (11/11/2026). Fuente de los números: hojas de los productos, cálculo del avance 1 de P03 (Colab) y simulador 3D (avance 2).

| Componente | Alternativas evaluadas | Seleccionado | Justificación |
|---|---|---|---|
| Microcontrolador | ESP32-WROOM-32, ESP32-S2, ESP32-S3, ESP32-C3 | ESP32-WROOM-32, DevKit de 30 pines | Wi-Fi y BLE integrados; 6 entradas ADC1 que funcionan con Wi-Fi encendido; mismo chip que en Wokwi. El S2 no tiene Bluetooth y el C3 tiene pocos pines. |
| Motor | JGA25-371 12 V con encoder: Speed 130 (170 rpm sin carga, 1:35,5) y Speed 200 (280 rpm sin carga, 1:21,3) | Speed 200 | Con L298N y el peso del robot se estiman ~0,57 m/s (meta RNF-03: 0,35 a 0,6 m/s); el Speed 130 queda en ~0,35 m/s. La velocidad sobrante se limita con PWM. Encoder: 234 pulsos por vuelta de rueda. |
| Driver | L298N, TB6612FNG | L298N | Cada motor pide hasta 1,8 A trabado; el TB6612FNG aguanta 1,2 A seguidos por motor y el L298N 2 A. Se acepta su caída de ~2 V. |
| Batería | LiPo 3S, 3 × 18650 en serie (3S) | 3 × EVE INR18650-25P (2500 mAh, 30 A) | Capacidad real, celdas reemplazables y descarga de sobra para los motores. Autonomía estimada ~3 h. |
| Protección de batería | BMS 3S sin balanceo, BMS 3S con balanceo | BMS 3S 25 A con balanceo | Protege contra sobrecarga, descarga profunda y cortocircuito, e iguala las celdas en cada carga. |
| Cargador | Módulo USB 5 V → 12,6 V, cargador de pared 12,6 V | Cargador de pared 12,6 V / 2 A | Cargador de litio CC/CV sin configuración, carga en ~2 h, indicador de fin de carga. |
| Medición de batería | INA219, divisor resistivo | Divisor 100 kΩ / 22 kΩ | Deja ~2,3 V en el pin con 12,6 V; sin módulo adicional. Aviso de batería baja a 9,9 V. |
| Sensores de línea | TCRT5000 digital (3 pines), TCRT5000 analógico (A0), QTR-8A | 4 × TCRT5000 con salida analógica | La salida analógica da la desviación respecto a la línea para el PID; bajo costo. |
| Obstáculos | HC-SR04 (5 V + divisor en Echo), HC-SR04P (3 a 5,5 V) | 2 × HC-SR04P | Funciona a 3,3 V y se conecta directo al ESP32. |
| IMU | MPU6050 | MPU6050 (GY-521) | Giroscopio para la orientación y acelerómetro para la alerta de manipulación. |
| Re-localización | Balizas BLE, códigos QR, marcas en la línea | Abierta (prueba P04) | Se compran 3 ESP32: una en el robot y dos como balizas de inicio y fin para calibrar tiempo y distancia. |

## Cambios en la Figura 4 de la propuesta

1. Cambiar la batería LiPo por **3 × 18650 en serie (3S, 11,1 V) + BMS 3S con balanceo**.
2. Agregar el **cargador de 12,6 V** y el **jack de carga**, conectados antes del interruptor.
3. Agregar el **fusible de 3 A** después del BMS y el **interruptor** de encendido.
4. Mostrar el **LM2596 (5 V)** alimentando al ESP32, y el **L298N** alimentado directo de la batería.
5. Indicar los **encoders** en los motores, conectados al ESP32.
6. Agregar las **balizas BLE (ESP32)** en el inicio y el final del recorrido, enlazadas por Bluetooth con el robot.
