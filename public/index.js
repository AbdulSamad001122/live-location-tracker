import { OIDC_CONFIG } from './config.js';

let socket = null;
let markers = {};
let myMarker = null;
let map = null;
let isAuthenticated = false;
let userProfile = null;

const loadingOverlay = document.getElementById("loading-overlay");
const loginContainer = document.getElementById("login-container");
const appContainer = document.getElementById("app-container");

function getAuthToken() {
  return localStorage.getItem("id_token") || localStorage.getItem("access_token");
}

function clearAuthTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("id_token");
  localStorage.removeItem("oidc_state");
}

async function checkAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");

  if (code) {
    const savedState = localStorage.getItem("oidc_state");
    if (state !== savedState) {
      hideLoading();
      showLogin();
      return false;
    }

    try {
      const response = await fetch("/api/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          redirectUri: OIDC_CONFIG.redirectUri,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) localStorage.setItem("access_token", data.access_token);
        if (data.id_token) localStorage.setItem("id_token", data.id_token);
        window.history.replaceState({}, document.title, "/");
      }
    } catch (err) {
      console.error(err);
    }
  }

  const token = getAuthToken();

  if (token) {
    try {
      const response = await fetch(OIDC_CONFIG.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        userProfile = await response.json();
        isAuthenticated = true;
        
        document.getElementById("user-name").textContent = `Logged in as: ${userProfile.name || userProfile.email || "User"}`;
        
        hideLoading();
        showApp();
        return true;
      } else {
        if (response.status === 401) {
          clearAuthTokens();
        }
        isAuthenticated = false;
        userProfile = null;
      }
    } catch (err) {
      console.error(err);
      isAuthenticated = false;
    }
  }

  hideLoading();
  showLogin();
  return false;
}

function login() {
  const state = Math.random().toString(36).substring(7);
  localStorage.setItem("oidc_state", state);

  const authUrl = `${OIDC_CONFIG.authorizeEndpoint}?client_id=${OIDC_CONFIG.clientId}&redirect_uri=${encodeURIComponent(OIDC_CONFIG.redirectUri)}&response_type=code&state=${state}`;
  window.location.href = authUrl;
}

function logout() {
  clearAuthTokens();
  window.location.href = "/";
}

function showLoading() {
  loadingOverlay.style.display = "flex";
}

function hideLoading() {
  loadingOverlay.style.display = "none";
}

function showLogin() {
  loginContainer.style.display = "flex";
  appContainer.style.display = "none";
}

function showApp() {
  loginContainer.style.display = "none";
  appContainer.style.display = "block";
}

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

function initSocket() {
  socket = io();

  socket.on("error", (err) => {
    if (err.message === "Unauthorized") {
      logout();
    }
  });

  socket.on("server:send-new-location-to-users", (data) => {
    const { id, name, latitude, longitude } = data;

    if (typeof latitude !== "number" || typeof longitude !== "number") return;

    const myId = userProfile.id || userProfile.sub;
    if (id === myId) return;

    if (!markers[id]) {
      markers[id] = L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(`User: ${name || id}`)
        .openPopup();
    } else {
      markers[id].setLatLng([latitude, longitude]);
    }
  });

  socket.on("user-disconnect", (userId) => {
    if (markers[userId]) {
      map.removeLayer(markers[userId]);
      delete markers[userId];
    }
  });

  setInterval(async () => {
    if (!socket.connected) return;
    
    try {
      const position = await getCurrentLocation();

      const payload = {
        latitude: position.latitude,
        longitude: position.longitude,
        token: getAuthToken()
      };

      socket.emit("client:send-location-to-server", payload);

      if (myMarker) {
        myMarker.setLatLng([payload.latitude, payload.longitude]);
      }

      map.panTo([payload.latitude, payload.longitude]);
    } catch (err) {
      console.error(err);
    }
  }, 5000);
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginLink = document.querySelector(".login-btn");
  if (loginLink) {
    loginLink.addEventListener("click", (e) => {
      e.preventDefault();
      login();
    });
  }

  const logoutLink = document.querySelector(".logout-btn");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  const authenticated = await checkAuth();
  
  if (!authenticated) return;

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

    if (myMarker._icon) {
      myMarker._icon.classList.add("my-location-marker");
    }

    initSocket();
  } catch (err) {
    console.error(err);
    alert("Enable GPS to continue");
  }
});
