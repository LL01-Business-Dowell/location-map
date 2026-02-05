import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";

import crypto from "crypto";


const app = express();
const PORT = process.env.PORT || 3001;

// ===== CONFIG =====
const DATACUBE_BASE = "https://datacube.uxlivinglab.online/api";
const DATACUBE_API_KEY = process.env.DATACUBE_API_KEY; // 🔐

// ==== ENCRYPTION ====
const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.QR_ENCRYPTION_KEY, "hex");

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

//Encrypt Function
function encryptPayload(payload) {
  const iv = crypto.randomBytes(12); // GCM standard
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  // iv + tag + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
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
    }catch (err) {
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

//build url
app.post("/api/build_qr_url", (req, res) => {
  try {
    const { base_url, db_id, qr_id } = req.body;

    if (!base_url || !db_id || !qr_id) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const cleanBase = base_url.endsWith("/")
      ? base_url.slice(0, -1)
      : base_url;

    const encrypted = encryptPayload({
      db_id,
      qr_id
    });

    const finalUrl = `${cleanBase}?data=${encrypted}`;

    res.json({ url: finalUrl });
  } catch (err) {
    console.error("QR build error:", err);
    res.status(500).json({ error: "Failed to build QR URL" });
  }
});


// ===== START SERVER =====
app.listen(PORT, () => {
  if (!DATACUBE_API_KEY) {
    console.warn("⚠️ DATACUBE_API_KEY is NOT set");
  }
  console.log(`✅ Datacube proxy running on http://localhost:${PORT}`);
});
