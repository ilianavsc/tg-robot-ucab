#pragma once
#include "Arduino.h"
#include "WiFi.h"
struct Pub { std::string topic, payload; int qos; };
extern std::vector<Pub> g_pubs;
class MQTTClient {
 public:
  bool con = true;
  explicit MQTTClient(int) {}
  void begin(const char*, int, WiFiClient&) {}
  void setOptions(int, bool, int) {}
  void setWill(const char*, const char*, bool, int) {}
  void onMessage(void (*)(String&, String&)) {}
  bool connect(const char*) { return con; }
  bool connected() { return con; }
  bool loop() { return true; }
  bool subscribe(const char*, int) { return true; }
  bool publish(const char* t, const String& p, bool, int q) { if (!con) return false; g_pubs.push_back({t, p.s, q}); return true; }
  bool publish(const char* t, const char* p, bool r, int q) { return publish(t, String(p), r, q); }
};
