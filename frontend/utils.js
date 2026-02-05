function todayCollectionName() {
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `locations_${y}_${m}_${day}`;
}

function getLast7CollectionNames() {
  const names = [];
  const d = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  for (let i = 0; i < 7; i++) {
    const temp = new Date(d);
    temp.setDate(d.getDate() - i);

    const y = temp.getFullYear();
    const m = String(temp.getMonth() + 1).padStart(2, "0");
    const day = String(temp.getDate()).padStart(2, "0");

    names.push(`locations_${y}_${m}_${day}`);
  }
  return names;
}


function clearLayer(layer) {
  if (layer) layer.clearLayers();
}

function canPerformScan() {
  const lastScan = localStorage.getItem("last_scan_time");
  if (!lastScan) return true;

  const diffMs = Date.now() - Number(lastScan);
  const diffMinutes = diffMs / (1000 * 60);

  return diffMinutes >= SCAN_COOLDOWN_MINUTES;
}

function updateLastScanTime() {
  localStorage.setItem("last_scan_time", Date.now());
}

function timeAgo(timestamp) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function collectionNameFromDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `locations_${y}_${m}_${day}`;
}

function getSessionLocation() {
  const lat = sessionStorage.getItem("latitude");
  const lng = sessionStorage.getItem("longitude");

  console.log(lat, lng);

  if (!lat || !lng) return null;

  return {
    lat: parseFloat(lat),
    lng: parseFloat(lng)
  };
}

function highlightSelectedListItem() {
  document
    .querySelectorAll("#listItems > div")
    .forEach(el => el.classList.remove("selected"));

  if (!selectedLocationKey) return;

  document
    .querySelectorAll("#listItems > div")
    .forEach(el => {
      if (el.dataset?.key === selectedLocationKey) {
        el.classList.add("selected");
      }
    });
}

async function resetToScanOnly(qrId) {
    // Hide buttons completely
    captureBtn.style.display = "none";
    submitBtn.style.display = "none";
    preview.style.display = "none";

    photoCaptured = false;

    statusEl.textContent = "Opening camera…";

    await startCamera();

    await new Promise(r => setTimeout(r, 500));

    await startQrScan(qrId);
}

function normalizeUrl(url) {
    return url.endsWith("/") ? url.slice(0, -1) : url;
}




