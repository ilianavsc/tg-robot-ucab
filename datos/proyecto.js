/*
  DATOS DEL PROYECTO
  Este es el único archivo que hay que editar para actualizar el sitio.
  Fechas siempre en formato AAAA-MM-DD.
*/
window.TG = {
  titulo: "Robot móvil de búsqueda y transporte",
  autoras: "Iliana Semprun y Andrea Ferrer",
  tutor: "Ing. Biagio Cante",
  repo: "https://github.com/ilianavsc/tg-robot-ucab",
  inicio: "2026-10-26",
  fin: "2027-06-11",
  totalSemanas: 32,

  fases: [
    { id: "I", nombre: "Revisión y levantamiento", inicio: "2026-10-26", fin: "2026-11-20", semanas: "1 a 4",
      que: "Revisión documental, entrevistas al personal técnico y observación directa en el laboratorio para definir requerimientos y seleccionar el hardware.",
      hito: "Documento de requerimientos y matriz de hardware" },
    { id: "II", nombre: "Diseño del sistema", inicio: "2026-11-23", fin: "2026-12-18", semanas: "5 a 8",
      que: "Arquitectura MQTT (tópicos y QoS), modelado CAD del chasis y esquema electrónico del ESP32.",
      hito: "Planos del chasis, diagramas y arquitectura de red" },
    { id: "III", nombre: "Construcción y firmware", inicio: "2026-12-21", fin: "2027-02-05", semanas: "9 a 14",
      que: "Impresión 3D y montaje del chasis. Programación del PID, los sensores y el cliente MQTT en el ESP32.",
      hito: "Plataforma armada y firmware funcional" },
    { id: "IV", nombre: "Navegación progresiva", inicio: "2027-02-08", fin: "2027-03-12", semanas: "15 a 19",
      que: "Mapeo relativo, pruebas híbridas, fusión de sensores (Kalman) y re-localización con QR o BLE.",
      hito: "Navegación validada con medición de errores" },
    { id: "V", nombre: "App y backend", inicio: "2027-03-15", fin: "2027-04-16", semanas: "20 a 24",
      que: "App en Flutter, integración con Firebase, notificaciones y trazabilidad.",
      hito: "Aplicación integrada y funcional" },
    { id: "VI", nombre: "Integración y alertas", inicio: "2027-04-19", fin: "2027-05-07", semanas: "25 a 27",
      que: "Unión de hardware y software. Calibración del acelerómetro y evaluación de falsas alarmas antirrobo.",
      hito: "Prototipo integrado con alertas" },
    { id: "VII", nombre: "Pruebas y redacción final", inicio: "2027-05-10", fin: "2027-06-11", semanas: "28 a 32",
      que: "Ensayos en maqueta (mínimo 20 repeticiones), análisis estadístico, redacción del tomo y preparación de la defensa.",
      hito: "Entrega del Trabajo de Grado" }
  ],

  eventos: [
    { nombre: "Semana extra (parciales)", inicio: "2027-01-11", fin: "2027-01-16", tipo: "extra",
      nota: "Era pausa por exámenes, pero seguimos trabajando: es una semana de ventaja para la Fase III." },
    { nombre: "Ventana de oro", inicio: "2027-03-15", fin: "2027-04-09", tipo: "oro",
      nota: "Sin clases: tiempo para el trabajo pesado." }
  ],

  /* estado: "hecho" | "pruebas" | "pendiente" */
  prototipos: [
    { codigo: "P01", nombre: "Así se hablan el robot y la app", tema: "MQTT", semana: 3, estado: "hecho", url: "prototipos/P01-mqtt-base/" },
    { codigo: "H0", nombre: "Wi-Fi del laboratorio", tema: "Red", semana: 4, estado: "pendiente" },
    { codigo: "P02", nombre: "Los sentidos del robot", tema: "Sensores", semana: 5, estado: "pendiente" },
    { codigo: "P03", nombre: "Motores que van parejo", tema: "PID", semana: 6, estado: "pendiente", url: "prototipos/P03-motores/avance-01-colab/" },
    { codigo: "P04", nombre: "¿BLE o QR?", tema: "Ubicación", semana: 7, estado: "pendiente" },
    { codigo: "P05", nombre: "Robot virtual y puente", tema: "Firebase", semana: 9, estado: "pendiente" },
    { codigo: "P06", nombre: "Primera versión de la app", tema: "Flutter", semana: 10, estado: "pendiente" },
    { codigo: "P07", nombre: "El cerebro completo", tema: "Firmware", semana: 12, estado: "pendiente" },
    { codigo: "P08", nombre: "Seguir la línea", tema: "Webots", semana: 13, estado: "pendiente" },
    { codigo: "P09", nombre: "Saber dónde está", tema: "Kalman", semana: 15, estado: "pendiente" },
    { codigo: "P10", nombre: "La app completa", tema: "Flutter", semana: 21, estado: "pendiente" },
    { codigo: "P11", nombre: "La alarma llega al teléfono", tema: "Alertas", semana: 23, estado: "pendiente" },
    { codigo: "P12", nombre: "Pruebas y estadística", tema: "Análisis", semana: 27, estado: "pendiente" }
  ],

  /* Lo que hay que hacer ya. hecho: true cuando se cumpla */
  pendientes: [
    { que: "Cerrar P01: alarma con QoS 2 y 50 órdenes seguidas", fecha: "2026-11-13", hecho: true },
    { que: "Confirmar con el laboratorio qué componentes tienen", fecha: "2026-11-13", hecho: false },
    { que: "Pedir los motores por Amazon", fecha: "2026-11-13", hecho: false },
    { que: "Entrevistas y observación en el laboratorio + prueba H0", fecha: "2026-11-18", hecho: false },
    { que: "Documento de requerimientos y matriz de hardware v2", fecha: "2026-11-20", hecho: false }
  ],

  /* ---------- REQUERIMIENTOS ----------
     estado: "validado" | "pendiente". Un "?" en el criterio = dato por definir en la visita al laboratorio */
  requerimientos: [
    { id: "RF-01", tipo: "RF", texto: "Recibir pedidos desde la app (componente, cantidad, ubicación) y confirmarlos", criterio: "Cada confirmación trae el número del pedido; 0 pedidos perdidos en 50", valida: ["P01"], estado: "validado", nota: "Validado en simulación (T3 y T4)" },
    { id: "RF-02", tipo: "RF", texto: "Informar su estado de forma periódica", criterio: "Un mensaje cada 2 s", valida: ["P01"], estado: "validado", nota: "Validado en simulación (T2)" },
    { id: "RF-03", tipo: "RF", texto: "Avisar si el robot se desconecta", criterio: "Aviso en menos de 30 s", valida: ["P01"], estado: "validado", nota: "Validado en simulación: 22 s (T6)" },
    { id: "RF-04", tipo: "RF", texto: "Ir por la línea del mostrador al estante y volver", criterio: "Error de posición ≤ ? cm al llegar", valida: ["P08", "H4"], estado: "pendiente" },
    { id: "RF-05", tipo: "RF", texto: "Detectar un obstáculo y detenerse", criterio: "Se detiene a ≥ 20 cm del obstáculo", valida: ["P02"], estado: "pendiente" },
    { id: "RF-06", tipo: "RF", texto: "Re-localizarse en puntos de referencia", criterio: "Corrige su posición en cada punto (BLE o QR)", valida: ["P04", "P09"], estado: "pendiente" },
    { id: "RF-07", tipo: "RF", texto: "Transportar los componentes pedidos", criterio: "Carga hasta ? g sin perder la línea", valida: ["H5"], estado: "pendiente" },
    { id: "RF-08", tipo: "RF", texto: "Alarmar si alguien lo levanta o lo mueve sin una orden", criterio: "La alarma llega a la app 1 sola vez; ≤ ? falsas alarmas en N recorridos", valida: ["P11", "H6"], estado: "pendiente" },
    { id: "RF-09", tipo: "RF", texto: "Permitir pedir, ver el estado y recibir avisos desde la app", criterio: "Notificación en ≤ 5 s", valida: ["P06", "P10"], estado: "pendiente" },
    { id: "RF-10", tipo: "RF", texto: "Registrar quién pidió qué y cuándo", criterio: "Historial consultable en la app", valida: ["P10"], estado: "pendiente", nota: "Confirmar en la entrevista" },
    { id: "RF-11", tipo: "RF", texto: "Pedir usuario para entrar a la app", criterio: "Solo usuarios autorizados hacen pedidos", valida: ["P06"], estado: "pendiente", nota: "Definir roles en la entrevista" },
    { id: "RNF-01", tipo: "RNF", texto: "Bajo costo", criterio: "Total ≤ US$ ? (compras proyectadas: unos US$ 90, más lo que preste el laboratorio)", valida: ["Lista v1"], estado: "pendiente" },
    { id: "RNF-02", tipo: "RNF", texto: "Autonomía", criterio: "≥ ? min de trabajo continuo", valida: ["Entrevista"], estado: "pendiente" },
    { id: "RNF-03", tipo: "RNF", texto: "Velocidad", criterio: "Entre 0,35 y 0,6 m/s", valida: ["P03"], estado: "pendiente", nota: "Cálculo en Colab: con L298N y peso, 130 rpm daría ~0,27 m/s y 170 rpm ~0,35 m/s. Ver P03 avance 1" },
    { id: "RNF-04", tipo: "RNF", texto: "Comunicación confiable", criterio: "0 pedidos perdidos; confirmación en ≤ ? s con el ESP32 real", valida: ["P01"], estado: "pendiente", nota: "En simulación: 0 perdidos, promedio 4,1 s con VPN" },
    { id: "RNF-05", tipo: "RNF", texto: "Seguridad de la comunicación", criterio: "Broker privado con usuario, contraseña y TLS para las pruebas finales", valida: ["Fase VI"], estado: "pendiente" },
    { id: "RNF-06", tipo: "RNF", texto: "Funcionar en la red del laboratorio", criterio: "El ESP32 llega al broker desde el Wi-Fi de la UCAB", valida: ["H0"], estado: "pendiente" },
    { id: "RNF-07", tipo: "RNF", texto: "Convivir con las personas", criterio: "Se detiene ante obstáculos y respeta las reglas del laboratorio", valida: ["P02", "Entrevista"], estado: "pendiente" },
    { id: "RNF-08", tipo: "RNF", texto: "Resultados confiables", criterio: "Mínimo 20 repeticiones por prueba", valida: ["Fase VII"], estado: "pendiente" }
  ],

  /* ---------- VISITA AL LABORATORIO ---------- */
  entrevista: [
    { grupo: "El pedido de hoy", preguntas: ["¿Qué componentes piden más los estudiantes? Nombren los 10 más pedidos.", "¿Cómo se pide un componente hoy y cuánto tarda la entrega?", "¿Cómo es un pedido típico: cuántas piezas, de qué tamaño y peso?", "¿A qué horas hay más pedidos?"] },
    { grupo: "Dónde están las cosas", preguntas: ["¿Dónde se guardan (estantes, gavetas, cajas)? ¿Se pueden etiquetar o numerar?", "¿Qué pasa cuando un componente no está o se acabó?"] },
    { grupo: "Quién y cómo", preguntas: ["¿Quién debería poder pedir (estudiantes, profesores) y quién aprueba?", "¿Hay que registrar quién se llevó qué y cuándo lo devolvió?"] },
    { grupo: "El robot en el laboratorio", preguntas: ["¿Se permitiría un robot circulando? ¿Hay horarios, zonas o reglas de seguridad?", "¿Qué red Wi-Fi podría usar? ¿Pide usuario o una página de acceso?", "¿Dónde podría cargar su batería?", "¿Qué preocupa más: robo, pérdida o daño? ¿Qué debería hacer la alarma y a quién avisar?"] },
    { grupo: "Material", preguntas: ["¿Qué componentes de nuestra lista nos pueden prestar durante todo el TG (sobre todo el ESP32)?"] }
  ],
  observacion: [
    ["Recorrido", "Distancia del mostrador a cada estante (m)"],
    ["Pasillos", "Ancho más angosto (cm)"],
    ["Piso", "Tipo y color, para elegir el color de la cinta"],
    ["Luz", "Natural o artificial, reflejos en el piso"],
    ["Obstáculos", "Sillas, mochilas, cables, escalones o rampas"],
    ["Estantes", "Altura de la repisa más baja y más alta (cm)"],
    ["Demanda", "Pedidos contados en 1 hora de mucho movimiento"],
    ["Wi-Fi (H0)", "Nombre de la red y si el ESP32 o el teléfono llega al broker en cada punto"],
    ["Carga", "Tomacorrientes cerca del punto de partida"],
    ["Fotos", "Planta del laboratorio, estantes y pasillos"]
  ],

  /* ---------- HARDWARE (matriz v2) ----------
     estado: "por pedir" | "por comprar" | "preguntar al lab" | "corregido" | "abierta" | "listo" */
  materiales: [
    { componente: "Microcontrolador", eleccion: "ESP32-WROOM-32, DevKit de 30 pines", alternativa: "DevKit de 38 pines", porque: "Mismo chip que en Wokwi; 8 entradas analógicas ADC1", estado: "abierta", cuando: "Fase II (mapa de pines)" },
    { componente: "Motores", eleccion: "JGA25-370, 12 V, con encoder, 170 rpm (recomendado)", alternativa: "130 rpm si se usa TB6612FNG o se baja la meta de velocidad", porque: "Con batería, L298N y peso, 170 rpm llega a ~0,35 m/s; 130 rpm se queda en ~0,27. El encoder permite la odometría", estado: "por pedir", cuando: "Esta semana (Amazon)" },
    { componente: "Driver", eleccion: "L298N", alternativa: "TB6612FNG", porque: "El L298N pierde cerca de 2 V; el TB6612FNG es más eficiente pero aguanta poco más de 1 A por motor", estado: "abierta", cuando: "Con la corriente de arranque del motor" },
    { componente: "Batería", eleccion: "3 × 18650 de marca, en serie (3S)", alternativa: "LiPo 3S", porque: "Capacidad real y repuestos fáciles", estado: "por comprar", cuando: "Antes de fin de noviembre" },
    { componente: "BMS", eleccion: "3S con balanceo, ≥ 10 A", alternativa: "", porque: "Protege y equilibra las celdas", estado: "por comprar", cuando: "Antes de fin de noviembre" },
    { componente: "Regulador", eleccion: "LM2596 ajustado a 5 V antes de conectar", alternativa: "", porque: "Alimenta el ESP32 y los ultrasónicos", estado: "preguntar al lab", cuando: "Antes del 18 dic" },
    { componente: "Medición de batería", eleccion: "Divisor de 100 kΩ y 22 kΩ", alternativa: "INA219", porque: "Deja unos 2,3 V en el pin con la batería llena (1 kΩ y 2 kΩ dañaba el pin)", estado: "corregido", cuando: "" },
    { componente: "Protección", eleccion: "Fusible de 3 A de acción lenta", alternativa: "", porque: "Aguanta el pico de arranque de los motores", estado: "por comprar", cuando: "Antes del 18 dic" },
    { componente: "Sensores de línea", eleccion: "4 × TCRT5000 a 3,3 V en pines ADC1", alternativa: "QTR-8A", porque: "Los pines ADC2 no leen con el Wi-Fi encendido", estado: "preguntar al lab", cuando: "Antes del 18 dic" },
    { componente: "Obstáculos", eleccion: "2 × HC-SR04P (3,3 V)", alternativa: "HC-SR04 con divisor de 1 kΩ y 2 kΩ", porque: "Evita los 5 V en el pin del ESP32", estado: "preguntar al lab", cuando: "Antes del 18 dic" },
    { componente: "Movimiento y alarma", eleccion: "MPU6050 (GY-521)", alternativa: "", porque: "Odometría y detección de levantamiento", estado: "preguntar al lab", cuando: "Antes del 18 dic" },
    { componente: "Ruedas", eleccion: "65 mm con acople metálico de 4 mm", alternativa: "Cubo impreso en PLA", porque: "El cubo impreso suele patinar en el eje", estado: "por comprar", cuando: "Inicio de diciembre" },
    { componente: "Rueda loca", eleccion: "Altura igual al eje de las ruedas", alternativa: "", porque: "Mantiene los TCRT5000 a pocos mm del piso", estado: "por comprar", cuando: "Inicio de diciembre" },
    { componente: "Re-localización", eleccion: "ESP32-C3 SuperMini como balizas BLE", alternativa: "Lector de QR (GM65)", porque: "Se decide con la prueba P04", estado: "abierta", cuando: "Fase II (P04); compra en febrero" },
    { componente: "Mecanismo de carga", eleccion: "? (bandeja o pinza)", alternativa: "", porque: "Depende del pedido típico (entrevista)", estado: "abierta", cuando: "Después de la entrevista" }
  ],

  /* ---------- DECISIONES (la más nueva primero) ----------
     estado: "tomada" | "abierta" */
  decisiones: [
    { fecha: "2026-11-11", titulo: "Sesión persistente en MQTT", estado: "tomada",
      decision: "El robot se conecta con clean session = false, keep alive 15 s y espera de 10 s.",
      porque: "Con sesión limpia se perdieron 37 de 50 pedidos cuando la red fue lenta. Con sesión persistente: 50 de 50.",
      evidencia: "prototipos/P01-mqtt-base/#t-50" },
    { fecha: "2026-11-11", titulo: "Usar el VPN de Opera para Wokwi", estado: "tomada",
      decision: "Las simulaciones de Wokwi se corren con el VPN de Opera, no con Proton.",
      porque: "Con Proton VPN (plan gratis) el Wi-Fi simulado no conectó a internet; con el de Opera sí.",
      evidencia: "" },
    { fecha: "2026-11-11", titulo: "La semana de parciales es semana de trabajo", estado: "tomada",
      decision: "Del 11 al 16 de enero seguimos trabajando: es una semana extra para la Fase III.",
      porque: "Vamos bien en las materias y la Fase III es la más cargada.",
      evidencia: "cronograma.html" },
    { fecha: "2026-11-11", titulo: "Banco de pruebas en el navegador", estado: "tomada",
      decision: "Las pruebas de comunicación se hacen con una página propia en vez de MQTTX.",
      porque: "Mide tiempos, cuenta pérdidas y repetidos, y descarga los resultados en CSV para el tomo.",
      evidencia: "prototipos/P01-mqtt-base/banco.html" },
    { fecha: "2026-11-11", titulo: "Corregir el divisor de la batería", estado: "tomada",
      decision: "Usar 100 kΩ y 22 kΩ en lugar de 1 kΩ y 2 kΩ.",
      porque: "Con 1 kΩ y 2 kΩ llegarían entre 4,2 y 8,4 V al pin del ESP32, que aguanta 3,3 V.",
      evidencia: "hardware.html" },
    { fecha: "2026-11-10", titulo: "Librería MQTT de Joel Gaehwiler", estado: "tomada",
      decision: "Usar la librería MQTT (lwmqtt) en lugar de PubSubClient.",
      porque: "PubSubClient solo publica con QoS 0, y las alarmas necesitan QoS 2.",
      evidencia: "prototipos/P01-mqtt-base/" },
    { fecha: "2026-11-10", titulo: "Tópicos con prefijo propio y QoS según importancia", estado: "tomada",
      decision: "Estado con QoS 0, pedidos y confirmaciones con QoS 1, alarmas con QoS 2, conexión retenida con LWT.",
      porque: "Perder un estado no importa (llega otro en 2 s); un pedido sí; una alarma debe llegar una sola vez.",
      evidencia: "arquitectura.html" },
    { fecha: "2026-11-10", titulo: "Broker público solo para desarrollo", estado: "tomada",
      decision: "broker.hivemq.com mientras se desarrolla; broker privado con clave y TLS para las pruebas finales.",
      porque: "En el público cualquiera que adivine el tópico podría enviar órdenes o falsas alarmas.",
      evidencia: "" },
    { fecha: "2026-11-10", titulo: "ESP32 clásico y no S2, S3 ni C3", estado: "tomada",
      decision: "ESP32-WROOM-32 para el robot.",
      porque: "Es igual al de Wokwi, tiene Bluetooth (el S2 no) y suficientes pines (el C3 no).",
      evidencia: "hardware.html" },
    { fecha: "", titulo: "Motores de 130 o 170 rpm", estado: "abierta", decision: "", porque: "El cálculo en Colab muestra que con 130 rpm el robot no llega a 0,35 m/s. Recomendado: 170 rpm (se frena con PWM). Hay que pedirlos el 13 nov.", evidencia: "prototipos/P03-motores/avance-01-colab/" },
    { fecha: "", titulo: "Placa de 30 o 38 pines", estado: "abierta", decision: "", porque: "Se decide con el mapa de pines en la Fase II.", evidencia: "" },
    { fecha: "", titulo: "Driver L298N o TB6612FNG", estado: "abierta", decision: "", porque: "Depende de la corriente de arranque de los motores.", evidencia: "" },
    { fecha: "", titulo: "Re-localización con BLE o con QR", estado: "abierta", decision: "", porque: "Se decide con la prueba P04 en la Fase II.", evidencia: "" },
    { fecha: "", titulo: "Bandeja o pinza", estado: "abierta", decision: "", porque: "Depende del pedido típico (entrevista en el laboratorio).", evidencia: "" }
  ],

  /* Una entrada por semana, la más nueva primero */
  bitacora: [
    { semana: 3, fechas: "9 al 13 nov 2026",
      hicimos: ["Plan de prototipos ajustado al cronograma", "Repositorio y sitio en GitHub", "Banco de pruebas en el navegador", "P01 cerrado: 7 de 7 pruebas, 50 de 50 pedidos", "Primera simulación en Google Colab: <a href=\"prototipos/P03-motores/avance-01-colab/\">velocidad de los motores</a>", "Simulador 3D de la tracción: <a href=\"prototipos/P03-motores/avance-02-simulador-3d/\">ESP32, puente H, motor y encoder</a>"],
      aprendimos: ["QoS 1 necesita sesión persistente para no perder pedidos", "PubSubClient solo publica con QoS 0", "Wokwi no conecta con Proton VPN gratis; con el VPN de Opera sí", "Wokwi pausa la simulación si la pestaña queda oculta: el broker avisó \"desconectado\" (sirvió para probar el LWT)", "Las rpm de la caja son con 12 V y sin peso; en el robot el motor va cerca de 40 % más lento", "El puente H decide el sentido con 4 interruptores; el PWM decide la fuerza; el encoder da 1 496 cuentas por vuelta de rueda"],
      sigue: ["Entrevistas en el laboratorio", "Pedir los motores", "Documento de requerimientos"] }
  ]
};
