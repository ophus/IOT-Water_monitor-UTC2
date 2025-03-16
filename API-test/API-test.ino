#include <WiFiManager.h>  // Quản lý WiFi tự động
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
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

Preferences preferences;
WebServer server(80);
DFRobot_PH ph;
OneWire oneWire(TEMP_PIN);
DallasTemperature sensors(&oneWire);

String serverUrl = "";  // Lưu API URL
bool isMeasuring = false;  // Biến theo dõi trạng thái đo

void handleRoot() {
    String html = "<h1>Cấu hình WiFi và API</h1>";
    html += "<form action='/set_api' method='POST'>";
    html += "API URL: <input type='text' name='api'><br>";
    html += "<input type='submit' value='Lưu'>";
    html += "</form>";
    server.send(200, "text/html", html);
}

void handleSetAPI() {
    String newApi = server.arg("api");

    if (newApi.length() > 0) {
        preferences.begin("config", false);
        preferences.putString("api_url", newApi);
        preferences.end();

        server.send(200, "text/html", "<h1>API đã được lưu! Khởi động lại...</h1>");
        delay(2000);
        ESP.restart();
    } else {
        server.send(400, "text/html", "<h1>Lỗi! Vui lòng nhập API URL.</h1>");
    }
}

void sendDataToServer(float temp, float ph, float tds, float turbidity) {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin("https://esp32-data-receiver.phucminh9395.workers.dev");
        http.addHeader("Content-Type", "application/json");

        String jsonPayload = "{";
        jsonPayload += "\"temperature\":" + String(temp, 2) + ",";
        jsonPayload += "\"ph\":" + String(ph, 2) + ",";
        jsonPayload += "\"tds\":" + String(tds, 2) + ",";
        jsonPayload += "\"turbidity\":" + String(turbidity, 2);
        jsonPayload += "}";

        Serial.println("📤 Sending JSON: " + jsonPayload);

        int httpResponseCode = http.POST(jsonPayload);
        String response = http.getString();

        Serial.print("🔄 HTTP Response Code: ");
        Serial.println(httpResponseCode);
        Serial.println("📥 Server Response: " + response);

        http.end();
    } else {
        Serial.println("❌ WiFi not connected!");
    }
}


// Bắt đầu đo
void handleStartMeasure() {
    isMeasuring = true;
     Serial.println("✅ Nhận yêu cầu: Bắt đầu đo!");
    server.send(200, "application/json", "{\"message\":\"Bắt đầu đo!\"}");
}

// Dừng đo
void handleStopMeasure() {
    isMeasuring = false;
    Serial.println("✅ Nhận yêu cầu: DỪNG ĐO!");
    server.send(200, "application/json", "{\"message\":\"Đã dừng đo!\"}");
}

// Lấy địa chỉ IP của ESP32
void handleGetIP() {
    server.send(200, "application/json", "{\"ip\":\"" + WiFi.localIP().toString() + "\"}");
}

// Lấy dữ liệu từ cảm biến
void handleGetData() {
    if (!isMeasuring) {
        server.send(200, "application/json", "{\"message\":\"Dừng đo, không có dữ liệu!\"}");
        return;
    }

    // Dữ liệu giả lập
    float temperature = random(200, 350) / 10.0; // Nhiệt độ từ 20.0 - 35.0°C
    float phValue = random(65, 85) / 10.0; // pH từ 6.5 - 8.5
    float tdsValue = random(100, 500); // TDS từ 100 - 500 ppm
    float turbidity = random(0, 50) / 10.0; // Độ đục từ 0.0 - 5.0 NTU

    // Gửi dữ liệu lên web
    sendDataToServer(temperature, phValue, tdsValue, turbidity);

    // Tạo JSON phản hồi
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
    WiFiManager wifiManager;

    // Nếu muốn reset WiFi, bật dòng dưới:
    // wifiManager.resetSettings();

    if (!wifiManager.autoConnect("ESP32_Config", "12345678")) {
        Serial.println("Không kết nối được WiFi, khởi động lại ESP32...");
        delay(3000);
        ESP.restart();
    }

    Serial.println("WiFi đã kết nối!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());

    // Lấy API URL từ EEPROM
    preferences.begin("config", true);
    serverUrl = preferences.getString("api_url", "https://esp32-data-receiver.phucminh9395.workers.dev");
    preferences.end();
    Serial.println("API URL hiện tại: " + serverUrl);

    // Đăng ký API
    server.on("/", handleRoot);
    server.on("/set_api", HTTP_POST, handleSetAPI);
    server.on("/start_measure", HTTP_GET, handleStartMeasure);
    server.on("/stop_measure", HTTP_GET, handleStopMeasure);
    server.on("/get_data", HTTP_GET, handleGetData);
    server.on("/get_ip", HTTP_GET, handleGetIP);

    server.begin();
}

void loop() {
    server.handleClient();
}
