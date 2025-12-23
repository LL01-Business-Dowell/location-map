// ===== DATACUBE API INTEGRATION =====

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
    await fetch(`${DATACUBE_BASE}/add_collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Collection may already exist", err);
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

  await fetch(`${DATACUBE_BASE}/crud`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function fetchTodayLocations() {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
    collection_name: todayCollectionName()
  });

  const res = await fetch(`${DATACUBE_BASE}/crud?${params}`);
  if (!res.ok) throw new Error("Fetch failed");

  return res.json();
}
