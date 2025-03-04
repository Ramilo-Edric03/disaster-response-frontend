const socket = io("https://disaster-response-backend.onrender.com/");
let userRole;
let map, requesterMarker, volunteerMarker, volunteerLiveMarker, routeLayer;
let requestMarkers = [];
let requesterLat = null, requesterLng = null;
let volunteerLat = null, volunteerLng = null;

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded and parsed.");
    map = L.map("map").setView([14.0856, 121.1450], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
});

function setRole(role) {
    console.log("User selected role:", role);
    userRole = role;

    // Hide the role selection buttons
    document.querySelectorAll("button").forEach(button => {
        if (button.innerText.includes("I Need Help") || button.innerText.includes("I Want to Help")) {
            button.style.display = "none";
        }
    });

    // Show the selected dashboard
    document.getElementById(`${role}-dashboard`).style.display = "block";

    if (role === "volunteer") fetchRequests();
}


function requestHelp() {
    if (requesterLat === null || requesterLng === null) {
        alert("Please set your location before requesting help.");
        return;
    }
    sendHelpRequest(requesterLat, requesterLng);
}

function setRequesterLocationManual() {
    let locationInput = document.getElementById("requester-location-input").value;
    if (!locationInput) {
        alert("Please enter a location.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                requesterLat = parseFloat(data[0].lat);
                requesterLng = parseFloat(data[0].lon);
                document.getElementById("request-status").innerText = `Location set: ${data[0].display_name}`;
                document.getElementById("request-help-btn").disabled = false;
            } else {
                alert("Location not found.");
            }
        })
        .catch(error => console.error("Error:", error));
}

function setRequesterLocationGPS() {
    navigator.geolocation.getCurrentPosition((position) => {
        requesterLat = position.coords.latitude;
        requesterLng = position.coords.longitude;
        document.getElementById("request-status").innerText = "Location set: Using GPS";
        document.getElementById("request-help-btn").disabled = false;
    }, (error) => alert("Failed to get GPS location."));
}

function acceptRequest(lat, lng) {
    if (volunteerLat === null || volunteerLng === null) {
        alert("Please set your location before accepting requests.");
        return;
    }
    processVolunteerUpdate(volunteerLat, volunteerLng, lat, lng);
}

function setVolunteerLocationManual() {
    let locationInput = document.getElementById("volunteer-location-input").value;
    if (!locationInput) {
        alert("Please enter a location.");
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationInput)}&format=json&limit=1`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                volunteerLat = parseFloat(data[0].lat);
                volunteerLng = parseFloat(data[0].lon);
                alert(`Location set: ${data[0].display_name}`);
            } else {
                alert("Location not found.");
            }
        })
        .catch(error => console.error("Error:", error));
}

function setVolunteerLocationGPS() {
    navigator.geolocation.getCurrentPosition((position) => {
        volunteerLat = position.coords.latitude;
        volunteerLng = position.coords.longitude;
        alert("Location set: Using GPS");
    }, (error) => alert("Failed to get GPS location."));
}

function fetchRequests() {
    socket.on("updateRequests", (requests) => {
        document.getElementById("request-list").innerHTML = "";
        requestMarkers.forEach(marker => map.removeLayer(marker));
        requestMarkers = [];

        requests.forEach((req, index) => {
            let div = document.createElement("div");
            div.className = "request-card";
            div.innerHTML = `<p><strong>Requester #${index + 1}</strong><br>Location: ${req.locationName}</p>
                             <button class='accept-btn' onclick='acceptRequest(${req.lat}, ${req.lng})'>Accept</button>`;
            document.getElementById("request-list").appendChild(div);
            let marker = L.marker([req.lat, req.lng]).addTo(map).bindPopup(req.locationName);
            requestMarkers.push(marker);
        });
    });
}

function clearAllRequests() {
    if (confirm("Are you sure you want to clear all requests?")) {
        socket.emit("clearRequests");
        requestMarkers.forEach(marker => map.removeLayer(marker));
        requestMarkers = [];
        document.getElementById("request-list").innerHTML = "";
    }
}

function processVolunteerUpdate(volunteerLat, volunteerLng, requesterLat, requesterLng) {
    socket.emit("volunteerLocationUpdate", { volunteerLat, volunteerLng, requesterLat, requesterLng });
}

socket.on("updateVolunteerLocation", (data) => {
    if (volunteerLiveMarker) map.removeLayer(volunteerLiveMarker);
    volunteerLiveMarker = L.marker([data.volunteerLat, data.volunteerLng]).addTo(map).bindPopup("Volunteer is moving...");
});
