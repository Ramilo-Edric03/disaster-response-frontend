const socket = io("https://disaster-response-backend.onrender.com/");

let map = L.map("map").setView([14.0856, 121.1450], 13); // Default to Tanauan, Batangas
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let userRole = "";
let userMarker;
let markers = {};
let routeLayer;

// Select role and initialize dashboard
function selectRole(role) {
    userRole = role;
    document.getElementById("roleSelection").style.display = "none";
    document.getElementById(role + "Dashboard").style.display = "block";
    getLocation();
}

// Get user's current location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const { latitude, longitude } = position.coords;
            socket.emit("sendLocation", { role: userRole, lat: latitude, lng: longitude });

            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([latitude, longitude]).addTo(map)
                .bindPopup("You are here").openPopup();

        }, (error) => console.error("Error getting location:", error));
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

// Listen for location updates from the server
socket.on("receiveLocation", (locations) => {
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    Object.entries(locations).forEach(([id, data]) => {
        if (!markers[id]) {
            let marker = L.marker([data.lat, data.lng]).addTo(map)
                .bindPopup(`${data.role} Location`).openPopup();
            markers[id] = marker;
        }
    });

    // If both a requester and volunteer are present, draw a route
    const requester = Object.values(locations).find(loc => loc.role === "requester");
    const volunteer = Object.values(locations).find(loc => loc.role === "volunteer");

    if (requester && volunteer) {
        drawRoute([requester.lat, requester.lng], [volunteer.lat, volunteer.lng]);
    }
});

// Request help function
function sendHelpRequest() {
    if (!userMarker) return alert("Location not detected!");
    const { lat, lng } = userMarker.getLatLng();
    socket.emit("requestHelp", { lat, lng });
}

// Listen for new help requests (for volunteers)
socket.on("newHelpRequest", (requests) => {
    const requestList = document.getElementById("requestList");
    requestList.innerHTML = "";

    requests.forEach((request, index) => {
        const listItem = document.createElement("li");
        listItem.textContent = `Help requested at (${request.lat}, ${request.lng})`;
        requestList.appendChild(listItem);
    });
});

// Draw route between requester and volunteer
function drawRoute(start, end) {
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2"; // GraphHopper API Key
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
