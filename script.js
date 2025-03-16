async function getData() {
    try {
        const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/", {
            method: "GET", // Đổi thành GET nếu API không cần POST
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json" // Đảm bảo server phản hồi JSON
            },
            mode: "cors", // Kích hoạt CORS
            cache: "no-cache" // Tránh cache dữ liệu cũ
        });

        if (!response.ok) throw new Error(HTTP error! Status: ${response.status});

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            throw new Error("Lỗi khi phân tích JSON: " + jsonError.message);
        }

        console.log("📥 Received data:", data);

        // Kiểm tra dữ liệu hợp lệ trước khi cập nhật UI
        if (data && typeof data === "object") {
            updateElement("tempValue", ${data.temperature || "N/A"} °C);
            updateElement("phValue", ${data.ph || "N/A"});
            updateElement("tdsValue", ${data.tds || "N/A"} PPM);
            updateElement("turbidityValue", ${data.turbidity || "N/A"} NTU);
        } else {
            console.warn("⚠️ Dữ liệu không hợp lệ:", data);
        }
    } catch (error) {
        console.error("❌ Fetch error:", error);
    }
}

// Hàm cập nhật phần tử an toàn
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = value;
    } else {
        console.warn(⚠️ Không tìm thấy phần tử: ${id});
    }
}

// Lấy dữ liệu mỗi 5 giây
setInterval(getData, 5000);
