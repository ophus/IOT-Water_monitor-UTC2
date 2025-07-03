const UPSTASH_REDIS_URL = "https://your-redis.upstash.io";
const UPSTASH_REDIS_TOKEN = "your_token_here";

async function redisGet(key) {
  try {
    const response = await fetch(`${UPSTASH_REDIS_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}` },
    });
    if (!response.ok) throw new Error(`Failed to fetch Redis key: ${key}`);

    const data = await response.json();
    console.log(`🔍 Redis GET [${key}]:`, data);

    return data.result ? data.result : null;
  } catch (error) {
    console.error("❌ Redis GET error:", error.message);
    return null;
  }
}

async function redisPut(key, value) {
  try {
    const valueToStore = JSON.stringify({ value });
    
    const response = await fetch(`${UPSTASH_REDIS_URL}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: valueToStore,
    });
    
    if (!response.ok) throw new Error(`Failed to update Redis key: ${key}`);
    
    const result = await response.json();
    console.log(`✅ Redis PUT [${key}]: ${valueToStore}, Result:`, result);
    return true;
  } catch (error) {
    console.error("❌ Redis PUT error:", error.message);
    return false;
  }
}

async function redisMGet(keys) {
  try {
    const keysPath = keys.map(key => encodeURIComponent(key)).join('/');
    const response = await fetch(`${UPSTASH_REDIS_URL}/mget/${keysPath}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}` },
    });
    if (!response.ok) throw new Error(`Failed to fetch MGET for keys: ${keys.join(', ')}`);

    const data = await response.json();
    console.log(`🔍 Redis MGET [${keys.join(', ')}]:`, data);

    return data.result || keys.map(() => null);
  } catch (error) {
    console.error("❌ Redis MGET error:", error.message);
    return keys.map(() => null);
  }
}

// ===== FIX TIMEZONE ISSUE - SAME AS PYTHON =====
function convertLocalDateToTimestamp(dateString, isEndOfDay = false) {
  const timeString = isEndOfDay ? "23:59:59" : "00:00:00";
  const localDate = new Date(dateString + "T" + timeString);
  return localDate.getTime();
}

// Đo chế độ: "continuous", "stop", "single"
async function setMeasurementMode(mode) {
  return await redisPut("esp32_measurement_mode", mode);
}

async function getMeasurementMode() {
  const mode = await redisGet("esp32_measurement_mode");
  if (!mode) return "stop"; // Mặc định là dừng
  
  const parsedMode = JSON.parse(mode);
  return parsedMode.value;
}

// Hàm lấy timestamp an toàn từ key
function getTimestampFromKey(key) {
  if (typeof key !== "string") return NaN;
  if (!key.startsWith("sensor_data_")) return NaN;
  const tsStr = key.replace("sensor_data_", "");
  if (!/^[0-9]+$/.test(tsStr)) return NaN;
  return Number(tsStr);
}

// ===== SCAN FUNCTION - EXACTLY LIKE PYTHON =====
async function getAllKeysFromRedis() {
  let allKeys = [];
  let cursor = '0';
  let scanAttempts = 0;
  const maxScanAttempts = 100; // Tăng số lần quét tối đa
  
  console.log('🔍 Starting SCAN operation...');
  
  do {
    try {
      scanAttempts++;
      console.log(`SCAN attempt ${scanAttempts}, cursor: ${cursor}`);
      
      // Sử dụng SCAN với count=1000 giống như Python
      const response = await fetch(`${UPSTASH_REDIS_URL}/scan/${cursor}?count=1000`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}` }
      });
      
      if (!response.ok) {
        console.error(`SCAN request failed: ${response.status}`);
        break;
      }
      
      const data = await response.json();
      
      // Xử lý response format từ Upstash - SAME AS PYTHON
      if (data.result && Array.isArray(data.result) && data.result.length === 2) {
        cursor = String(data.result[0]);
        const keys = data.result[1] || [];
        allKeys.push(...keys);
        console.log(`SCAN found ${keys.length} keys, new cursor: ${cursor}, total keys: ${allKeys.length}`);
      } else {
        console.log('Unexpected SCAN format, breaking');
        break;
      }
      
      if (scanAttempts >= maxScanAttempts) {
        console.log('Max SCAN attempts reached');
        break;
      }
      
      // Tăng giới hạn số keys để không bỏ sót
      if (allKeys.length > 100000) {
        console.log('Max keys limit reached');
        break;
      }
      
    } catch (error) {
      console.error('SCAN error:', error);
      break;
    }
  } while (cursor !== '0' && cursor !== 0);
  
  console.log(`✅ SCAN completed: ${allKeys.length} total keys found in ${scanAttempts} attempts`);
  return allKeys;
}

