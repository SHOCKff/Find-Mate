<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Real-Time Map Tracking</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.css" />
    <style>
        #map { height: 100vh; width: 100%; }
    </style>
</head>
<body>
    <div id="map"></div>

    <!-- Socket.IO -->
    <script src="/socket.io/socket.io.js"></script>
    <!-- Leaflet -->
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <!-- Leaflet Routing Machine -->
    <script src="https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.js"></script>

    <script>
        // ====== Initialization ======
        var map = L.map('map');
        var my_position = [];
        var obj = null; // Stores current user marker & circle
        var Route = null; // Routing
        var lastOtherPosition = null; 
        var otherMarker = null; // Other user's marker
        var otherCircle = null; // Other user's circle

        // Status display
        var manuplated_logsClass = document.getElementsByClassName("leaflet-control-attribution leaflet-control")[0];
        manuplated_logsClass.innerText = "Status : Loading your current location...";

        // Tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Adjust zoom level based on accuracy
        function getZoomLevel(accuracy) {
            if (accuracy < 5) return 19;
            if (accuracy < 10) return 18;
            if (accuracy < 20) return 17;
            if (accuracy < 50) return 16;
            if (accuracy < 100) return 15;
            if (accuracy < 200) return 14;
            if (accuracy < 500) return 13;
            if (accuracy < 1000) return 12;
            return 11;
        }

        // ====== Socket.IO ======
        const socket = io();
        const roomid = new URLSearchParams(window.location.search).get('roomid');
        socket.emit("joinRoom", roomid);

        // ====== Get current location periodically ======
        setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    const accuracy = position.coords.accuracy;
                    my_position = [latitude, longitude, accuracy];

                    if (!obj) obj = landed(); // first time: add marker & circle

                    socket.emit("Client_data", { latitude, longitude, accuracy });
                },
                error => { console.error(error) },
                { enableHighAccuracy: true }
            );
        }, 4000);

        // ====== Place current user marker & circle ======
        function landed() {
            map.setView([my_position[0], my_position[1]], getZoomLevel(my_position[2]));

            let Landedmarker = L.marker([my_position[0], my_position[1]], { draggable: false }).addTo(map);
            Landedmarker.bindPopup(`<b>Your Position:</b><br>Accuracy: ${my_position[2]} meters`).openPopup();

            let LandedCircle = L.circle([my_position[0], my_position[1]], {
                color: 'blue',
                fillColor: '#add8e6',
                fillOpacity: 0.5,
                radius: my_position[2]
            }).addTo(map);

            manuplated_logsClass.innerText = "Status : Waiting for other user to connect...";

            return { Landedmarker, LandedCircle };
        }

        // ====== Handle server updates ======
        socket.on("Server_data", (data) => {
            if (socket.id !== data[0]) {  
                let endLat = data[1].latitude;
                let endLng = data[1].longitude;
                let endAcc = data[1].accuracy;

                manuplated_logsClass.innerText = `Status : Destination with an accuracy of ${Math.floor(endAcc)} m`;
                lastOtherPosition = data[1]; 

                // Remove previous other user marker & circle
                if (otherMarker) map.removeLayer(otherMarker);
                if (otherCircle) map.removeLayer(otherCircle);

                // Add new other user marker & circle
                otherMarker = L.marker([endLat, endLng], { draggable: false }).addTo(map);
                otherCircle = L.circle([endLat, endLng], {
                    color: 'red',
                    fillColor: '#f03',
                    fillOpacity: 0.5,
                    radius: endAcc
                }).addTo(map);
            }

            let start = L.latLng(my_position[0], my_position[1]);
            let end = L.latLng(data[1].latitude, data[1]()
