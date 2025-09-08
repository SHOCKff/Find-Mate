<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Real-Time Map Tracking (fixed)</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
  <!-- Routing Machine CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.css" />

  <style>
    html,body,#map { height: 100%; margin: 0; padding: 0; }
    #map { width: 100vw; height: 100vh; }
    .status-control { font: 14px/1.2 sans-serif; padding: 6px 8px; background: rgba(255,255,255,0.85); border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <div id="map"></div>

  <!-- Socket.IO client (served by your Node/socket.io server) -->
  <script src="/socket.io/socket.io.js"></script>

  <!-- Leaflet & Routing Machine -->
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-routing-machine/dist/leaflet-routing-machine.js"></script>

  <!-- Inline script (no external script file to avoid path mistakes) -->
  <script>
  (function () {
    'use strict';

    // ===== Map setup =====
    const map = L.map('map').setView([20.5937, 78.9629], 5); // default India-centered view
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // ===== Status control (safe alternative to relying on leaflet-control-attribution DOM) =====
    let statusDiv = null;
    const statusControl = L.control({ position: 'bottomleft' });
    statusControl.onAdd = function () {
      statusDiv = L.DomUtil.create('div', 'status-control');
      statusDiv.innerText = 'Status : Initializing...';
      return statusDiv;
    };
    statusControl.addTo(map);

    function setStatus(txt) {
      if (statusDiv) statusDiv.innerText = 'Status : ' + txt;
      else console.log('Status :', txt);
    }

    // ===== Utility: zoom from accuracy =====
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

    // ===== Socket.IO: only use if client script loaded correctly =====
    let socket = null;
    if (typeof io !== 'undefined') {
      try {
        socket = io();
        socket.on('connect', () => {
          setStatus('Connected to server');
          const roomid = new URLSearchParams(window.location.search).get('roomid');
          if (roomid) socket.emit('joinRoom', roomid);
        });
        socket.on('disconnect', () => setStatus('Disconnected from server'));
      } catch (e) {
        console.warn('Socket.IO initialization failed:', e);
        setStatus('Socket.IO init failed — realtime disabled');
        socket = null;
      }
    } else {
      console.warn('Socket.IO client (io) not found. /socket.io/socket.io.js may not be served.');
      setStatus('Socket.IO client not found — realtime disabled');
    }

    // ===== Variables to hold markers/circles/route =====
    let myPos = null;           // {lat, lng, acc}
    let ownMarker = null;       // L.marker
    let ownCircle = null;       // L.circle
    let otherMarker = null;     // Other user's marker
    let otherCircle = null;     // Other user's accuracy circle
    let lastOtherPos = null;    // {lat, lng, acc}
    let routeControl = null;    // L.Routing control

    // ===== Geolocation update (initial + periodic) =====
    function handlePositionSuccess(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const acc = position.coords.accuracy;

      myPos = { lat, lng, acc };
      setStatus('Your position acquired — accuracy ' + Math.floor(acc) + ' m');

      // create or update own marker/circle
      if (!ownMarker) {
        ownMarker = L.marker([lat, lng], { draggable: false }).addTo(map);
        ownMarker.bindPopup(`<b>Your Position:</b><br>Accuracy: ${Math.floor(acc)} meters`);
        ownCircle = L.circle([lat, lng], {
          color: 'blue',
          fillColor: '#add8e6',
          fillOpacity: 0.5,
          radius: acc
        }).addTo(map);
        map.setView([lat, lng], getZoomLevel(acc));
      } else {
        ownMarker.setLatLng([lat, lng]);
        if (ownMarker.getPopup()) ownMarker.getPopup().setContent(`<b>Your Position:</b><br>Accuracy: ${Math.floor(acc)} meters`);
        ownCircle.setLatLng([lat, lng]);
        ownCircle.setRadius(acc);
      }

      // emit to server if socket available
      if (socket && typeof socket.emit === 'function') {
        try {
          socket.emit('Client_data', { latitude: lat, longitude: lng, accuracy: acc });
        } catch (e) {
          console.warn('Failed to emit Client_data', e);
        }
      }
    }

    function handlePositionError(err) {
      console.warn('Geolocation error:', err);
      setStatus('Unable to get location: ' + (err && err.message ? err.message : 'unknown'));
    }

    function requestPositionOnce() {
      if (!('geolocation' in navigator)) {
        setStatus('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(handlePositionSuccess, handlePositionError, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000
      });
    }

    // initial position & periodic updates every 4s
    requestPositionOnce();
    const posIntervalId = setInterval(requestPositionOnce, 4000);

    // ===== Socket handlers (if available) =====
    if (socket) {
      // Server_data expected format: [senderSocketId, { latitude, longitude, accuracy }]
      socket.on('Server_data', (data) => {
        try {
          // Support both array form and direct object form (defensive)
          let senderId = null;
          let coords = null;
          if (Array.isArray(data) && data.length >= 2) {
            senderId = data[0];
            coords = data[1];
          } else if (data && data.latitude !== undefined && data.longitude !== undefined) {
            // maybe the server sent only coords
            coords = data;
            senderId = null;
          } else if (data && data.sender && data.coords) {
            senderId = data.sender;
            coords = data.coords;
          } else {
            console.warn('Unknown Server_data format:', data);
            return;
          }

          // ignore messages from ourselves (socket.id may be undefined briefly if not connected)
          if (senderId && socket.id && senderId === socket.id) return;
          if (!coords || coords.latitude === undefined || coords.longitude === undefined) return;

          lastOtherPos = { lat: coords.latitude, lng: coords.longitude, acc: coords.accuracy };
          setStatus('Destination with an accuracy of ' + Math.floor(coords.accuracy) + ' m');

          // update or create other user's marker & circle
          if (!otherMarker) {
            otherMarker = L.marker([coords.latitude, coords.longitude], { draggable: false }).addTo(map);
            otherMarker.bindPopup(`<b>Other User</b><br>Accuracy: ${Math.floor(coords.accuracy)} meters`);
            otherCircle = L.circle([coords.latitude, coords.longitude], {
              color: 'red',
              fillColor: '#f03',
              fillOpacity: 0.5,
              radius: coords.accuracy
            }).addTo(map);
          } else {
            otherMarker.setLatLng([coords.latitude, coords.longitude]);
            if (otherMarker.getPopup()) otherMarker.getPopup().setContent(`<b>Other User</b><br>Accuracy: ${Math.floor(coords.accuracy)} meters`);
            otherCircle.setLatLng([coords.latitude, coords.longitude]);
            otherCircle.setRadius(coords.accuracy);
          }

          // update or create route if we have our position
          if (myPos) {
            const start = L.latLng(myPos.lat, myPos.lng);
            const end = L.latLng(coords.latitude, coords.longitude);

            if (!routeControl) {
              routeControl = L.Routing.control({
                waypoints: [start, end],
                show: false,
                addWaypoints: false,
                routeWhileDragging: false,
                fitSelectedRoutes: true
              }).addTo(map);
            } else {
              routeControl.setWaypoints([start, end]);
            }
          }
        } catch (e) {
          console.error('Error handling Server_data:', e);
        }
      });

      socket.on('RoomFull', () => {
        alert("2 users are already accessing, third user can't join in the same room!");
        setStatus('Room full');
      });
    }

    // Clean up (disconnect socket if present) — optional
    window.addEventListener('beforeunload', () => {
      try {
        if (socket && typeof socket.disconnect === 'function') socket.disconnect();
      } catch (e) { /* ignore */ }
      clearInterval(posIntervalId);
    });

  })();
  </script>
</body>
</html>
