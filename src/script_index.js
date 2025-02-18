var map = L.map('map');
my_position = []; 
var obj = null; 
var Route = null;
var lastOtherPosition = null; 
var manuplated_logsClass = document.getElementsByClassName("leaflet-control-attribution leaflet-control")[0];
manuplated_logsClass.innerText="Status : Loading your current location..." ;


L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Adjust zoom level based on accuracy
function getZoomLevel(accuracy) {
    if (accuracy < 5) return 19; // Very high accuracy
    if (accuracy < 10) return 18;
    if (accuracy < 20) return 17;
    if (accuracy < 50) return 16;
    if (accuracy < 100) return 15;
    if (accuracy < 200) return 14;
    if (accuracy < 500) return 13;
    if (accuracy < 1000) return 12;
    return 11; // Default zoom for low accuracy
}

// WebSocket connection 
const socket = io();
const roomid = new URLSearchParams(window.location.search).get('roomid');
socket.emit("joinRoom", roomid);

// Get current location while connected with a timeout value
const intervalId = setInterval(async () => {
    //check for logs 

    await navigator.geolocation.getCurrentPosition(
        function (position) {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            my_position = [latitude, longitude, accuracy];
            if (!obj) obj = landed();
            socket.emit("Client_data", { latitude, longitude , accuracy});
        },
        error => { console.error(error) },
        { enableHighAccuracy: true }
    );
}, 4000); 

// Show position of user when another user lands
function landed() {
    console.log("Landed ");
    map.setView([my_position[0], my_position[1]], getZoomLevel(my_position[2]));
    Landedmarker = L.marker([my_position[0], my_position[1]]).addTo(map);
    Landedmarker.bindPopup(`<b>Your Position:</b><br>Accuracy: ${my_position[2]} meters`).openPopup();
    manuplated_logsClass.innerText="Status : Waiting for other user to connect..." ;

    LandedCircle = L.circle([my_position[0], my_position[1]], {
        color: 'blue',
        fillColor: '#add8e6',
        fillOpacity: 0.5,
        radius: my_position[2]
    }).addTo(map);

    return { Landedmarker, LandedCircle };
}


// Handling routes and update route also send data to log box
socket.on("Server_data", (data) => {
    console.log("My socket id:", socket.id);
    console.log(data);
    // all related to other user 
    if (socket.id !== data[0]) {  
        var end = L.latLng(data[1].latitude, data[1].longitude);
        manuplated_logsClass.innerText=`Status : Destination with an accuracy of ${Math.floor(data[1].accuracy)} m` ;

        lastOtherPosition = data[1]; // Update last position
      //  logMessage(logText); // Append the log message in the logs box
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

// Handling room full
socket.on("RoomFull", (data) => {alert("2 users are arleady acessing, third user can't be join in same room !")});


