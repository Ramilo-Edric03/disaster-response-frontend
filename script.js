socket.on("receiveLocation", (locations) => {
    console.log("Received locations:", locations); // Debugging

    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};

    Object.entries(locations).forEach(([id, data]) => {
        if (data.lat !== undefined && data.lng !== undefined) { // Ensure valid data
            let marker = L.marker([data.lat, data.lng]).addTo(map)
                .bindPopup(`${data.role} Location`).openPopup();
            markers[id] = marker;
        } else {
            console.error(`Invalid location data for ${id}:`, data);
        }
    });

    // Check if both requester and volunteer exist for routing
    const requester = Object.values(locations).find(loc => loc.role === "requester");
    const volunteer = Object.values(locations).find(loc => loc.role === "volunteer");

    if (requester && volunteer && requester.lat !== undefined && volunteer.lat !== undefined) {
        drawRoute([requester.lat, requester.lng], [volunteer.lat, volunteer.lng]);
    }
});
