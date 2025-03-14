async function getData() {
    const response = await fetch("https://your-worker.yourdomain.workers.dev");
    const data = await response.json();

    document.getElementById("tempValue").innerText = `${data.temperature} °C`;
    document.getElementById("phValue").innerText = `${data.ph}`;
    document.getElementById("TDSValue").innerText = `${data.tds} PPM`;
}

setInterval(getData, 5000);  // Cập nhật mỗi 5 giây  
