# Documento de requerimientos y matriz de hardware (borrador)

**Fecha:** 11/11/2026 · **Entrega:** 20/11/2026 (hito de la Fase I)
**Estado:** borrador. Los datos marcados con **?** se completan con las entrevistas y la observación en el laboratorio (16 al 18 nov).

> Versión de trabajo en Claude Docs (para editar y comentar entre las dos). Esta copia en el repositorio se actualiza cuando hay cambios importantes.

## 1. Guía de entrevista al personal técnico
Son 13 preguntas, unos 20 minutos. Pidan permiso para tomar notas y, si se puede, grabar el audio.

**El pedido de hoy**
1. ¿Qué componentes piden más los estudiantes? Nombren los 10 más pedidos.
2. ¿Cómo se pide un componente hoy y cuánto tarda la entrega?
3. ¿Cómo es un pedido típico: cuántas piezas, de qué tamaño y peso?
4. ¿A qué horas hay más pedidos?

**Dónde están las cosas**
5. ¿Dónde se guardan (estantes, gavetas, cajas)? ¿Se pueden etiquetar o numerar?
6. ¿Qué pasa cuando un componente no está o se acabó?

**Quién y cómo**
7. ¿Quién debería poder pedir (estudiantes, profesores) y quién aprueba?
8. ¿Hay que registrar quién se llevó qué y cuándo lo devolvió?

**El robot en el laboratorio**
9. ¿Se permitiría un robot circulando? ¿Hay horarios, zonas o reglas de seguridad?
10. ¿Qué red Wi-Fi podría usar? ¿Pide usuario o una página de acceso?
11. ¿Dónde podría cargar su batería?
12. ¿Qué preocupa más: robo, pérdida o daño? ¿Qué debería hacer la alarma y a quién avisar?

**Material**
13. ¿Qué componentes de nuestra lista nos pueden prestar durante todo el TG (sobre todo el ESP32)?

## 2. Hoja de observación del laboratorio
Lleven cinta métrica, un teléfono para fotos (con permiso) y, si pueden, el ESP32 para la prueba H0.

| Aspecto | Qué medir o anotar | Dato |
|---|---|---|
| Recorrido | Distancia del mostrador a cada estante (m) | |
| Pasillos | Ancho más angosto (cm) | |
| Piso | Tipo y color, para elegir el color de la cinta | |
| Luz | Natural o artificial, reflejos en el piso | |
| Obstáculos | Sillas, mochilas, cables, escalones o rampas | |
| Estantes | Altura de la repisa más baja y más alta (cm) | |
| Demanda | Pedidos contados en 1 hora de mucho movimiento | |
| Wi-Fi (H0) | Nombre de la red y si el ESP32 o el teléfono llega al broker en cada punto | |
| Carga | Tomacorrientes cerca del punto de partida | |
| Fotos | Planta del laboratorio, estantes y pasillos | |

## 3. Requerimientos funcionales
| ID | El sistema debe… | Criterio de aceptación | Se valida con | Estado |
|---|---|---|---|---|
| RF-01 | Recibir pedidos desde la app (componente, cantidad, ubicación) y confirmarlos | Cada confirmación trae el número del pedido; 0 pedidos perdidos en 50 | P01 (T3, T4) | Validado en simulación |
| RF-02 | Informar su estado de forma periódica | Un mensaje cada 2 s | P01 (T2) | Validado en simulación |
| RF-03 | Avisar si el robot se desconecta | Aviso en menos de 30 s | P01 (T6) | Validado en simulación (22 s) |
| RF-04 | Ir por la línea del mostrador al estante y volver | Error de posición ≤ ? cm al llegar | P08, H4 | Pendiente |
| RF-05 | Detectar un obstáculo y detenerse | Se detiene a ≥ 20 cm del obstáculo | P02 | Pendiente |
| RF-06 | Re-localizarse en puntos de referencia | Corrige su posición en cada punto (BLE o QR) | P04, P09 | Pendiente |
| RF-07 | Transportar los componentes pedidos | Carga hasta ? g sin perder la línea | H5 | Pendiente |
| RF-08 | Alarmar si alguien lo levanta o lo mueve sin una orden | La alarma llega a la app 1 sola vez; ≤ ? falsas alarmas en N recorridos | P11, H6 | Pendiente |
| RF-09 | Permitir pedir, ver el estado y recibir avisos desde la app | Notificación en ≤ 5 s | P06, P10 | Pendiente |
| RF-10 | Registrar quién pidió qué y cuándo | Historial consultable en la app | P10 | Pendiente (confirmar en entrevista) |
| RF-11 | Pedir usuario para entrar a la app | Solo usuarios autorizados hacen pedidos | P06 | Pendiente (definir roles en entrevista) |

