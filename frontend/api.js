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
  try {
    await ensureDailyCollection();
  } catch (e) {
    console.error("Collection creation failed", e);
    throw e;
  }
  const payload = {
    database_id: DATABASE_ID,
    collection_name: todayCollectionName(),
    documents: [
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
    collection_name: todayCollectionName(),
    filters: JSON.stringify({}),
    page: 1,
    page_size: 200
  });

  try {
    const res = await fetch(`${PROXY_BASE}/crud?${params}`);
    if (!res.ok) throw new Error("Fetch failed");
    const json = await res.json();

    // Ensure it's always an array
    if (Array.isArray(json)) return json;
    if (json.data && Array.isArray(json.data)) return json.data;
    return [];
  } catch (err) {
    console.error("Failed to fetch locations", err);
    return [];
  }
}

async function fetchWeekLocations() {
    const collections = getLast7CollectionNames();

    const requests = collections.map(name => {
        const params = new URLSearchParams({
            database_id: DATABASE_ID,
            collection_name: name,
            page: 1,
            page_size: 500
        });

        return fetch(`${PROXY_BASE}/crud?${params}`)
            .then(res => res.ok ? res.json() : null)
            .then(json => Array.isArray(json?.data) ? json.data : [])
            .catch(() => []); // collection may not exist
    });

    const results = await Promise.allSettled(requests);

    return results
        .filter(r => r.status === "fulfilled")
        .flatMap(r => r.value);
}


async function fetchLocationsByDate(dateStr) {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
    collection_name: collectionNameFromDate(dateStr),
    filters: JSON.stringify({}),
    page: 1,
    page_size: 200
  });

  try {
    const res = await fetch(`${PROXY_BASE}/crud?${params}`);
    if (!res.ok) throw new Error("Fetch failed");

    const json = await res.json();
    if (Array.isArray(json)) return json;
    if (json.data && Array.isArray(json.data)) return json.data;
    return [];
  } catch (err) {
    console.error("Failed to fetch locations", err);
    return [];
  }
}


