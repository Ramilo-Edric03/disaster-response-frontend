const socket = io("https://disaster-response-backend.onrender.com/"); 
let userRole;
let map, requesterMarker, volunteerMarker, volunteerLiveMarker, routeLayer;
let requestMarkers = []; 

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

// Requester submits manual location
function requestHelpManual() {
    let locationInput = document.getElementById("requester-location-input").value;
    if (!locationInput) {
        alert("Please enter a location.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                let location = data[0];
                sendHelpRequest(parseFloat(location.lat), parseFloat(location.lon), location.display_name);
            } else {
                alert("Location not found. Try entering a more specific address.");
            }
        })
        .catch(error => {
            console.error("Error fetching location:", error);
            alert("Failed to find location. Try again.");
        });
}

// Requester uses GPS location
function requestHelpGPS() {
    navigator.geolocation.getCurrentPosition((position) => {
        sendHelpRequest(position.coords.latitude, position.coords.longitude);
    }, (error) => {
        console.error("Error getting location:", error.message);
        alert("Failed to get GPS location.");
    });
}

function sendHelpRequest(latitude, longitude, locationName = "Unknown Location") {
    console.log("Fetching location name for:", latitude, longitude);

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
        .then(response => response.json())
        .then(data => {
            locationName = data.display_name || locationName;

            console.log("Detected location:", locationName);

            if (requesterMarker) map.removeLayer(requesterMarker);
            requesterMarker = L.marker([latitude, longitude])
                .addTo(map)
                .bindPopup(`Requester at ${locationName}`)
                .openPopup();

            socket.emit("sendRequest", { lat: latitude, lng: longitude, locationName });

            document.getElementById("request-status").innerText = `Request Sent from ${locationName}. Waiting for a volunteer...`;
        })
        .catch(error => {
            console.error("Error fetching location name:", error);
            socket.emit("sendRequest", { lat: latitude, lng: longitude, locationName });
        });
}

function fetchRequests() {
    socket.on("updateRequests", (requests) => {
        console.log("Received updated requests:", requests);

        const requestList = document.getElementById("request-list");
        requestList.innerHTML = "";

        requestMarkers.forEach(marker => map.removeLayer(marker));
        requestMarkers = [];

        requests.forEach((req, index) => {
            const div = document.createElement("div");
            div.className = "request-card";
            div.innerHTML = `<p><strong>Requester #${index + 1}</strong><br>Location: ${req.locationName}</p>
                             <button class='accept-btn' onclick='acceptRequest(${req.lat}, ${req.lng}, "${req.locationName}")'>Accept</button>`;
            requestList.appendChild(div);

            let marker = L.marker([req.lat, req.lng])
                .addTo(map)
                .bindPopup(`Requester #${index + 1}<br>${req.locationName}`);
            
            requestMarkers.push(marker);
        });
    });
}

// Volunteer submits manual location
function acceptRequestManual() {
    let locationInput = document.getElementById("volunteer-location-input").value;
    if (!locationInput) {
        alert("Please enter a location.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                let location = data[0];
                processVolunteerUpdate(parseFloat(location.lat), parseFloat(location.lon));
            } else {
                alert("Location not found. Try entering a more specific address.");
            }
        })
        .catch(error => {
            console.error("Error fetching location:", error);
            alert("Failed to find location. Try again.");
        });
}

// Volunteer uses GPS location
function acceptRequestGPS() {
    navigator.geolocation.watchPosition((position) => {
        processVolunteerUpdate(position.coords.latitude, position.coords.longitude);
    }, (error) => {
        console.error("Error getting location:", error.message);
        alert("Failed to get GPS location.");
    });
}

function processVolunteerUpdate(volunteerLat, volunteerLng, requesterLat, requesterLng) {
    console.log("Volunteer location updating:", volunteerLat, volunteerLng);
    socket.emit("volunteerLocationUpdate", { volunteerLat, volunteerLng, requesterLat, requesterLng });

    drawRoute([volunteerLat, volunteerLng], [requesterLat, requesterLng]);
}

socket.on("requestAccepted", (data) => {
    console.log("Requester notified of acceptance:", data);
    if (userRole === "requester") {
        document.getElementById("request-status").innerText = "Volunteer is on the way!";
        drawRoute([data.volunteerLat, data.volunteerLng], [data.lat, data.lng]);

        if (volunteerLiveMarker) map.removeLayer(volunteerLiveMarker);
        volunteerLiveMarker = L.marker([data.volunteerLat, data.volunteerLng])
            .addTo(map)
            .bindPopup("Volunteer is on the way!")
            .openPopup();
    }
});

socket.on("updateVolunteerLocation", (data) => {
    console.log("Updating requester map with volunteer location:", data.volunteerLat, data.volunteerLng);

    if (volunteerLiveMarker) map.removeLayer(volunteerLiveMarker);

    volunteerLiveMarker = L.marker([data.volunteerLat, data.volunteerLng])
        .addTo(map)
        .bindPopup("Volunteer is moving...")
        .openPopup();

    if (userRole === "requester") {
        drawRoute([data.volunteerLat, data.volunteerLng], [data.requesterLat, data.requesterLng]);
        document.getElementById("request-status").innerText = "Volunteer is on the way!";
    }
});

function drawRoute(start, end) {
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2";
    const url = `https://graphhopper.com/api/1/route?point=${start[0]},${start[1]}&point=${end[0]},${end[1]}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (routeLayer) map.removeLayer(routeLayer);
            if (data.paths.length > 0) {
                routeLayer = L.polyline(data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]), { color: "blue", weight: 4 }).addTo(map);
                map.fitBounds(routeLayer.getBounds());
            }
        })
        .catch(error => console.error("Error fetching route:", error));
}
