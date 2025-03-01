const socket = io("https://disaster-response-backend.onrender.com/");
let userRole = "";
let map, requesterMarker, volunteerMarker, routeLayer;

function selectRole(role) {
    userRole = role;
    document.getElementById("roleSelection").style.display = "none";
    document.getElementById("mapContainer").style.display = "block";
    initializeMap();
    if (userRole === "requester") {
        getLocationAndRequestHelp();
    } else {
        listenForRequests();
    }
}

function initializeMap() {
    map = L.map("map").setView([14.0856, 121.1450], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
}

function getLocationAndRequestHelp() {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        socket.emit("sendRequest", { lat: latitude, lng: longitude });
    }, (error) => console.error("Error getting location:", error));
}

function listenForRequests() {
    socket.on("updateRequests", (requests) => {
        requests.forEach(req => {
            let marker = L.marker([req.lat, req.lng]).addTo(map)
                .bindPopup("Requester in need. Click to accept.").on("click", () => acceptRequest(req.id, req.lat, req.lng));
        });
    });
}

function acceptRequest(requestId, requesterLat, requesterLng) {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        socket.emit("acceptRequest", { requestId, volunteerLat: latitude, volunteerLng: longitude });
    }, (error) => console.error("Error getting location:", error));
}

socket.on("matchRequest", ({ lat, lng, volunteerLat, volunteerLng }) => {
    if (userRole === "requester") {
        requesterMarker = L.marker([lat, lng]).addTo(map).bindPopup("You requested help.").openPopup();
        volunteerMarker = L.marker([volunteerLat, volunteerLng]).addTo(map).bindPopup("Volunteer coming.").openPopup();
        drawRoute([lat, lng], [volunteerLat, volunteerLng]);
    }
});

function drawRoute(start, end) {
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2";
    const url = `https://graphhopper.com/api/1/route?point=${start[0]},${start[1]}&point=${end[0]},${end[1]}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (routeLayer) map.removeLayer(routeLayer);
            if (data.paths && data.paths.length > 0) {
                const routeCoordinates = data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]);
                routeLayer = L.polyline(routeCoordinates, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(routeLayer.getBounds());
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
