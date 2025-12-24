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
