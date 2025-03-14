async function getData() {
    const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        mode: "cors", // Quan trọng để tránh lỗi CORS
    });

    const data = await response.json();

    document.getElementById("tempValue").innerText = `${data.temperature} °C`;
    document.getElementById("phValue").innerText = `${data.ph}`;
    document.getElementById("TDSValue").innerText = `${data.tds} PPM`;
}

setInterval(getData, 5000);