// ===== BATCH FETCH WITH MGET FOR HIGHER EFFICIENCY =====
async function batchFetchKeys(keys, batchSize = 100) {
  const results = new Map();
  
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    console.log(`Fetching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(keys.length/batchSize)}: ${batch.length} keys with MGET`);
    
    const values = await redisMGet(batch);
    batch.forEach((key, index) => {
      results.set(key, values[index]);
    });
    
    // Optional: small delay for rate limiting
    if (i + batchSize < keys.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Heartbeat endpoint
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/heartbeat") {
      try {
        const timestamp = Date.now();
        await redisPut("esp32_last_heartbeat", timestamp.toString());
        return new Response(JSON.stringify({ 
          success: true, 
          timestamp: timestamp 
        }), { headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 500, headers }
        );
      }
    }

    // Update ESP32 IP
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/update_ip")  {
      try {
        const requestBody = await request.json();
        const { ip } = requestBody;
        
        if (!ip) throw new Error("Missing 'ip' field");
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
          throw new Error("Invalid IP format");
        }

        const success = await redisPut("esp32_ip", ip);
        if (!success) throw new Error("Failed to update IP in Redis");

        console.log(`📌 Updated ESP32 IP: ${ip}`);
        return new Response(JSON.stringify({ success: true, message: "IP updated", ip }), { headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 400, headers }
        );
      }
    }

    // Store command in Redis - to be polled by ESP32
    if (request.method === "POST" && url.pathname === "/command") {
      try {
        // Get ESP32 IP for validation
        const esp32IpData = await redisGet("esp32_ip");
        if (!esp32IpData) throw new Error("ESP32 IP not found. Please update IP first!");
        
        // Get command data from request
        let commandData;
        try {
          commandData = await request.json();
        } catch (error) {
          const text = await request.text();
          try {
            commandData = JSON.parse(text);
          } catch (e) {
            commandData = { data: text };
          }
        }
        
        // Add timestamp to the command
        const commandWithTimestamp = {
          ...commandData,
          timestamp: Date.now(),
          id: `cmd_${Date.now()}_${Math.floor(Math.random() * 1000)}`
        };
        
        // Store command in Redis
        const success = await redisPut("esp32_pending_command", JSON.stringify(commandWithTimestamp));
        if (!success) throw new Error("Failed to store command in Redis");
        
        console.log(`📌 Stored command for ESP32:`, JSON.stringify(commandWithTimestamp));
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Command stored and ready for ESP32 to poll",
          command: commandWithTimestamp
        }), { headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 500, headers }
        );
      }
    }
    
    // New endpoint for ESP32 to poll for commands
    if ((request.method === "GET" || request.method === "POST") && url.pathname === "/poll_command") {
      try {
        // Get any pending command
        const pendingCommandData = await redisGet("esp32_pending_command");
        
        if (pendingCommandData) {
          try {
            // Parse the stored command
            const parsedData = JSON.parse(pendingCommandData);
            const commandValue = parsedData.value;
            
            // Clear the pending command
            await redisPut("esp32_pending_command", "");
            
            console.log(`✅ ESP32 retrieved command:`, commandValue);
            
            // Return the command to the ESP32
            return new Response(commandValue, { 
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
              } 
            });
          } catch (parseError) {
            console.error("Error parsing pending command:", parseError);
            // If parsing fails, return the raw data
            return new Response(pendingCommandData, { 
              headers: {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*"
              } 
            });
          }
        } else {
          // No pending command
          return new Response(JSON.stringify({ 
            success: true, 
            message: "No pending commands" 
          }), { headers });
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 500, headers }
        );
      }
    }

    // Handle data push from ESP32
    if (request.method === "POST" && url.pathname === "/push_data") {
      try {
        let data;
        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          data = await request.json();
        } else {
          const textData = await request.text();
          try {
            data = JSON.parse(textData);
          } catch (parseError) {
            data = { rawData: textData };
          }
        }
        
        console.log("📥 Data received from ESP32:", JSON.stringify(data));
        
        // Save sensor data to Redis
        const timestamp = Date.now();
        const key = `sensor_data_${timestamp}`;
        await redisPut(key, JSON.stringify(data));
        console.log(`✅ Sensor data stored in Redis with key: ${key}`);
        
        // Save latest key for quick access
        await redisPut("latest_sensor_data_key", key);
        
        try {
          const webResponse = await fetch("https://ophus.site/receive_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          
          if (!webResponse.ok) {
            throw new Error(`Failed to forward data: ${webResponse.status}`);
          }
          
          console.log("✅ Data successfully forwarded to web application");
        } catch (error) {
          console.error("❌ Failed to forward data:", error.message);
          // Continue anyway to acknowledge receipt to ESP32
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Data received and stored successfully" 
        }), { headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 500, headers }
        );
      }
    }

    // Get latest sensor data - Updated with heartbeat check
    if (request.method === "GET" && url.pathname === "/get_latest_sensor_data") {
      try {
        // Kiểm tra heartbeat
        const heartbeatData = await redisGet("esp32_last_heartbeat");
        let esp32Connected = false;
        
        if (heartbeatData) {
          const parsedHeartbeat = JSON.parse(heartbeatData);
          const lastHeartbeat = parseInt(parsedHeartbeat.value);
          const currentTime = Date.now();
          
          // ESP32 được coi là đã ngắt kết nối nếu không có heartbeat trong 30 giây
          esp32Connected = (currentTime - lastHeartbeat) < 30000;
        }
        
        if (!esp32Connected) {
          // Trả về dữ liệu 0 nếu ESP32 không được kết nối
          return new Response(JSON.stringify({
            success: true,
            data: {
              temperature: 0,
              ph: 0,
              tds: 0,
              turbidity: 0
            },
            esp32Connected: false
          }), { headers });
        }
        
        // Phần còn lại của mã không thay đổi...
        const latestKey = await redisGet("latest_sensor_data_key");
        if (!latestKey) {
          return new Response(JSON.stringify({
            success: false,
            message: "No sensor data available"
          }), { headers });
        }
        
        const parsedKey = JSON.parse(latestKey);
        const dataKey = parsedKey.value;
        
        const sensorData = await redisGet(dataKey);
        if (!sensorData) {
          return new Response(JSON.stringify({
            success: false,
            message: "Sensor data not found"
          }), { headers });
        }
        
        const parsedData = JSON.parse(sensorData);
        
        return new Response(JSON.stringify({
          success: true,
          data: JSON.parse(parsedData.value),
          timestamp: getTimestampFromKey(dataKey),
          esp32Connected: true
        }), { headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    }

    // Get latest command result
    if (request.method === "GET" && url.pathname === "/command_result") {
      try {
        const resultData = await redisGet("esp32_command_result");
        
        if (resultData) {
          try {
            const parsedData = JSON.parse(resultData);
            return new Response(JSON.stringify({ 
              success: true, 
              result: parsedData.value 
            }), { headers });
          } catch (parseError) {
            return new Response(JSON.stringify({ 
              success: true, 
              result: resultData 
            }), { headers });
          }
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "No command result available" 
          }), { headers });
        }
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 500, headers }
        );
      }
    }

    // Store command result
    if (request.method === "POST" && url.pathname === "/command_result") {
      try {
        let resultData;
        try {
          resultData = await request.json();
        } catch (error) {
          const text = await request.text();
          try {
            resultData = JSON.parse(text);
          } catch (e) {
            resultData = { data: text };
          }
        }
        
        // Store the result in Redis
        const success = await redisPut("esp32_command_result", JSON.stringify(resultData));
        if (!success) throw new Error("Failed to store command result in Redis");
        
        console.log(`📌 Stored command result from ESP32:`, JSON.stringify(resultData));
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Command result stored successfully" 
        }), { headers });
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }), 
          { status: 500, headers }
        );
      }
    }

    // ===== COMPLETELY REWRITTEN HISTORICAL DATA ENDPOINT - LIKE PYTHON =====
    if (request.method === "GET" && url.pathname === "/get_historical_data") {
      try {
        const { searchParams } = url;
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        
        console.log(`📊 Historical data request: ${startDate} to ${endDate} (NO LIMIT)`);

        // ===== TIMESTAMP CALCULATION - SAME AS PYTHON =====
        let startTimestamp, endTimestamp;
        if (startDate) {
          startTimestamp = convertLocalDateToTimestamp(startDate, false);
        } else {
          startTimestamp = 0;
        }
        if (endDate) {
          endTimestamp = convertLocalDateToTimestamp(endDate, true);
        } else {
          endTimestamp = Date.now();
        }

        console.log(`🕐 Timestamp range: ${startTimestamp} to ${endTimestamp}`);

        // ===== GET ALL KEYS USING SCAN - EXACTLY LIKE PYTHON =====
        const allKeys = await getAllKeysFromRedis();
        console.log(`📋 Total keys scanned: ${allKeys.length}`);

        // ===== FILTER SENSOR_DATA KEYS - SAME AS PYTHON =====
        const sensorKeys = allKeys.filter(key => key.startsWith('sensor_data_') && /^sensor_data_\d+$/.test(key));
        console.log(`🔍 Total sensor keys found: ${sensorKeys.length}`);

        // ===== FILTER BY TIMESTAMP RANGE - SAME AS PYTHON =====
        const filteredKeys = sensorKeys.filter(key => {
          try {
            const timestamp_ms = parseInt(key.replace('sensor_data_', ''));
            return timestamp_ms >= startTimestamp && timestamp_ms <= endTimestamp;
          } catch (e) {
            return false;
          }
        });
        
        console.log(`📊 Filtered keys in date range: ${filteredKeys.length}`);

        if (filteredKeys.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            data: [],
            debug: {
              totalKeys: allKeys.length,
              totalSensorKeys: sensorKeys.length,
              filteredKeys: filteredKeys.length,
              startTimestamp,
              endTimestamp,
              dateRange: [new Date(startTimestamp).toISOString(), new Date(endTimestamp).toISOString()]
            }
          }), { headers });
        }

        // ===== SORT KEYS - SAME AS PYTHON (NEWEST FIRST) =====
        const sortedKeys = filteredKeys.sort((a, b) => {
          const timestampA = parseInt(a.replace('sensor_data_', ''));
          const timestampB = parseInt(b.replace('sensor_data_', ''));
          return timestampB - timestampA; // Newest first
        });

        // ===== LIMIT TO 200 MOST RECENT =====
        const limitedKeys = sortedKeys.slice(0, 200);

        console.log(`📥 Fetching ${limitedKeys.length} records (limited to 200)`);

        // ===== BATCH FETCH WITH MGET =====
        const fetchedData = await batchFetchKeys(limitedKeys, 100);
        console.log(`✅ Successfully fetched ${fetchedData.size} records`);

        // ===== PROCESS DATA - SAME LOGIC AS PYTHON =====
        const processedData = [];
        for (const [key, value] of fetchedData) {
          try {
            const timestamp_ms = parseInt(key.replace('sensor_data_', ''));
            const timestamp = new Date(timestamp_ms);
            
            let sensorData;
            if (value) {
              try {
                const parsedValue = JSON.parse(value);
                sensorData = parsedValue.value ? JSON.parse(parsedValue.value) : parsedValue;
              } catch (e) {
                sensorData = { temperature: 0, ph: 0, tds: 0, turbidity: 0 };
              }
            } else {
              sensorData = { temperature: 0, ph: 0, tds: 0, turbidity: 0 };
            }
            
            processedData.push({
              timestamp: timestamp_ms,
              date: timestamp.toISOString().split('T')[0],
              time: timestamp.toTimeString().split(' ')[0],
              datetime_full: timestamp.toLocaleString('vi-VN'),
              temperature: sensorData.temperature || 0,
              ph: sensorData.ph || 0,
              tds: sensorData.tds || 0,
              turbidity: sensorData.turbidity || 0
            });
            
          } catch (error) {
            console.error(`Error processing ${key}:`, error);
            const timestamp_ms = parseInt(key.replace('sensor_data_', ''));
            const timestamp = new Date(timestamp_ms);
            
            processedData.push({
              timestamp: timestamp_ms,
              date: timestamp.toISOString().split('T')[0],
              time: timestamp.toTimeString().split(' ')[0],
              datetime_full: timestamp.toLocaleString('vi-VN'),
              temperature: 0,
              ph: 0,
              tds: 0,
              turbidity: 0
            });
          }
        }

        console.log(`✅ Final processed data count: ${processedData.length}`);

        return new Response(JSON.stringify({
          success: true,
          data: processedData,
          debug: {
            totalKeys: allKeys.length,
            sensorKeys: sensorKeys.length,
            filteredKeys: filteredKeys.length,
            fetchedKeys: limitedKeys.length,
            processedRecords: processedData.length,
            dateRange: [startDate, endDate],
            timestampRange: [startTimestamp, endTimestamp]
          }
        }), { headers });
        
      } catch (error) {
        console.error("❌ Historical data error:", error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: error.message,
            stack: error.stack 
          }),
          { status: 500, headers }
        );
      }
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }), 
      { status: 405, headers }
    );
  },
};
