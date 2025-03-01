// Connect to WebSocket backend
const socket = io("https://disaster-response-backend.onrender.com/"); // Replace with your backend URL

// Initialize map
const map = L.map("map").setView([14.0856, 121.1450], 13); // Default view: Tanauan, Batangas
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let markers = {}; // Store markers
let routeLayer;

// Listen for location updates
socket.on("receiveLocation", (locations) => {
    console.log("Received locations:", locations); // Debugging

    // Remove existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    Object.entries(locations).forEach(([id, data]) => {
        if (data.lat !== undefined && data.lng !== undefined) { // Ensure valid location
            let marker = L.marker([data.lat, data.lng]).addTo(map)
                .bindPopup(`${data.role} Location`).openPopup();
            markers[id] = marker;
        } else {
            console.error(`Invalid location data for ${id}:`, data);
        }
    });

    // Find requester and volunteer for routing
    const requester = Object.values(locations).find(loc => loc.role === "requester");
    const volunteer = Object.values(locations).find(loc => loc.role === "volunteer");

    if (requester && volunteer && requester.lat !== undefined && volunteer.lat !== undefined) {
        drawRoute([requester.lat, requester.lng], [volunteer.lat, volunteer.lng]);
    }
});

// Function to get and send user's location
function getLocation(role) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            socket.emit("sendLocation", { role, lat: latitude, lng: longitude });
        }, (error) => console.error("Error getting location:", error));
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

// Function to draw route between requester & volunteer
function drawRoute(start, end) {
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2"; // Replace with your GraphHopper API key
    const url = `https://graphhopper.com/api/1/route?point=${start[0]},${start[1]}&point=${end[0]},${end[1]}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (routeLayer) map.removeLayer(routeLayer);

            if (data.paths && data.paths.length > 0) {
                const routeCoordinates = data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]);
                routeLayer = L.polyline(routeCoordinates, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(routeLayer.getBounds());
            } else {
                console.error("⚠ No route found between these locations!");
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
