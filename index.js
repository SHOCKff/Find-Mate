// Importing required libraries
const http = require("http");
const path = require("path");
const express = require("express");
const { Server } = require("socket.io");

// Initialize Express
const app = express();
const server = http.createServer(app);

app.use(express.static(path.resolve("./src")));

// API to check the room ID (but does not control WebSockets)
app.get("/trackoneonone", (req, res) => {
    res.sendFile(path.resolve("./src/index.html"));
    // console.log("Requested room ID: ", req.params.roomid);
    // res.send(`WebSocket room setup for: ${req.params.roomid}`);
});

// Initialize WebSocket server
const io = new Server(server);

const rooms = new Map(); // Store users per room

// WebSocket connection event
io.on("connection", (socket) => {
    console.log(`A user tries: ${socket.id}`);

    // Handle user joining a room
    socket.on("joinRoom", (roomid) => {
        const roomSize = (io.sockets.adapter.rooms.get(roomid)?.size || 0) +1;
        console.log(roomSize)
        if (roomSize <= 2) {
            socket.join(roomid);

            // Store the user's room
            rooms.set(socket.id, roomid);

            console.log(`User ${socket.id} joined room: ${roomid}`);
            socket.emit("roomJoined", `You have joined room: ${roomid}`);
            socket.to(roomid).emit("Server_data", `User ${socket.id} has joined the room.`);
        } else {
            socket.emit("data", "Room is full. Only 2 users are allowed.");
            console.log("Room is full. Only 2 users are allowed.")
        }
    });

    // Handle disconnection and remove user from the room
    socket.on("disconnect", () => {
        const roomid = rooms.get(socket.id); // Get room of disconnected user
        if (roomid) {
            console.log(`User ${socket.id} left room: ${roomid}`);
            socket.to(roomid).emit("Server_data", `User ${socket.id} has left the room.`);
            rooms.delete(socket.id); // Remove from tracking
        }
    });

    //Handling clients data 
    socket.on("Client_data", (coords) => {
        const roomid = rooms.get(socket.id); // Get the room the socket is in
        console.log(roomid,":",socket.id,":",coords);
        if (roomid) {
            socket.to(roomid).emit("Server_data", [socket.id,coords]); // Send the coords only to the clients in the same room
        }
    });
    

});



//Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
