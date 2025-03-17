#include <WiFiManager.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

#define UPDATE_INTERVAL 600000 // 10 phút
#define POLL_INTERVAL 10000    // 10 giây
#define DATA_SEND_INTERVAL 5000  // Send data every 5 seconds

Preferences preferences;
WebServer server(80);
String workerUrl = "https://esp32-data-receiver.phucminh9395.workers.dev";
unsigned long lastUpdateTime = 0;
unsigned long lastPollTime = 0;
unsigned long lastDataSendTime = 0;
bool sendDataEnabled = false;
bool continuousMeasurement = false;

void sendIPToWorker() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(workerUrl + "/update_ip");
        http.addHeader("Content-Type", "application/json");
        String jsonPayload = "{\"ip\":\"" + WiFi.localIP().toString() + "\"}";
        Serial.println("📤 Gửi IP lên Worker: " + jsonPayload);
        int httpResponseCode = http.POST(jsonPayload);
        Serial.print("📤 Mã phản hồi: ");
        Serial.println(httpResponseCode);
        http.end();
    }
}

void checkAndUpdateIP() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ Mất kết nối WiFi! Thử kết nối lại...");
        WiFi.reconnect();
        delay(5000);
        if (WiFi.status() != WL_CONNECTED) {
            Serial.println("🚨 WiFi vẫn không kết nối, khởi động lại ESP32!");
            ESP.restart();
        }
    } else if (millis() - lastUpdateTime > UPDATE_INTERVAL) {
        sendIPToWorker();
        lastUpdateTime = millis();
    }
}

String getSensorData() {
    float temperature = random(200, 350) / 10.0;
    float phValue = random(65, 85) / 10.0;
    float tdsValue = random(100, 500);
    float turbidity = random(0, 50) / 10.0;
    DynamicJsonDocument doc(512);
    doc["temperature"] = temperature;
    doc["ph"] = phValue;
    doc["tds"] = tdsValue;
    doc["turbidity"] = turbidity;
    String json;
    serializeJson(doc, json);
    return json;
}

void sendSensorDataToWorker() {
    if (WiFi.status() == WL_CONNECTED) {
        HTTPClient http;
        http.begin(workerUrl + "/push_data");
        http.addHeader("Content-Type", "application/json");
        String jsonPayload = getSensorData();
        Serial.println("📤 Gửi dữ liệu cảm biến: " + jsonPayload);
        int httpResponseCode = http.POST(jsonPayload);
        Serial.print("📤 Mã phản hồi: ");
        Serial.println(httpResponseCode);
        if (httpResponseCode == HTTP_CODE_OK) {
            String response = http.getString();
            Serial.print("📤 Phản hồi: ");
            Serial.println(response);
        } else {
            Serial.print("❌ Lỗi gửi dữ liệu, mã: ");
            Serial.println(httpResponseCode);
        }
        http.end();
    } else {
        Serial.println("❌ WiFi không kết nối, không thể gửi dữ liệu!");
    }
}

void pollForCommands() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi không kết nối, không thể thăm dò lệnh!");
        return;
    }
    
    Serial.println("📥 Đang thăm dò lệnh...");
    HTTPClient http;
    http.begin(workerUrl + "/poll_command");
    http.addHeader("Content-Type", "application/json");
    int httpResponseCode = http.POST("{}");
    Serial.print("📥 Mã phản hồi: ");
    Serial.println(httpResponseCode); 
    if (httpResponseCode == HTTP_CODE_OK) {
        String response = http.getString();
        Serial.print("📥 Dữ liệu JSON thô: ");
        Serial.println(response);
        
        // Kiểm tra xem response có rỗng hoặc không phải JSON không
        if (response.length() == 0 || response.equals("{}") || response.equals("[]")) {
            Serial.println("📥 Không có lệnh mới.");
            http.end();
            return;
        }
        
        DynamicJsonDocument doc(512); // Tăng kích thước buffer
        DeserializationError error = deserializeJson(doc, response);
        
        if (!error) {
            // Kiểm tra xem JSON có chứa các chữ số là key không (format từ worker)
            if (doc.containsKey("0")) {
                // Xây dựng lại lệnh từ các ký tự riêng lẻ
                String action = "";
                int index = 0;
                char indexStr[3];
                while (true) {
                    sprintf(indexStr, "%d", index);
                    if (!doc.containsKey(indexStr)) break;
                    action += doc[indexStr].as<String>();
                    index++;
                }
                
                Serial.print("✅ Đã tạo lại lệnh từ các ký tự riêng lẻ: ");
                Serial.println(action);
                
                if (action.length() > 0) {
                    String result = executeCommand(action);
                    sendCommandResult(action, result);
                }
            }
            // Vẫn giữ lại kiểm tra action cũ nếu format thay đổi trong tương lai
            else if (doc.containsKey("action")) {
                String action = doc["action"].as<String>();
                Serial.print("✅ Thực thi lệnh: ");
                Serial.println(action);
                String result = executeCommand(action);
                sendCommandResult(action, result);
            } else {
                Serial.println("❌ JSON không theo định dạng mong đợi!");
            }
        } else {
            Serial.print("❌ Lỗi phân tích JSON: ");
            Serial.println(error.c_str());
        }
    } else {
        Serial.println("❌ Không thể thăm dò lệnh.");
    }
    http.end();
}

