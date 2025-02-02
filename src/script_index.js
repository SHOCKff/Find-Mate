var map = L.map('map');
my_position = []; //for making  watch corodinaates  global
var obj = null; //for making landed circle state  global
var Route = null;
// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// WebSocket connection 
const socket = io();
const roomid = new URLSearchParams(window.location.search).get('roomid');
socket.emit("joinRoom", roomid);

// Get current location while connected
navigator.geolocation.watchPosition(
    function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        my_position = [latitude, longitude, accuracy];
        if (!obj) obj = landed();
        socket.emit("Client_data", { latitude, longitude });
    },
    error => { console.error(error) },
);

// Show position of user when another user lands
function landed() {
    console.log("Landed ");
    map.setView([my_position[0], my_position[1]], 13);
    Landedmarker = L.marker([my_position[0], my_position[1]]).addTo(map);
    Landedmarker.bindPopup(`<b>Your Position:</b><br>Accuracy: ${my_position[2]} meters`).openPopup();
    // circle
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
    // remove landed marker if present
     map.removeLayer(obj.Landedmarker);
     map.removeLayer(obj.LandedCircle);
    }

    var start = L.latLng(my_position[0], my_position[1]);
    
    // Add routing control
    if(Route) {map.removeControl(Route)}
    Route = L.Routing.control({
        waypoints: [start, end],
        show: false,
    }).addTo(map);
    console.log(Route)
});
