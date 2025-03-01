const socket = io("https://disaster-response-backend.onrender.com/");
let userRole;
let map, requesterMarker, volunteerMarker, routeLayer;

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed.");
    map = L.map("map").setView([14.0856, 121.1450], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
});

function setRole(role) {
    console.log("User selected role:", role);
    userRole = role;
    document.querySelector(".role-selection").style.display = "none";
    document.getElementById(`${role}-dashboard`).style.display = "block";
    if (role === "volunteer") fetchRequests();
    else requestHelp();
}

function requestHelp() {
    console.log("Requester attempting to send help request...");
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        console.log("Requester location detected:", latitude, longitude);
        socket.emit("sendRequest", { lat: latitude, lng: longitude });
        document.getElementById("request-status").innerText = "Request Sent. Waiting for a volunteer...";
    }, (error) => console.error("Error getting location:", error.message));
}

function fetchRequests() {
    console.log("Fetching requests...");
    socket.on("updateRequests", (requests) => {
        console.log("Received updated requests:", requests);
        const requestList = document.getElementById("request-list");
        requestList.innerHTML = "";
        requests.forEach((req, index) => {
            const div = document.createElement("div");
            div.className = "request-card";
            div.innerHTML = `<p><strong>Requester #${index + 1}</strong><br>Location: ${req.lat}, ${req.lng}</p>
                             <button class='accept-btn' onclick='acceptRequest(${req.lat}, ${req.lng})'>Accept</button>`;
            requestList.appendChild(div);
        });
    });
}

function acceptRequest(lat, lng) {
    console.log("Volunteer accepted request at:", lat, lng);
    navigator.geolocation.getCurrentPosition((position) => {
        const volunteerLat = position.coords.latitude;
        const volunteerLng = position.coords.longitude;
        console.log("Volunteer location detected:", volunteerLat, volunteerLng);
        socket.emit("acceptRequest", { lat, lng, volunteerLat, volunteerLng });
        drawRoute([volunteerLat, volunteerLng], [lat, lng]);
    });
}

function drawRoute(start, end) {
    console.log("Drawing route from", start, "to", end);
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2";
    const url = `https://graphhopper.com/api/1/route?point=${start[0]},${start[1]}&point=${end[0]},${end[1]}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            console.log("Route data received:", data);
            if (routeLayer) map.removeLayer(routeLayer);
            if (data.paths.length > 0) {
                const routeCoordinates = data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]);
                routeLayer = L.polyline(routeCoordinates, { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(routeLayer.getBounds());
            } else {
                console.error("No route found!");
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
