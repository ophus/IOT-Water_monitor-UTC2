document.getElementById("btnStartMeasure").addEventListener("click", function() {
    fetch("http://192.168.1.100/start_measure")
        .then(response => response.json())
        .then(data => {
            document.getElementById("tempValue").innerText = data.temperature + " °C";
            document.getElementById("phValue").innerText = data.ph;
            document.getElementById("turbidityValue").innerText = data.turbidity + " NTU";
            document.getElementById("TDSValue").innerText = data.tds + " PPM";

            updateChart(data.temperature, data.ph, data.turbidity, data.tds);
        })
        .catch(error => console.error("Lỗi:", error));
});

// Cập nhật biểu đồ với dữ liệu mới
function updateChart(temp, ph, turbidity, tds) {
    myChart.data.labels.push(new Date().toLocaleTimeString());
    myChart.data.datasets[0].data.push(temp);
    myChart.data.datasets[1].data.push(ph);
    myChart.data.datasets[2].data.push(turbidity);
    myChart.data.datasets[3].data.push(tds);

    if (myChart.data.labels.length > 10) {
        myChart.data.labels.shift();
        myChart.data.datasets.forEach(dataset => dataset.data.shift());
    }

    myChart.update();
}
