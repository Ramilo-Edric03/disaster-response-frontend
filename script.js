const socket = io("https://disaster-response-backend.onrender.com/");
const map = L.map("map").setView([14.0856, 121.1450], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let userRole = "";
let requesterMarker, volunteerMarker, routeLayer;
let requestMarkers = {};

// Prompt user to select role
function selectRole(role) {
    userRole = role;
    document.getElementById("roleSelection").style.display = "none";
    document.getElementById("mapContainer").style.display = "block";
    if (role === "requester") {
        getLocation("requester");
    } else {
        socket.emit("getRequests");
    }
}

// Request and send user location
function getLocation(role) {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        if (role === "requester") {
            socket.emit("sendRequest", { lat: latitude, lng: longitude });
        } else if (role === "volunteer") {
            socket.emit("sendLocation", { role, lat: latitude, lng: longitude });
        }
    }, (error) => console.error("Error getting location:", error));
}

// Display requests on map for volunteers
socket.on("updateRequests", (requests) => {
    Object.values(requestMarkers).forEach(marker => map.removeLayer(marker));
    requestMarkers = {};
    
    requests.forEach(request => {
        const marker = L.marker([request.lat, request.lng]).addTo(map)
            .bindPopup(`<b>Help Needed!</b><br><button onclick="acceptRequest('${request.id}', ${request.lat}, ${request.lng})">Accept</button>`);
        requestMarkers[request.id] = marker;
    });
});

// Accept a request
function acceptRequest(requestId, lat, lng) {
    navigator.geolocation.getCurrentPosition((position) => {
        const volunteerLat = position.coords.latitude;
        const volunteerLng = position.coords.longitude;
        socket.emit("acceptRequest", { requestId, volunteerLat, volunteerLng });
    }, (error) => console.error("Error getting location:", error));
}

// Show route when a request is accepted
socket.on("matchRequest", (data) => {
    if (routeLayer) map.removeLayer(routeLayer);
    const { lat, lng, volunteerLat, volunteerLng } = data;
    drawRoute([lat, lng], [volunteerLat, volunteerLng]);
});

// Function to draw the route
function drawRoute(start, end) {
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2";
    const url = `https://graphhopper.com/api/1/route?point=${start[0]},${start[1]}&point=${end[0]},${end[1]}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.paths.length > 0) {
                const routeCoordinates = data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]);
                routeLayer = L.polyline(routeCoordinates, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(routeLayer.getBounds());
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