## 4. Requerimientos no funcionales
| ID | Requerimiento | Criterio medible | De dónde sale |
|---|---|---|---|
| RNF-01 | Bajo costo | Total ≤ US$ ? (compras proyectadas: unos US$ 90, más lo que preste el laboratorio) | Lista de materiales v1 |
| RNF-02 | Autonomía | ≥ ? min de trabajo continuo | Horario de demanda (entrevista, pregunta 4) |
| RNF-03 | Velocidad | Entre 0,35 y 0,6 m/s | Motores de 100 a 170 rpm con ruedas de 65 mm |
| RNF-04 | Comunicación confiable | 0 pedidos perdidos; confirmación en ≤ ? s con el ESP32 real | P01 (en simulación: promedio 4,1 s con VPN) |
| RNF-05 | Seguridad de la comunicación | Broker privado con usuario, contraseña y TLS para las pruebas finales | Riesgo del broker público |
| RNF-06 | Funcionar en la red del laboratorio | El ESP32 llega al broker desde el Wi-Fi de la UCAB | H0 |
| RNF-07 | Convivir con las personas | Se detiene ante obstáculos y respeta las reglas del laboratorio | Entrevista, pregunta 9 |
| RNF-08 | Resultados confiables | Mínimo 20 repeticiones por prueba en la Fase VII | Cronograma |

## 5. Matriz de hardware v2
Cambios respecto a la lista v1: divisor de batería corregido, RPM de motores definidas, fusible lento y acople metálico. Las tres decisiones abiertas (placa, driver y BLE o QR) se cierran con datos.

| Componente | Elección | Alternativa | Por qué | Estado |
|---|---|---|---|---|
| Microcontrolador | ESP32-WROOM-32, DevKit de 30 pines | DevKit de 38 pines | Es el mismo chip que en Wokwi; 8 entradas analógicas ADC1 | Abierta: decidir con el mapa de pines (Fase II) |
| Motores | JGA25-370, 12 V, con encoder, 100 a 170 rpm | Otra RPM del mismo modelo | Velocidad de 0,35 a 0,6 m/s; el encoder permite la odometría | Por pedir (Amazon) |
| Driver | L298N | TB6612FNG | El L298N pierde cerca de 2 V; el TB6612FNG es más eficiente pero aguanta poco más de 1 A por motor | Abierta: depende de la corriente de arranque del motor |
| Batería | 3 × 18650 de marca, en serie (3S) | LiPo 3S | Capacidad real y repuestos fáciles | Por comprar |
| BMS | 3S con balanceo, ≥ 10 A | Sin alternativa | Protege y equilibra las celdas | Por comprar |
| Regulador | LM2596 ajustado a 5 V antes de conectar | Sin alternativa | Alimenta el ESP32 y los ultrasónicos | Preguntar al laboratorio |
| Medición de batería | Divisor de 100 kΩ y 22 kΩ | INA219 | Deja unos 2,3 V en el pin con la batería llena (1 kΩ y 2 kΩ dañaba el pin) | Corregido |
| Protección | Fusible de 3 A de acción lenta | Sin alternativa | Aguanta el pico de arranque de los motores | Por comprar |
| Sensores de línea | 4 × TCRT5000 a 3,3 V en pines ADC1 | QTR-8A | Los pines ADC2 no leen con el Wi-Fi encendido | Preguntar al laboratorio |
| Obstáculos | 2 × HC-SR04P (3,3 V) | HC-SR04 con divisor de 1 kΩ y 2 kΩ | Evita los 5 V en el pin del ESP32 | Preguntar al laboratorio |
| Movimiento y alarma | MPU6050 (GY-521) | Sin alternativa | Odometría y detección de levantamiento | Preguntar al laboratorio |
| Ruedas | 65 mm con acople metálico de 4 mm | Cubo impreso en PLA | El cubo impreso suele patinar en el eje | Por comprar |
| Rueda loca | Altura igual al eje de las ruedas | Sin alternativa | Mantiene los TCRT5000 a pocos mm del piso | Por comprar |
| Re-localización | ESP32-C3 SuperMini como balizas BLE | Lector de QR (GM65) | Se decide con la prueba P04 | Abierta: Fase II |
| Mecanismo de carga | ? (bandeja o pinza) | ? | Depende del pedido típico (entrevista, pregunta 3) | Abierta |