String executeCommand(String action) {
    if (action == "measure") {
        continuousMeasurement = true;
        Serial.println("✅ Continuous measurement enabled");
        return "Measurement started";
    } else if (action == "test") {
        // Single measurement
        sendSensorDataToWorker();
        Serial.println("✅ Single test measurement sent");
        return "Test measurement completed";
    } else if (action == "stop") {
        continuousMeasurement = false;
        Serial.println("⏹️ Measurement stopped");
        return "Measurement stopped";
    } else if (action == "restart") {
        Serial.println("🔄 Đang khởi động lại ESP32...");
        delay(1000);
        ESP.restart();
        return "Restarting device";
    } else if (action == "status") {
        String status = "WiFi: " + String(WiFi.RSSI()) + " dBm, IP: " + WiFi.localIP().toString();
        return status;
    }
    return "Unknown command: " + action;
}

void sendCommandResult(String action, String result) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi không kết nối, không thể gửi kết quả!");
        return;
    }
    
    HTTPClient http;
    http.begin(workerUrl + "/command_result");
    http.addHeader("Content-Type", "application/json");
    
    DynamicJsonDocument doc(512);
    doc["action"] = action;
    doc["result"] = result;
    String json;
    serializeJson(doc, json);
    
    Serial.println("📤 Gửi kết quả lệnh: " + json);
    int httpResponseCode = http.POST(json);
    Serial.print("📤 Mã phản hồi: ");
    Serial.println(httpResponseCode);
    http.end();
}

void handleCommand() {
    if (server.hasArg("plain")) {
        String requestBody = server.arg("plain");
        Serial.println("📥 Lệnh nhận được: " + requestBody);
        
        DynamicJsonDocument doc(512);
        DeserializationError error = deserializeJson(doc, requestBody);
        
        if (error) {
            Serial.print("❌ Lỗi phân tích JSON từ yêu cầu web: ");
            Serial.println(error.c_str());
            server.send(400, "application/json", "{\"error\": \"Invalid JSON: " + String(error.c_str()) + "\"}");
            return;
        }
        
        if (!doc.containsKey("action")) {
            server.send(400, "application/json", "{\"error\": \"Missing 'action' field\"}");
            return;
        }
        
        String action = doc["action"].as<String>();
        String result = executeCommand(action);
        server.send(200, "application/json", "{\"message\": \"" + result + "\"}");
    } else {
        server.send(400, "application/json", "{\"error\": \"No command received\"}");
    }
}

void handleRoot() {
    String html = "<html><head><title>ESP32 Monitoring System</title>";
    html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
    html += "<style>body{font-family:Arial;margin:0;padding:20px;text-align:center;}";
    html += "h1{color:#0066cc;}button{background:#0066cc;color:white;border:none;padding:10px 20px;margin:10px;border-radius:5px;cursor:pointer;}";
    html += "button:hover{background:#004c99;}</style></head><body>";
    html += "<h1>ESP32 Water Monitoring System</h1>";
    html += "<p>IP: " + WiFi.localIP().toString() + "</p>";
    html += "<p>WiFi Signal: " + String(WiFi.RSSI()) + " dBm</p>";
    html += "<button onclick='sendCommand(\"measure\")'>Bắt Đầu Đo Liên Tục</button>";
    html += "<button onclick='sendCommand(\"test\")'>Đo Thử Một Lần</button>";
    html += "<button onclick='sendCommand(\"stop\")'>Dừng Đo</button>";
    html += "<button onclick='sendCommand(\"status\")'>Trạng Thái</button>";
    html += "<button onclick='sendCommand(\"restart\")'>Khởi Động Lại</button>";
    html += "<div id='result' style='margin-top:20px;padding:10px;background:#f0f0f0;border-radius:5px;'></div>";
    html += "<script>";
    html += "function sendCommand(cmd) {";
    html += "  document.getElementById('result').innerHTML = 'Đang xử lý...'";
    html += "  fetch('/command', {";
    html += "    method: 'POST',";
    html += "    headers: {'Content-Type': 'application/json'},";
    html += "    body: JSON.stringify({action: cmd})";
    html += "  })";
    html += "  .then(response => response.json())";
    html += "  .then(data => {";
    html += "    document.getElementById('result').innerHTML = 'Kết quả: ' + JSON.stringify(data)";
    html += "  })";
    html += "  .catch(error => {";
    html += "    document.getElementById('result').innerHTML = 'Lỗi: ' + error";
    html += "  });";
    html += "}";
    html += "</script></body></html>";
    server.send(200, "text/html", html);
}

void setup() {
    Serial.begin(115200);
    Serial.println("\n\n=== ESP32 Water Monitoring System ===");
    
    // Kết nối WiFi
    WiFiManager wifiManager;
    wifiManager.setConfigPortalTimeout(180); // timeout sau 3 phút
    
    if (!wifiManager.autoConnect("ESP32_Water_Monitor", "12345678")) {
        Serial.println("❌ Không thể kết nối WiFi. Khởi động lại...");
        delay(3000);
        ESP.restart();
    }
    
    Serial.println("✅ Kết nối WiFi thành công!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    // Thiết lập các route cho webserver
    server.on("/", HTTP_GET, handleRoot);
    server.on("/command", HTTP_POST, handleCommand);
    server.begin();
    Serial.println("✅ Máy chủ web đã khởi động");
    
    // Gửi IP hiện tại lên worker
    sendIPToWorker();
}

void loop() {
    server.handleClient();
    checkAndUpdateIP();
    
    // Chỉ thăm dò lệnh sau mỗi khoảng thời gian nhất định
    if (millis() - lastPollTime > POLL_INTERVAL) {
        pollForCommands();
        lastPollTime = millis();
    }
    
    // Send sensor data at regular intervals when continuous measurement is enabled
    if (continuousMeasurement && millis() - lastDataSendTime > DATA_SEND_INTERVAL) {
        sendSensorDataToWorker();
        lastDataSendTime = millis();
    }
}
