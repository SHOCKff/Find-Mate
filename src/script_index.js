var map = L.map('map');
my_position = []; 
var obj = null; 
var Route = null;
var lastOtherPosition = null; 

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// WebSocket connection 
const socket = io();
const roomid = new URLSearchParams(window.location.search).get('roomid');
socket.emit("joinRoom", roomid);

// Get current location while connected with a timeout value
const intervalId = setInterval(async () => {
    await navigator.geolocation.getCurrentPosition(
        function (position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            my_position = [latitude, longitude, accuracy];
            if (!obj) obj = landed();
            socket.emit("Client_data", { latitude, longitude });
        },
        error => { console.error(error) },
        { enableHighAccuracy: true }
    );
}, 2000); 

// Show position of user when another user lands
function landed() {
    console.log("Landed ");
    map.setView([my_position[0], my_position[1]], 13);
    Landedmarker = L.marker([my_position[0], my_position[1]]).addTo(map);
    Landedmarker.bindPopup(`<b>Your Position:</b><br>Accuracy: ${my_position[2]} meters`).openPopup();
    
    LandedCircle = L.circle([my_position[0], my_position[1]], {
        color: 'blue',
        fillColor: '#add8e6',
        fillOpacity: 0.5,
        radius: my_position[2]
    }).addTo(map);

    return { Landedmarker, LandedCircle };
}

// Handling routes
socket.on("Server_data", (data) => {
    console.log("My socket id:", socket.id);
    console.log(data);
    
    if (socket.id !== data[0]) { 
        var end = L.latLng(data[1].latitude, data[1].longitude);

        lastOtherPosition = data[1]; // Update last position

        // remove landed marker if present
        if (obj) {
            map.removeLayer(obj.Landedmarker);
            map.removeLayer(obj.LandedCircle);
        }
    }

    var start = L.latLng(my_position[0], my_position[1]);

    // If route doesn't exist, create it. Otherwise, just update waypoints.
    if (!Route) {
        Route = L.Routing.control({
            waypoints: [start, end],
            show: false,
        }).addTo(map);
    } else {
        Route.setWaypoints([start, end]); // **Only update waypoints instead of recreating the route**
    }
});
