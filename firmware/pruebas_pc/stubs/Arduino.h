// Stub mínimo del core Arduino-ESP32 para compilar el firmware en el PC.
#pragma once
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <math.h>
using std::isnan;
#include <cstdarg>
#include <string>
#include <algorithm>
#include <map>
#include <vector>
using std::min; using std::max;
#define IRAM_ATTR
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define CHANGE 3
#define HEX 16
#define ADC_11db 3
#ifndef PI
#define PI 3.14159265358979f
#endif
extern uint32_t g_millis;
extern std::map<int,int> g_duty;
extern std::map<int,int> g_pin;
inline uint32_t millis() { return g_millis; }
inline unsigned long micros() { return (unsigned long)g_millis * 1000UL; }
inline void delayMicroseconds(unsigned) {}
inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t p, uint8_t v) { g_pin[p] = v; }
inline int digitalRead(uint8_t p) { return p == 0 ? 1 : g_pin[p]; }
inline bool ledcAttach(uint8_t, uint32_t, uint8_t) { return true; }
inline bool ledcWrite(uint8_t p, uint32_t d) { g_duty[p] = (int)d; return true; }
inline int analogRead(uint8_t) { return 500; }
extern uint32_t g_bat_mv;
inline uint32_t analogReadMilliVolts(uint8_t) { return g_bat_mv; }
inline void analogReadResolution(int) {}
inline void analogSetPinAttenuation(uint8_t, int) {}
inline int digitalPinToInterrupt(int p) { return p; }
inline void attachInterrupt(int, void (*)(), int) {}
inline void noInterrupts() {}
inline void interrupts() {}

class String {
 public:
  std::string s;
  String() {}
  String(const char* c) : s(c ? c : "") {}
  String(const std::string& x) : s(x) {}
  String(char c) : s(1, c) {}
  String(int v) : s(std::to_string(v)) {}
  String(long v) : s(std::to_string(v)) {}
  String(unsigned int v) : s(std::to_string(v)) {}
  String(unsigned long v) : s(std::to_string(v)) {}
  String(uint32_t v, int base) { char b[32]; snprintf(b, sizeof b, base == 16 ? "%x" : "%u", (unsigned)v); s = b; }
  String(float v, int dec = 2) { char b[48]; snprintf(b, sizeof b, "%.*f", dec, (double)v); s = b; }
  String(double v, int dec = 2) { char b[48]; snprintf(b, sizeof b, "%.*f", dec, v); s = b; }
  unsigned length() const { return (unsigned)s.size(); }
  const char* c_str() const { return s.c_str(); }
  char operator[](unsigned i) const { return i < s.size() ? s[i] : 0; }
  int indexOf(const String& x, unsigned from = 0) const { auto p = s.find(x.s, from); return p == std::string::npos ? -1 : (int)p; }
  int indexOf(char c, unsigned from = 0) const { auto p = s.find(c, from); return p == std::string::npos ? -1 : (int)p; }
  String substring(unsigned a, unsigned b) const { return String(s.substr(a, b - a)); }
  String substring(unsigned a) const { return String(s.substr(a)); }
  float toFloat() const { return (float)atof(s.c_str()); }
  bool operator==(const String& o) const { return s == o.s; }
  bool operator==(const char* o) const { return s == o; }
  bool operator!=(const char* o) const { return s != o; }
  String& operator+=(const String& o) { s += o.s; return *this; }
  String& operator+=(const char* o) { s += o; return *this; }
  friend String operator+(const String& a, const String& b) { return String(a.s + b.s); }
  friend String operator+(const String& a, const char* b) { return String(a.s + b); }
  friend String operator+(const char* a, const String& b) { return String(std::string(a) + b.s); }
};

class HardwareSerial {
 public:
  bool quiet = true;
  void begin(int) {}
  int available() { return 0; }
  int read() { return -1; }
  void print(const String& x) { if (!quiet) fputs(x.c_str(), stdout); }
  void print(const char* x) { if (!quiet) fputs(x, stdout); }
  void print(float x) { if (!quiet) printf("%.2f", x); }
  void print(uint32_t x) { if (!quiet) printf("%u", x); }
  template <typename T> void println(const T& x) { print(x); if (!quiet) puts(""); }
  void println() { if (!quiet) puts(""); }
  void printf(const char* f, ...) { if (quiet) return; va_list a; va_start(a, f); vprintf(f, a); va_end(a); }
};
extern HardwareSerial Serial;
struct EspClass { uint64_t getEfuseMac() { return 0x1234ABCDULL; } };
extern EspClass ESP;
