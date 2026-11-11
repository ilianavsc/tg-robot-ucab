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
    { codigo: "P03", nombre: "Motores que van parejo", tema: "PID", semana: 6, estado: "pendiente" },
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

  /* Una entrada por semana, la más nueva primero */
  bitacora: [
    { semana: 3, fechas: "9 al 13 nov 2026",
      hicimos: ["Plan de prototipos ajustado al cronograma", "Repositorio y sitio en GitHub", "Banco de pruebas en el navegador", "P01 cerrado: 7 de 7 pruebas, 50 de 50 pedidos"],
      aprendimos: ["QoS 1 necesita sesión persistente para no perder pedidos", "PubSubClient solo publica con QoS 0", "Wokwi no conecta con Proton VPN gratis; con el VPN de Opera sí"],
      sigue: ["Entrevistas en el laboratorio", "Pedir los motores", "Documento de requerimientos"] }
  ]
};
