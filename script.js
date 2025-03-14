async function getData() {
    try {
        const response = await fetch("https://esp32-data-receiver.phucminh9395.workers.dev/", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
            mode: "cors", // Bật CORS
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        console.log("Received data:", data);

        document.getElementById("tempValue").innerText = `${data.message}`;
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

setInterval(getData, 5000);
