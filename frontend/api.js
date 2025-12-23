// ===== DATACUBE API PROXY INTEGRATION =====

const PROXY_BASE = "https://location-map-a89a.onrender.com/api";

async function ensureDailyCollection() {
  const collectionName = todayCollectionName();

  const payload = {
    database_id: DATABASE_ID,
    collections: [
      {
        name: collectionName,
        fields: [
          { name: "latitude", type: "number" },
          { name: "longitude", type: "number" },
          { name: "timestamp", type: "string" }
        ]
      }
    ]
  };

  try {
    await fetch(`${PROXY_BASE}/add_collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Collection may already exist or failed", err);
  }
}

async function saveLocation(lat, lng) {
  const payload = {
    database_id: DATABASE_ID,
    collection_name: todayCollectionName(),
    data: [
      {
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await fetch(`${PROXY_BASE}/crud`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Failed to save location", err);
  }
}

async function fetchTodayLocations() {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
    collection_name: todayCollectionName()
  });

  try {
    const res = await fetch(`${PROXY_BASE}/crud?${params}`);
    if (!res.ok) throw new Error("Fetch failed");
    return res.json();
  } catch (err) {
    console.error("Failed to fetch locations", err);
    return [];
  }
}
