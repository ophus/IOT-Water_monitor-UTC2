async function getData() {
    try {
        const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/");
        const data = await response.json();

        if (data.error) {
            console.warn(`⚠️ Lỗi từ server: ${data.error}`);
            showZeroData();
            return;
        }

        // 🔵 Nếu tất cả giá trị là 0 → Hiển thị 0 thay vì "ESP32 mất nguồn"
        if (data.temperature == 0 && data.ph == 0 && data.tds == 0 && data.turbidity == 0) {
            console.warn("⚠️ ESP32 mất nguồn!");
            showZeroData();
            return;
        }

        updateElement("tempValue", `${data.temperature} °C`);
        updateElement("phValue", `${data.ph}`);
        updateElement("tdsValue", `${data.tds} PPM`);
        updateElement("turbidityValue", `${data.turbidity} NTU`);
    } catch (error) {
        console.error("❌ Fetch error:", error);
        showZeroData();
    }
}

// 🔴 Khi mất kết nối hoặc ESP32 mất nguồn, hiển thị số 0
function showZeroData() {
    updateElement("tempValue", "0 °C");
    updateElement("phValue", "0");
    updateElement("tdsValue", "0 PPM");
    updateElement("turbidityValue", "0 NTU");
}

setInterval(getData, 5000);
