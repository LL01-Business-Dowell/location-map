let lastScanTime = 0;
const SCAN_COOLDOWN_MS = 60 * 1000; // 1 min cooldown

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    tap: false,
    inertia: true,
    worldCopyJump: true
  }).setView([20.5937, 78.9629], 5);

  // OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 19
  }).addTo(map);

  // Mobile-friendly zoom controls
  L.control.zoom({ position: "bottomright" }).addTo(map);

  // Marker layer
  markerLayer = L.layerGroup().addTo(map);
}

function normalizeData(rows) {
  const grouped = {};

  rows.forEach(r => {
    const key = `${r.latitude}_${r.longitude}`;
    if (!grouped[key]) {
      grouped[key] = {
        lat: r.latitude,
        lng: r.longitude,
        scans: []
      };
    }
    grouped[key].scans.push({
      lat: r.latitude,
      lng: r.longitude,
      timestamp: r.timestamp
    });
  });

  normalizedData = Object.values(grouped);
}

function applyDateFilter(filter) {
  activeFilter = filter;
  renderMap();
}

/**
 * Render map markers and optionally highlight newly added locations
 * @param {boolean} highlightNew - set true for newly added location to bounce
 */
function renderMap(highlightNew = false) {
  clearLayer(markerLayer);

  normalizedData.forEach(p => {
    const marker = L.marker([p.lat, p.lng]);

    const lastScan = p.scans[p.scans.length - 1].timestamp;
    marker.bindPopup(`
      <b>📍 Location</b><br/>
      <b>Scans:</b> ${p.scans.length}<br/>
      <small>Last scan: ${timeAgo(lastScan)}</small>
    `);

    // Animate if newly added
    if (highlightNew && p.scans[p.scans.length - 1].timestamp === rawMapData[rawMapData.length - 1]?.timestamp) {
      const el = marker.getElement ? marker.getElement() : null;
      if (el) el.classList.add("bounce-marker");
      else marker.on("add", function() {
        const mEl = marker.getElement();
        if (mEl) mEl.classList.add("bounce-marker");
      });
    }

    markerLayer.addLayer(marker);
  });

  renderLocationList();
  updateScanCounter();
}

function renderLocationList() {
  const container = document.getElementById("listItems");
  container.innerHTML = "";

  normalizedData.forEach(p => {
    const lastScan = p.scans[p.scans.length - 1].timestamp;

    const div = document.createElement("div");
    div.innerHTML = `
      <strong>📍 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</strong><br/>
      <span><strong>Scans:</strong> ${p.scans.length}</span><br/>
      <small>Last scan: ${timeAgo(lastScan)}</small>
    `;

    div.onclick = () => {
      map.setView([p.lat, p.lng], 16);
      sheet.classList.add("collapsed"); // auto-hide on mobile
    };

    container.appendChild(div);
  });
}

function updateScanCounter() {
  const el = document.getElementById("scanCount");
  if (!el) return;

  let totalScans = 0;
  normalizedData.forEach(p => totalScans += p.scans.length);
  el.textContent = totalScans;
}

// =======================
// Geolocation + cooldown
// =======================
async function trySaveLocation(lat, lng) {
  const now = Date.now();

  // Only save if cooldown expired
  if (now - lastScanTime > SCAN_COOLDOWN_MS) {
    try {
      await saveLocation(lat, lng);
      lastScanTime = now;

      // Optimistic UI update
      rawMapData.push({
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString()
      });

      normalizeData(rawMapData);
      renderMap(true); // highlight newly added
    } catch (err) {
      console.error("Failed to save location:", err);
    }
  } else {
    // Still fetch existing data for cooldown
    await loadDataAndRender();
  }
}

// =======================
// Helper to show "X minutes ago"
function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + " min ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + " hrs ago";
  return Math.floor(diff / 86400000) + " days ago";
}
