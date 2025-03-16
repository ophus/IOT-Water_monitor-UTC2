async function getData() {
    try {
        const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            mode: "cors",
            cache: "no-cache"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error("Lỗi khi phân tích JSON: " + jsonError.message);
        }

        console.log("📥 Received data:", data);

        if (data.error) {
            console.warn(`⚠️ Lỗi từ server: ${data.error}`);
            showNoData();
            return;
        }

        // Kiểm tra nếu tất cả giá trị đều bằng 0 -> ESP32 mất nguồn
        if (data.temperature == 0 && data.ph == 0 && data.tds == 0 && data.turbidity == 0) {
            console.warn("⚠️ ESP32 có thể đã tắt nguồn! Đang hiển thị 'Không có dữ liệu'");
            showNoData();
            return;
        }

        updateElement("tempValue", `${data.temperature ?? "N/A"} °C`);
        updateElement("phValue", `${data.ph ?? "N/A"}`);
        updateElement("tdsValue", `${data.tds ?? "N/A"} PPM`);
        updateElement("turbidityValue", `${data.turbidity ?? "N/A"} NTU`);
    } catch (error) {
        console.error("❌ Fetch error:", error);
        showNoData();
    }
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = value;
    } else {
        console.warn(`⚠️ Không tìm thấy phần tử: ${id}`);
    }
}

function showNoData() {
    updateElement("tempValue", "-- °C");
    updateElement("phValue", "--");
    updateElement("tdsValue", "-- PPM");
    updateElement("turbidityValue", "-- NTU");
}

setInterval(getData, 5000);
