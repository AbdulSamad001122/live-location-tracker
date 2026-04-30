const socket = io();

let markers = {};
let myMarker = null;
let map = null;

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

function startTracking() {
  socket.on("server:send-new-location-to-users", (data) => {
    const { id, latitude, longitude } = data;

    if (typeof latitude !== "number" || typeof longitude !== "number") return;

    if (id === socket.id) return;

    if (!markers[id]) {
      markers[id] = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(`User: ${id}`)
        .openPopup();
    } else {
      markers[id].setLatLng([latitude, longitude]);
    }
  });

  setInterval(async () => {
    try {
      const position = await getCurrentLocation();

      const payload = {
        latitude: position.latitude,
        longitude: position.longitude,
      };

      socket.emit("client:send-location-to-server", payload);

      if (myMarker) {
        myMarker.setLatLng([payload.latitude, payload.longitude]);
      }

      map.panTo([payload.latitude, payload.longitude]);
    } catch (err) {
      console.error("Location error:", err);
    }
  }, 5000);
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const position = await getCurrentLocation();

    map = L.map("map").setView([position.latitude, position.longitude], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    myMarker = L.marker([position.latitude, position.longitude])
      .addTo(map)
      .bindPopup("You are here!")
      .openPopup();

    startTracking();
  } catch (err) {
    console.error("Location error:", err);
    alert("Enable GPS to continue");
  }
});
