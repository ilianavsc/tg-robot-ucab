#pragma once
#include "Arduino.h"
#define WL_CONNECTED 3
#define WIFI_STA 1
struct IPAddressStub { };
inline HardwareSerial& operator<<(HardwareSerial& s, IPAddressStub) { return s; }
class WiFiClass {
 public:
  int st = WL_CONNECTED;
  int status() { return st; }
  void begin(const char*, const char*) {}
  void mode(int) {}
  const char* localIP() { return "10.0.0.2"; }
};
extern WiFiClass WiFi;
class WiFiClient { public: void setTimeout(uint32_t) {} };
