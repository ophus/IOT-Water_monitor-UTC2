async function getData() {
    try {
        const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/");
        const data = await response.json();

        if (data.error) {
            console.warn(`⚠️ Lỗi từ server: ${data.error}`);
            showNoData();
            return;
        }

        // 🔵 Nếu tất cả giá trị là 0 → Hiển thị mất nguồn
        if (data.temperature == 0 && data.ph == 0 && data.tds == 0 && data.turbidity == 0) {
            console.warn("⚠️ ESP32 mất nguồn!");
            updateElement("tempValue", "ESP32 mất nguồn");
            updateElement("phValue", "ESP32 mất nguồn");
            updateElement("tdsValue", "ESP32 mất nguồn");
            updateElement("turbidityValue", "ESP32 mất nguồn");
            return;
        }

        updateElement("tempValue", `${data.temperature} °C`);
        updateElement("phValue", `${data.ph}`);
        updateElement("tdsValue", `${data.tds} PPM`);
        updateElement("turbidityValue", `${data.turbidity} NTU`);
    } catch (error) {
        console.error("❌ Fetch error:", error);
        showNoData();
    }
}
setInterval(getData, 5000);
