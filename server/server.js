import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";


import FormData from "form-data";
import multer from "multer";

const upload = multer();


const app = express();
const PORT = process.env.PORT || 3001;

// ===== CONFIG =====
// const DATACUBE_BASE = "https://datacube.uxlivinglab.online/api";
const DATACUBE_BASE = "https://datacube.uxlivinglab.online/api/v2"
const DATACUBE_API_KEY = process.env.DATACUBE_API_KEY;

const DB_ID = "69985c0844ca8a1af7fd639e";

// ===== MIDDLEWARE =====
app.use(cors({
  origin: "*",          // allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());

// ===== HELPERS =====
function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Api-Key ${DATACUBE_API_KEY}`
  };
}

// ===== ALIAS HELPER =====
function generateAlias(length = 8) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

async function storeQrToken({ alias, target_url, db_id, qr_id }) {
  const payload = {
    database_id: DB_ID,
    collection_name: "qr_tokens",
    documents: [
      {
        alias,
        target_url,
        db_id: String(db_id),
        qr_id: String(qr_id),
        created_at: new Date().toISOString()
      }
    ]
  };

  const res = await fetch(`${DATACUBE_BASE}/crud`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to store QR token: ${text}`);
  }

  return res.json();
}

// ---------- ADD COLLECTION ----------
app.post("/api/add_collection", async (req, res) => {
  try {
    const r = await fetch(`${DATACUBE_BASE}/add_collection`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(req.body)
    });

    const data = await r.json(); // parse as JSON
    res.status(r.status).json(data);
  } catch (err) {
    console.error("add_collection error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CRUD (POST) ----------
app.post("/api/crud", async (req, res) => {
  try {
    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(req.body)
    });

    const data = await r.json(); // parse as JSON
    res.status(r.status).json(data);
  } catch (err) {
    console.error("crud POST error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CRUD (PUT) ----------
app.put("/api/crud", async (req, res) => {
  try {
    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(req.body)
    });

    const data = await r.json(); // parse as JSON
    res.status(r.status).json(data);
  } catch (err) {
    console.error("crud POST error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CRUD (GET) ----------
app.get("/api/crud", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r = await fetch(`${DATACUBE_BASE}/crud?${qs}`, {
      headers: authHeaders()
    });

    const data = await r.json(); // parse as JSON
    res.status(r.status).json(data);
  } catch (err) {
    console.error("crud GET error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- LIST COLLECTIONS ----------
app.get("/api/list_collections", async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r = await fetch(`${DATACUBE_BASE}/list_collections?${qs}`, {
      headers: authHeaders()
    });

    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error("list_collection error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CREATE DATABASE ----------
app.post("/api/create_database", async (req, res) => {
  try {
    const r = await fetch(`${DATACUBE_BASE}/create_database`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(req.body)
    });

    const data = await r.json(); // parse as JSON
    res.status(r.status).json(data);
  } catch (err) {
    console.error("crud POST error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

app.post("/api/build_qr_url", async (req, res) => {
  try {
    const { base_url, target_url, db_id, qr_id } = req.body || {};

    if (!base_url || !target_url || !db_id || !qr_id) {
      return res.status(400).json({ error: "Missing required fields: base_url, target_url, db_id, qr_id" });
    }

    const cleanBase = base_url.endsWith("/") ? base_url.slice(0, -1) : base_url;

    // 1. Encrypt the payload
    // const token = encryptPayload({ target_url, db_id, qr_id });

    // 2. Generate a short unique alias
    const alias = generateAlias(8);

    // 3. Store token + alias in DataCube
    await storeQrToken({ alias, target_url, db_id, qr_id });

    // 4. Return short alias-based URL
    const finalUrl = `${cleanBase}?id=${alias}`;

    res.json({ url: finalUrl, alias });

  } catch (err) {
    console.error("QR build error:", err.message);
    res.status(500).json({ error: "Failed to build QR URL" });
  }
});

app.post("/api/generate_qr", upload.single("logo"), async (req, res) => {
  try {
    const { link, color } = req.body;

    if (!link || !color) {
      return res.status(400).json({ error: "Missing link or color" });
    }

    const formData = new FormData();
    formData.append("link", link);
    formData.append("color", color);

    if (req.file) {
      formData.append("logo", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype
      });
    }

    const response = await fetch(
      "https://www.dowellsmartlabelling.uxlivinglab.org/api/v1/qr/create-custom-qr",
      {
        method: "POST",
        body: formData,
        headers: formData.getHeaders()
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).send(text);
    }

    //Stream PNG directly back
    res.setHeader("Content-Type", "image/png");
    response.body.pipe(res);

  } catch (err) {
    console.error("QR proxy error:", err);
    res.status(500).json({ error: "QR generation failed" });
  }
});

app.get("/api/resolve/:alias", async (req, res) => {
  try {
    const { alias } = req.params;

    if (!alias) {
      return res.status(400).json({ error: "Missing alias" });
    }

    const record = await fetchQrTokenByAlias(alias);

    if (!record) {
      return res.status(404).json({ error: "Alias not found" });
    }

    res.json({
      alias:      record.alias,
      target_url: record.target_url,
      db_id:      record.db_id,
      qr_id:      record.qr_id,
      created_at: record.created_at
    });

  } catch (err) {
    console.error("Resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve alias" });
  }
});

async function fetchQrTokenByAlias(alias) {
  const params = new URLSearchParams({
    database_id: DB_ID,
    collection_name: "qr_tokens",
    filters: JSON.stringify({ alias }),
    page: 1,
    page_size: 1
  });

  const res = await fetch(`${DATACUBE_BASE}/crud?${params}`, {
    headers: authHeaders()
  });

  if (!res.ok) throw new Error("DataCube fetch failed");

  const json = await res.json();
  const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

  return docs.length > 0 ? docs[0] : null;
}

app.put("/api/update_qr_token", async (req, res) => {
  try {
    const { alias, target_url, db_id, qr_id } = req.body || {};

    if (!alias || !target_url || !db_id || !qr_id) {
      return res.status(400).json({ error: "Missing required fields: alias, target_url, db_id, qr_id" });
    }

    const payload = {
      database_id: DB_ID,
      collection_name: "qr_tokens",
      filters: { alias },
      update_data: {
        target_url,
        db_id: String(db_id),
        qr_id: String(qr_id),
        updated_at: new Date().toISOString()
      }
    };

    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error("DataCube update failed");

    res.json({ success: true, alias, token });

  } catch (err) {
    console.error("Update token error:", err.message);
    res.status(500).json({ error: "Failed to update QR token" });
  }
});


// ===== START SERVER =====
app.listen(PORT, () => {
  if (!DATACUBE_API_KEY) {
    console.warn("DATACUBE_API_KEY is NOT set");
  }
  console.log(`Datacube proxy running on http://localhost:${PORT}`);
});
