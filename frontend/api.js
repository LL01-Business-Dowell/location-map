// ===== DATACUBE API PROXY INTEGRATION =====

const PROXY_BASE = "https://location-map-a89a.onrender.com/api";

async function ensureDailyCollection(dbId) {
  const collectionName = todayCollectionName();

  const payload = {
    database_id: dbId,
    collections: [
      {
        name: collectionName,
        fields: [
          { name: "latitude", type: "number" },
          { name: "longitude", type: "number" },
          { name: "date", type: "string" },
          { name: "time", type: "string" },
          { name: "qr_id", type: "number" },
          { name: "qr_image", type: "string" },
          { name: "feedback", type: "string" },
          { name: "uid", type: "string" }
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

async function saveVerificationPhoto({ dbId, timestamp, qrId, imageBase64 }) {
  await ensureDailyCollection(dbId);

  const payload = {
    database_id: dbId,
    collection_name: todayCollectionName(),
    documents: [
      {
        latitude: 0,
        longitude: 0,
        date: "",
        time: "",
        qr_id: qrId,
        qr_image: imageBase64,
        feedback: "",
        uid: timestamp
      }
    ]
  };

  const res = await fetch(`${PROXY_BASE}/crud`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("Verification photo save failed");
}


async function saveLocation(dbId, lat, lng, date, time, qrId, uid) {
  try {
    await ensureDailyCollection(dbId);
  } catch (e) {
    console.error("Collection creation failed", e);
    throw e;
  }
  const payload = {
    database_id: dbId,
    collection_name: todayCollectionName(),
    filters: {
      qr_id: qrId,
      uid: uid
    },
    update_data: {
      latitude: lat,
      longitude: lng,
      date: date,
      time: time,
    }
  };

  try {
    await fetch(`${PROXY_BASE}/crud`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Failed to save location", err);
  }
}

async function fetchTodayLocations(dbId, qrId) {
  const params = new URLSearchParams({
    database_id: dbId,
    collection_name: todayCollectionName(),
    filters: JSON.stringify({ "qr_id": qrId }),
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

async function fetchWeekLocations(dbId, qrId) {
  const collections = getLast7CollectionNames();

  const requests = collections.map(name => {
    const params = new URLSearchParams({
      database_id: dbId,
      collection_name: name,
      filters: JSON.stringify({ "qr_id": qrId }),
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


async function fetchLocationsByDate(dateStr, dbId, qrId) {
  const params = new URLSearchParams({
    database_id: dbId,
    collection_name: collectionNameFromDate(dateStr),
    filters: JSON.stringify({ "qr_id": qrId }),
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

async function saveFeedback({ db_id, uid, feedback }) {
  const payload = {
    database_id: db_id,
    collection_name: todayCollectionName(),
    filters: {
      uid: uid
    },
    update_data: {
      feedback: feedback
    }
  };

  await fetch(`${PROXY_BASE}/crud`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function fetchClients() {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
  });

  try {
    const res = await fetch(`${PROXY_BASE}/list_collections?${params}`);
    if (!res.ok) throw new Error("Fetch failed");
    const json = await res.json();

    // 🔹 Extract collection names
    const collections = Array.isArray(json.collections)
      ? json.collections
      : [];

    return collections.map(c => ({
      client_id: c.name,
      client_name: c.name
    }));

  } catch (err) {
    console.error("Failed to fetch collections", err);
    return [];
  }
}

async function fetchQrCodes(clientId) {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
    collection_name: clientId,
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
    console.error("Failed to fetch QR Codes", err);
    return [];
  }
}

async function disableQrCode(clientId, qrId) {
  const payload = {
    database_id: DATABASE_ID,
    collection_name: clientId,
    filters: { qr_id: qrId },
    update_data: { qr_status: 0 }
  };

  const res = await fetch(`${PROXY_BASE}/crud`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error("Disable failed");
  return res.json();
}


async function createClient(name) {
  const payload = {
    db_name: name,
    collections: [
      {
        name: todayCollectionName(),
        fields: [
          {
            name: "latitude",
            type: "number"
          },
          {
            name: "longitude",
            type: "number"
          },
          {
            name: "date",
            type: "string"
          },
          {
            name: "time",
            type: "string"
          },
          {
            name: "qr_id",
            type: "number"
          },
          {
            name: "qr_image",
            type: "string"
          },
          {
            name: "feedback",
            type: "string"
          },
          {
            name: "uid",
            type: "string"
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(`${PROXY_BASE}/create_database`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Create DB failed");

    return await res.json();
  } catch (err) {
    console.error("Failed to create client", err);
  }
}

async function registerClient(dbId, name) {
  const payload = {
    database_id: DATABASE_ID,
    collections: [
      {
        name: name,
        fields: [
          {
            name: "qr_id",
            type: "number"
          },
          {
            name: "db_id",
            type: "number"
          },
          {
            name: "date",
            type: "string"
          },
          {
            name: "time",
            type: "string"
          },
          {
            name: "qr_name",
            type: "string"
          },
          {
            name: "qr_url",
            type: "string"
          },
          {
            name: "qr_logo",
            type: "string"
          },
          {
            name: "qr_status",
            type: "number"
          }
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
    console.error("Failed to register client", err);
  }
}

async function addDbId(dbId, name, date, time) {
  const payload = {
    database_id: DATABASE_ID,
    collection_name: name,
    documents: [
      {
        qr_id: 0,
        db_id: dbId,
        date: date,
        time: time,
        qr_name: "QR_Name",
        qr_url: "QR URL",
        qr_logo: "QR_Logo",
        qr_status: 0
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
    console.error("Failed to save DB ID", err);
  }
}

async function createQrCode(clientId, qrId, qrName, qrUrl, clientName, date, time, dbId, qrLogo) {

  //const url = `${qrUrl}?dbId=${encodeURIComponent(dbId)}&qrId=${encodeURIComponent(qrId)}`;

  const payload = {
    database_id: DATABASE_ID,
    collection_name: clientName,
    documents: [
      {
        qr_id: qrId,
        db_id: dbId,
        date: date,
        time: time,
        qr_name: qrName,
        qr_url: qrUrl,
        qr_logo: qrLogo || null,
        qr_status: 1
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
    console.error("Failed to save QR Code", err);
  }
}

async function updateQrCode({
  old_qr_id,
  new_qr_id,
  qr_name,
  qr_url,
  qr_logo,
  client_name,
  db_id,
  date,
  time
}) {
  //const finalQrUrl = `${qr_url}?dbId=${encodeURIComponent(db_id)}&qrId=${encodeURIComponent(new_qr_id)}`;

  const payload = {
    database_id: DATABASE_ID,
    collection_name: client_name,
    filters: {
      qr_id: old_qr_id
    },
    update_data: {
      qr_id: new_qr_id,
      qr_name: qr_name,
      qr_url: qr_url,
      qr_logo: qr_logo,
      date: date,
      time: time
    }
  };

  try {
    await fetch(`${PROXY_BASE}/crud`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("Failed to update QR Code", err);
    throw err;
  }
}


async function fetchDbId(clientName) {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
    collection_name: clientName,
    filters: JSON.stringify({ "qr_id": 0 }),
    page: 1,
    page_size: 200
  });

  try {
    const res = await fetch(`${PROXY_BASE}/crud?${params}`);
    if (!res.ok) throw new Error("Fetch failed");
    const json = await res.json();

    // Ensure we get an array of documents
    const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    // Return the db_id of the first document, or null if not found
    if (docs.length === 0) return null;
    return docs[0].db_id ?? null;

  } catch (err) {
    console.error("Failed to fetch DB ID", err);
    return null;
  }
}

async function checkQrIdExists(clientName, qrId) {
  const params = new URLSearchParams({
    database_id: DATABASE_ID,
    collection_name: clientName,
    filters: JSON.stringify({ qr_id: qrId }),
    page: 1,
    page_size: 1
  });

  try {
    const res = await fetch(`${PROXY_BASE}/crud?${params}`);
    if (!res.ok) throw new Error("Fetch failed");

    const json = await res.json();
    const data = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
        ? json.data
        : [];

    return data.length > 0; // true = exists
  } catch (err) {
    console.error("QR ID check failed", err);
    return false;
  }
}

// async function buildEncryptedQrUrl(baseUrl, dbId, qrId) {
//   const payload = {
//     base_url: baseUrl,
//     db_id: String(dbId),   // normalize
//     qr_id: String(qrId)    // normalize
//   };

//   try {
//     const res = await fetch(`${PROXY_BASE}/build_qr_url`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload)
//     });

//     if (!res.ok) {
//       const text = await res.text();
//       throw new Error(`QR URL build failed: ${text}`);
//     }

//     const json = await res.json();
//     return json.url;
//   } catch (err) {
//     console.error("Failed to build encrypted QR URL", err);
//     throw err;
//   }
// }

async function buildEncryptedQrUrl(verifyBaseUrl, targetUrl, dbId, qrId) {
  const payload = {
    base_url: verifyBaseUrl,     // fixed verify page
    target_url: targetUrl,       // user input URL
    db_id: String(dbId),
    qr_id: String(qrId)
  };

  try {
    const res = await fetch(`${PROXY_BASE}/build_qr_url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`QR URL build failed: ${text}`);
    }

    const json = await res.json();
    return json.url;   // this becomes the QR content
  } catch (err) {
    console.error("Failed to build encrypted QR URL", err);
    throw err;
  }
}

async function decryptToken(token) {
  const res = await fetch(`${PROXY_BASE}/decrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  });

  if (!res.ok) {
    throw new Error("Decrypt failed");
  }

  return res.json();
}

async function encryptParams(data) {
  const res = await fetch(`${PROXY_BASE}/encrypt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    throw new Error("Encrypt failed");
  }

  return res.json();
}

async function recordQrScan({
  document
}) {

  const response = await fetch(`${PROXY_BASE}/crud`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      database_id: QR_SCAN_DB_ID,
      collection_name: "medsign_qr_scan",
      documents: document
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();

  if (!data.success || !data.inserted_ids?.length) {
    throw new Error("Insert failed - no ID returned");
  }

  return data.inserted_ids[0];
}




