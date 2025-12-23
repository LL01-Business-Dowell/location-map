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
  L.control.zoom({
    position: "bottomright"
  }).addTo(map);

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

function renderMap() {
  clearLayer(markerLayer);

  normalizedData.forEach(p => {
    const marker = L.marker([p.lat, p.lng]);

    marker.bindPopup(`
      <b>📍 Location</b><br/>
      <b>Scans:</b> ${p.scans.length}<br/>
      <small>Last scan: ${timeAgo(p.scans[p.scans.length - 1].timestamp)}</small>
    `);

    markerLayer.addLayer(marker);
  });

  renderLocationList();
  updateScanCounter(); // 🔥 NEW
}



function renderLocationList() {
  const container = document.getElementById("listItems");
  container.innerHTML = "";

  normalizedData.forEach(p => {
    const div = document.createElement("div");

    const lastScan = p.scans[p.scans.length - 1].timestamp;

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
  let totalScans = 0;

  normalizedData.forEach(p => {
    totalScans += p.scans.length;
  });

  const el = document.getElementById("scanCount");
  if (el) el.textContent = totalScans;
}


