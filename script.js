const socket = io("http://localhost:5000"); // Change this if using an online backend
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
}

function requestHelp() {
    let locationInput = document.getElementById("location-select").value;

    if (locationInput === "gps") {
        navigator.geolocation.getCurrentPosition((position) => {
            sendHelpRequest(position.coords.latitude, position.coords.longitude, "Your current location");
        }, (error) => {
            console.error("Error getting location:", error.message);
            alert("Failed to get GPS location. Try manual input.");
        });
    } else {
        let testLocations = {
            "City Hall": [14.5995, 120.9842],
            "Hospital": [14.5606, 121.0195],
            "Fire Station": [14.5733, 121.0222]
        };

        let coordinates = testLocations[locationInput];
        sendHelpRequest(coordinates[0], coordinates[1], locationInput);
    }
}

function sendHelpRequest(latitude, longitude, locationName) {
    console.log("Requester location:", latitude, longitude);

    if (requesterMarker) map.removeLayer(requesterMarker);
    requesterMarker = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(`Requester at ${locationName}`)
        .openPopup();

    socket.emit("sendRequest", { lat: latitude, lng: longitude });
    document.getElementById("request-status").innerText = `Request Sent from ${locationName}. Waiting for a volunteer...`;
}

function fetchRequests() {
    socket.on("updateRequests", (requests) => {
        const requestList = document.getElementById("request-list");
        requestList.innerHTML = "";
        requests.forEach((req, index) => {
            const div = document.createElement("div");
            div.className = "request-card";
            div.innerHTML = `<p><strong>Requester #${index + 1}</strong><br>Location: ${req.lat}, ${req.lng}</p>
                             <button class='accept-btn' onclick='acceptRequest(${req.lat}, ${req.lng})'>Accept</button>`;
            requestList.appendChild(div);
            
            // Add a marker for the requester
            L.marker([req.lat, req.lng])
                .addTo(map)
                .bindPopup(`Requester #${index + 1}<br>Location: ${req.lat}, ${req.lng}`);
        });
    });
}

function acceptRequest(lat, lng) {
    let locationInput = document.getElementById("volunteer-location-select").value;

    if (locationInput === "gps") {
        navigator.geolocation.getCurrentPosition((position) => {
            processVolunteerAcceptance(position.coords.latitude, position.coords.longitude, "Your current location", lat, lng);
        }, (error) => {
            console.error("Error getting location:", error.message);
            alert("Failed to get GPS location. Try manual input.");
        });
    } else {
        let testLocations = {
            "City Hall": [14.5995, 120.9842],
            "Hospital": [14.5606, 121.0195],
            "Fire Station": [14.5733, 121.0222]
        };

        let coordinates = testLocations[locationInput];
        processVolunteerAcceptance(coordinates[0], coordinates[1], locationInput, lat, lng);
    }
}

function processVolunteerAcceptance(volunteerLat, volunteerLng, locationName, requesterLat, requesterLng) {
    console.log("Volunteer location:", volunteerLat, volunteerLng);

    if (volunteerMarker) map.removeLayer(volunteerMarker);
    volunteerMarker = L.marker([volunteerLat, volunteerLng])
        .addTo(map)
        .bindPopup(`Volunteer at ${locationName}`)
        .openPopup();

    socket.emit("acceptRequest", { lat: requesterLat, lng: requesterLng, volunteerLat, volunteerLng });

    drawRoute([volunteerLat, volunteerLng], [requesterLat, requesterLng]);
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

                // Add markers for start and end of the route
                L.marker(start).addTo(map).bindPopup("Volunteer Start Location").openPopup();
                L.marker(end).addTo(map).bindPopup("Requester Location").openPopup();
            } else {
                console.error("No route found!");
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
