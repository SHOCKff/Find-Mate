// Global variable for other user's marker and circle
let otherMarker = null;
let otherCircle = null;

socket.on("Server_data", (data) => {
    if (socket.id !== data[0]) {  
        var endLat = data[1].latitude;
        var endLng = data[1].longitude;
        var endAcc = data[1].accuracy;

        manuplated_logsClass.innerText = `Status : Destination with an accuracy of ${Math.floor(endAcc)} m`;

        lastOtherPosition = data[1]; 

        // Remove previous other user marker & circle
        if (otherMarker) map.removeLayer(otherMarker);
        if (otherCircle) map.removeLayer(otherCircle);

        // Add new other user marker
        otherMarker = L.marker([endLat, endLng], { draggable: false }).addTo(map);

        // Optional: add a circle to show accuracy
        otherCircle = L.circle([endLat, endLng], {
            color: 'red',
            fillColor: '#f03',
            fillOpacity: 0.5,
            radius: endAcc
        }).addTo(map);
    }

    var start = L.latLng(my_position[0], my_position[1]);
    var end = L.latLng(data[1].latitude, data[1].longitude);

    if (!Route) {
        Route = L.Routing.control({
            waypoints: [start, end],
            show: false,
        }).addTo(map);
    } else {
        Route.setWaypoints([start, end]);
    }
});
