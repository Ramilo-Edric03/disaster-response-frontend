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

    // Hide the entire role selection section
    let roleSelectionDiv = document.getElementById("role-selection");
    if (roleSelectionDiv) {
        roleSelectionDiv.style.display = "none";
    }

    // Show the correct dashboard
    let dashboard = document.getElementById(`${role}-dashboard`);
    if (dashboard) {
        dashboard.style.display = "block";
    } else {
        console.error(`Dashboard for role "${role}" not found.`);
    }

    if (role === "volunteer") fetchRequests();
}




function requestHelp() {
    if (requesterLat === null || requesterLng === null) {
        alert("Please set your location before requesting help.");
        return;
    }
    sendHelpRequest(requesterLat, requesterLng);
}

function sendHelpRequest(latitude, longitude) {
    console.log("Sending help request from:", latitude, longitude);

    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
        .then(response => response.json())
        .then(data => {
            let locationName = data.display_name || "Unknown Location";

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
            socket.emit("sendRequest", { lat: latitude, lng: longitude, locationName: "Unknown Location" });
        });
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

let volunteerWatchID = null; // To store GPS tracking instance

function acceptRequestGPS(requesterLat, requesterLng) {
    console.log("Volunteer using GPS location...");

    if (volunteerWatchID !== null) {
        navigator.geolocation.clearWatch(volunteerWatchID); // Clear any previous tracking
    }

    volunteerWatchID = navigator.geolocation.watchPosition((position) => {
        volunteerLat = position.coords.latitude;
        volunteerLng = position.coords.longitude;

        console.log("Live location update:", volunteerLat, volunteerLng);

        // Send live location to server
        socket.emit("volunteerLocationUpdate", { 
            volunteerLat, 
            volunteerLng, 
            requesterLat, 
            requesterLng 
        });

        // Update route dynamically
        drawRoute([volunteerLat, volunteerLng], [requesterLat, requesterLng]);

    }, (error) => {
        console.error("Error getting location:", error.message);
        alert("Failed to get live GPS location.");
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 });
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
    if (!requesterLat || !requesterLng) {
        console.error("Missing requester coordinates! Cannot draw route.");
        alert("Error: Missing requester location. Try again.");
        return;
    }

    console.log("Volunteer location updating:", volunteerLat, volunteerLng);
    socket.emit("volunteerLocationUpdate", { volunteerLat, volunteerLng, requesterLat, requesterLng });

    // Draw the route
    drawRoute([volunteerLat, volunteerLng], [requesterLat, requesterLng]);
}


socket.on("updateVolunteerLocation", (data) => {
    console.log("Updating requester map with volunteer location:", data.volunteerLat, data.volunteerLng);

    if (!volunteerLiveMarker) {
        // First-time marker placement
        volunteerLiveMarker = L.marker([data.volunteerLat, data.volunteerLng])
            .addTo(map)
            .bindPopup("Volunteer is moving...");
    } else {
        // Smoothly move marker
        volunteerLiveMarker.setLatLng([data.volunteerLat, data.volunteerLng]);
    }

    // Update the route dynamically for the requester
    if (userRole === "requester") {
        drawRoute([data.volunteerLat, data.volunteerLng], [data.requesterLat, data.requesterLng]);
        document.getElementById("request-status").innerText = "Volunteer is on the way!";
    }
});



function drawRoute(start, end) {
    console.log("Drawing route from", start, "to", end);
    const apiKey = "9f598a60-2020-4e82-985e-61026c21e8b2"; // Your GraphHopper API key
    const url = `https://graphhopper.com/api/1/route?point=${start[0]},${start[1]}&point=${end[0]},${end[1]}&vehicle=car&locale=en&points_encoded=false&key=${apiKey}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`GraphHopper request failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data.paths || data.paths.length === 0) {
                throw new Error("No route found.");
            }

            // Remove old route if it exists
            if (routeLayer) {
                map.removeLayer(routeLayer);
            }

            // Draw the new route
            routeLayer = L.polyline(data.paths[0].points.coordinates.map(coord => [coord[1], coord[0]]), { 
                color: "blue", 
                weight: 4 
            }).addTo(map);
            map.fitBounds(routeLayer.getBounds());
        })
        .catch(error => {
            console.error("Error fetching route:", error);
            alert("Could not fetch route. Please check the location and try again.");
        });
}

