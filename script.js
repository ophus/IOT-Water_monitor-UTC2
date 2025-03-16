async function getData() {
    try {
        const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/", {
            method: "POST", // Chuyển thành GET nếu API không cần POST
            headers: {
                "Content-Type": "application/json",
            },
            mode: "cors", // Bật CORS
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("📥 Received data:", data);

        // Kiểm tra xem phần tử có tồn tại trước khi cập nhật
        updateElement("tempValue", `${data.temperature} °C`);
        updateElement("phValue", `${data.ph}`);
        updateElement("tdsValue", `${data.tds} PPM`);
        updateElement("turbidityValue", `${data.turbidity} NTU`);
    } catch (error) {
        console.error("❌ Fetch error:", error);
    }
}

// Hàm cập nhật phần tử an toàn, tránh lỗi null
function updateElement(id, value) {
    let el = document.getElementById(id);
    if (el) el.innerText = value;
}

// Lấy dữ liệu mỗi 5 giây
setInterval(getData, 5000);
