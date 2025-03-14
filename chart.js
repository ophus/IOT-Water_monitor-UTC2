const ctx = document.getElementById("realtimeChart").getContext("2d");
const myChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [
            { label: "Nhiệt Độ (°C)", borderColor: "red", data: [] },
            { label: "pH", borderColor: "blue", data: [] },
            { label: "Độ Đục (NTU)", borderColor: "green", data: [] },
            { label: "TDS (PPM)", borderColor: "purple", data: [] },
        ]
    },
    options: {
        responsive: true,
        scales: {
            x: { display: true },
            y: { beginAtZero: true }
        }
    }
});
