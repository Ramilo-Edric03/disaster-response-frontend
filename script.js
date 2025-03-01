const socket = io("https://disaster-response-backend.onrender.com/");
let userRole = "";
let map, requesterMarker, volunteerMarker, routeLayer;

socket.on("connect", () => console.log("Connected to WebSocket"));

function selectRole(role) {
    userRole = role;
    document.getElementById("roleSelection").style.display = "none";
    document.getElementById("mapContainer").style.display = "block";
    console.log("User selected role:", userRole);
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
    console.log("Map initialized");
}

function getLocationAndRequestHelp() {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        console.log("Requester location:", latitude, longitude);
        socket.emit("sendRequest", { lat: latitude, lng: longitude });
    }, (error) => console.error("Error getting location:", error));
}

function listenForRequests() {
    socket.on("updateRequests", (requests) => {
        console.log("Received updateRequests event:", requests);
        requests.forEach(req => {
            let marker = L.marker([req.lat, req.lng]).addTo(map)
                .bindPopup("Requester in need. Click to accept.").on("click", () => acceptRequest(req.id, req.lat, req.lng));
        });
    });
}

function acceptRequest(requestId, requesterLat, requesterLng) {
    console.log("Accepting request:", requestId);
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        console.log("Volunteer location:", latitude, longitude);
        socket.emit("acceptRequest", { requestId, volunteerLat: latitude, volunteerLng: longitude });
    }, (error) => console.error("Error getting location:", error));
}

socket.on("matchRequest", ({ lat, lng, volunteerLat, volunteerLng }) => {
    console.log("Match request received:", { lat, lng, volunteerLat, volunteerLng });
    if (userRole === "requester") {
        requesterMarker = L.marker([lat, lng]).addTo(map).bindPopup("You requested help.").openPopup();
        volunteerMarker = L.marker([volunteerLat, volunteerLng]).addTo(map).bindPopup("Volunteer coming.").openPopup();
        drawRoute([lat, lng], [volunteerLat, volunteerLng]);
    }
});

function drawRoute(start, end) {
    console.log("Drawing route between:", start, end);
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
                console.log("Route drawn successfully");
            } else {
                console.error("No route found");
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
