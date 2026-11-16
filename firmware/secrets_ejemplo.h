// =====================================================================
// secrets_ejemplo.h  ·  PLANTILLA que SÍ se sube al repo
// =====================================================================
// Este archivo va a GitHub. Los secretos reales van en secrets.h,
// que está en .gitignore y nunca se sube.
//
// Uso en el laboratorio:
//   1. Copia este archivo y renómbralo a secrets.h
//   2. Rellena WIFI_SSID / WIFI_PASS con la red de la prueba
//   3. Compila y sube
//
// El ESP32 solo ve redes de 2,4 GHz.
// =====================================================================
#pragma once

// --- Red Wi-Fi (2,4 GHz) ---
#define WIFI_SSID   "TU_RED_WIFI"
#define WIFI_PASS   "TU_CLAVE_WIFI"

// --- Broker MQTT ---
#define MQTT_BROKER "broker.hivemq.com"
#define MQTT_PUERTO 1883
