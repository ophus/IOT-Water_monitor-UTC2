document.getElementById("btnTestSensor").addEventListener("click", function() {
    fetch("http://192.168.1.100/test_sensor")
        .then(response => response.json())
        .then(data => {
            document.getElementById("tempValue").innerText = data.temperature + " °C";
            document.getElementById("phValue").innerText = data.ph;
            document.getElementById("turbidityValue").innerText = data.turbidity + " NTU";
            document.getElementById("TDSValue").innerText = data.tds + " PPM";
            alert("Test cảm biến hoàn tất!");
        })
        .catch(error => console.error("Lỗi:", error));
});
