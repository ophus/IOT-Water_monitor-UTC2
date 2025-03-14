#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <math.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include "DFRobot_PH.h"
#include <EEPROM.h>

#define LED_PIN 2   
#define PH_PIN 34   
#define TEMP_PIN 32 
#define TDS_PIN 33  
#define TUR_PIN 35  
#define RELAY_PIN1 4
#define RELAY_PIN2 5 

#define VREF 3.3         
#define SCOUNT 15        
#define BETA 3950  
#define SERIES_RESISTOR 10000  
#define CONVERSION_FACTOR 0.5  

const char* apSSID = "ESP32_Config";
const char* apPassword = "12345678";
const char* serverUrl = "https://esp32-data-receiver.phucminh9395.workers.dev";

WebServer server(80);
Preferences preferences;
DFRobot_PH ph;
OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);
bool isMeasuring = false;

void handleRoot() {
    String html = "<h1>Cấu hình WiFi</h1>";
    html += "<form action='/save' method='POST'>";
    html += "SSID: <input type='text' name='ssid'><br>";
    html += "Password: <input type='password' name='password'><br>";
    html += "<input type='submit' value='Lưu'>";
    html += "</form>";
    server.send(200, "text/html", html);
}

void handleSave() {
    String ssid = server.arg("ssid");
    String password = server.arg("password");

    if (ssid.length() > 0 && password.length() > 0) {
        preferences.begin("wifi", false);
        preferences.putString("ssid", ssid);
        preferences.putString("password", password);
        preferences.end();

        server.send(200, "text/html", "<h1>WiFi đã được lưu! Khởi động lại...</h1>");
        delay(2000);
        ESP.restart();
    } else {
        server.send(400, "text/html", "<h1>Lỗi! Vui lòng nhập SSID và Password.</h1>");
    }
}

void sendDataToServer(float temp, float ph, float tds, float turbidity) {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin("https://esp32-data-receiver.phucminh9395.workers.dev/");  // Đảm bảo đúng URL
        http.addHeader("Content-Type", "application/json");
        http.addHeader("X-API-KEY", "1CAF4319F1BAEC357FD8D55C37DA7");  // Nếu dùng API Key

        String jsonPayload = "{";
        jsonPayload += "\"temperature\":" + String(temp, 2) + ",";
        jsonPayload += "\"ph\":" + String(ph, 2) + ",";
        jsonPayload += "\"tds\":" + String(tds, 2) + ",";
        jsonPayload += "\"turbidity\":" + String(turbidity, 2);
        jsonPayload += "}";

        int httpResponseCode = http.POST(jsonPayload);  // Đảm bảo dùng POST
        Serial.print("HTTP Response code: ");
        Serial.println(httpResponseCode);
        http.end();
    } else {
        Serial.println("WiFi not connected!");
    }
}

void handleTestSensor() {
    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);
    int phRaw = analogRead(PH_PIN);
    float phVoltage = (phRaw / 4095.0) * 5000;
    float phValue = ph.readPH(phVoltage, temperature);
    int tdsRaw = analogRead(TDS_PIN);
    float voltage = (tdsRaw / 4095.0) * VREF;
    float tdsValue = 973 * voltage / (1.0 + 0.02 * (temperature - 25));
    int turRaw = analogRead(TUR_PIN);
    float turbidity = (turRaw / 4095.0) * 100.0;

    Serial.print("Nhiệt độ: "); Serial.print(temperature); Serial.println(" °C");
    Serial.print("pH: "); Serial.println(phValue);
    Serial.print("TDS: "); Serial.print(tdsValue); Serial.println(" ppm");
    Serial.print("Độ đục: "); Serial.print(turbidity); Serial.println(" %");

    sendDataToServer(temperature, phValue, tdsValue, turbidity);
    
    String json = "{";
    json += "\"temperature\":" + String(temperature, 2) + ",";
    json += "\"ph\":" + String(phValue, 2) + ",";
    json += "\"tds\":" + String(tdsValue, 2) + ",";
    json += "\"turbidity\":" + String(turbidity, 2);
    json += "}";
    
    server.send(200, "application/json", json);
}

void setup() {
    Serial.begin(115200);
    preferences.begin("wifi", true);
    String savedSSID = preferences.getString("ssid", "");
    String savedPassword = preferences.getString("password", "");
    preferences.end();

    if (savedSSID != "" && savedPassword != "") {
        WiFi.begin(savedSSID.c_str(), savedPassword.c_str());
        int timeout = 20;
        while (WiFi.status() != WL_CONNECTED && timeout > 0) {
            delay(1000);
            timeout--;
        }
        if (WiFi.status() == WL_CONNECTED) {
            Serial.println("WiFi đã kết nối!");
            Serial.println(WiFi.localIP());
        }
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        WiFi.softAP(apSSID, apPassword);
        Serial.print("ESP32 AP IP: ");
        Serial.println(WiFi.softAPIP());
    }

    server.on("/", handleRoot);
    server.on("/save", HTTP_POST, handleSave);
    server.on("/test_sensor", HTTP_GET, handleTestSensor);
    server.begin();
}

void loop() {
    server.handleClient();
}
