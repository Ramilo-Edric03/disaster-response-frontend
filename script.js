const socket = io("https://disaster-response-backend.onrender.com/"); // Backend URL

// Initialize map
const map = L.map("map").setView([14.0856, 121.1450], 13); // Default view: Tanauan, Batangas
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let requesterMarker, volunteerMarker, routeLayer;

// Listen for location updates from the server
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

    // Draw route if both locations are available
    if (requesterMarker && volunteerMarker) {
        drawRoute(requesterMarker.getLatLng(), volunteerMarker.getLatLng());
    }
});

// Function to get the user's GPS location
function getLocation(role) {
    navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        socket.emit("sendLocation", { role, lat: latitude, lng: longitude });
    }, (error) => {
        console.error("Error getting location:", error);
        alert("Could not get GPS location. Please enter a landmark instead.");
    });
}

// Function to get location by landmark
function getLandmarkLocation(role) {
    const landmark = document.getElementById("landmark").value;
    if (!landmark) {
        alert("Please enter a landmark.");
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(landmark)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                alert("Landmark not found! Try another.");
                return;
            }

            const { lat, lon } = data[0];
            socket.emit("sendLocation", { role, lat: parseFloat(lat), lng: parseFloat(lon) });

            // Add marker to map
            if (role === "requester") {
                if (requesterMarker) map.removeLayer(requesterMarker);
                requesterMarker = L.marker([lat, lon]).addTo(map)
                    .bindPopup("Requester Location (Landmark)").openPopup();
            } else if (role === "volunteer") {
                if (volunteerMarker) map.removeLayer(volunteerMarker);
                volunteerMarker = L.marker([lat, lon]).addTo(map)
                    .bindPopup("Volunteer Location (Landmark)").openPopup();
            }

            // Draw route if both locations exist
            if (requesterMarker && volunteerMarker) {
                drawRoute(requesterMarker.getLatLng(), volunteerMarker.getLatLng());
            }
        })
        .catch(error => console.error("Error fetching landmark location:", error));
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
