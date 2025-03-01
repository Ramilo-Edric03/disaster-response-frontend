const socket = io("https://disaster-response-backend.onrender.com/"); // Replace with your Render backend URL

// Initialize map
const map = L.map("map").setView([14.0856, 121.1450], 13); // Default view: Tanauan, Batangas
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let requesterMarker, volunteerMarker, routeLayer;

// Listen for location updates
socket.on("receiveLocation", (data) => {
    const { role, lat, lng } = data;

    if (role === "requester") {
        if (requesterMarker) map.removeLayer(requesterMarker);
        requesterMarker = L.marker([lat, lng]).addTo(map)
            .bindPopup("Requester Location").openPopup();
    } else if (role === "volunteer") {
        if (volunteerMarker) map.removeLayer(volunteerMarker);
        volunteerMarker = L.marker([lat, lng]).addTo(map)
            .bindPopup("Volunteer Location").openPopup();
    }

    // If both locations exist, draw the route
    if (requesterMarker && volunteerMarker) {
        drawRoute(requesterMarker.getLatLng(), volunteerMarker.getLatLng());
    }
});

// Function to request and send the user's location
function getLocation(role) {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        socket.emit("sendLocation", { role, lat: latitude, lng: longitude });
    }, (error) => console.error("Error getting location:", error));
}

// Ask user for their role (requester or volunteer)
const userRole = prompt("Are you a 'requester' or 'volunteer'?");
if (userRole === "requester" || userRole === "volunteer") {
    getLocation(userRole);
}

// Function to draw a route between requester & volunteer
function drawRoute(start, end) {
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2"; // Replace with your GraphHopper API key
    const url = `https://graphhopper.com/api/1/route?point=${start.lat},${start.lng}&point=${end.lat},${end.lng}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

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
