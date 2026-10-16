#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Keypad.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include "config.h"

// onboard rgb led on the esp32-s3 devkit, some clones use 38 instead
const int RGB_LED_PIN = 48;
const int RELAY_PIN = 21;
// most cheap relay modules switch on LOW, set false if yours switches on HIGH
const bool RELAY_ACTIVE_LOW = true;
const int OPEN_MS = 5000;
const int WIFI_RETRY_MS = 10000;

const byte KEYPAD_ROWS = 4;
const byte KEYPAD_COLS = 4;
char keys[KEYPAD_ROWS][KEYPAD_COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'},
};
byte rowPins[KEYPAD_ROWS] = {4, 5, 6, 7};
byte colPins[KEYPAD_COLS] = {15, 16, 17, 18};
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, KEYPAD_ROWS, KEYPAD_COLS);

String pinBuffer = "";
unsigned long lastWifiAttempt = 0;
WiFiClientSecure secureClient;

void setLed(uint8_t r, uint8_t g, uint8_t b) {
  rgbLedWrite(RGB_LED_PIN, r, g, b);
}

void blink(uint8_t r, uint8_t g, uint8_t b, int times) {
  for (int i = 0; i < times; i++) {
    setLed(r, g, b);
    delay(200);
    setLed(0, 0, 0);
    delay(200);
  }
}

// the only network code, swap this for ETH.begin() if the lock moves to ethernet
void connectNetwork() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }
  lastWifiAttempt = millis();
  Serial.print("connecting to wifi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("connected, ip: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("wifi failed, will retry");
  }
}

void setRelay(bool on) {
  digitalWrite(RELAY_PIN, on != RELAY_ACTIVE_LOW ? HIGH : LOW);
}

void openDoor() {
  setRelay(true);
  setLed(0, 40, 0);
  delay(OPEN_MS);
  setRelay(false);
  setLed(0, 0, 0);
}

// these only work while the server is down, and those entries aren't logged
bool isOfflinePin(const String &pin) {
  for (const char *offlinePin : OFFLINE_PINS) {
    if (pin == offlinePin) {
      return true;
    }
  }
  return false;
}

void serverUnreachable(const String &pin) {
  if (isOfflinePin(pin)) {
    Serial.println("server unreachable, opening with offline pin");
    openDoor();
  } else {
    blink(0, 0, 40, 3);
  }
}

void submitPin(const String &pin) {
  connectNetwork();
  if (WiFi.status() != WL_CONNECTED) {
    serverUnreachable(pin);
    return;
  }

  String url = String(SERVER_URL) + "/api/lock/verify";
  HTTPClient http;
  http.setTimeout(5000);
  if (url.startsWith("https")) {
    http.begin(secureClient, url);
  } else {
    http.begin(url);
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + LOCK_API_KEY);

  int status = http.POST("{\"pin\":\"" + pin + "\"}");
  if (status != 200) {
    Serial.printf("server error: %d\n", status);
    http.end();
    serverUnreachable(pin);
    return;
  }

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, http.getString());
  http.end();
  if (err) {
    Serial.println("bad response from server");
    serverUnreachable(pin);
    return;
  }

  if (doc["data"]["open"]) {
    Serial.printf("welcome %s\n", doc["data"]["name"].as<const char *>());
    openDoor();
  } else {
    Serial.printf("denied: %s\n", doc["data"]["reason"].as<const char *>());
    blink(40, 0, 0, 2);
  }
}

// same handler for the keypad and the serial monitor
void handleKey(char key) {
  if (isDigit(key) && pinBuffer.length() < 6) {
    pinBuffer += key;
  } else if (key == '*') {
    pinBuffer = "";
  } else if (key == '#' || key == '\n') {
    if (pinBuffer.length() == 6) {
      submitPin(pinBuffer);
    } else if (pinBuffer.length() > 0) {
      Serial.println("pin must be 6 digits");
      blink(40, 0, 0, 1);
    }
    pinBuffer = "";
  }
}

void setup() {
  // first thing in setup so the door stays shut on boot
  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false);
  Serial.begin(115200);
  setLed(0, 0, 0);
  secureClient.setCACert(ROOT_CA);
  connectNetwork();
  Serial.println("type a 6 digit pin on the keypad or here, then # or enter");
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    handleKey(key);
  }

  while (Serial.available()) {
    handleKey(Serial.read());
  }

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiAttempt > WIFI_RETRY_MS) {
    connectNetwork();
  }
}
