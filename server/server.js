import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";


const app = express();
const PORT = 3001;

// ===== CONFIG =====
const DATACUBE_BASE = "https://datacube.uxlivinglab.online/api";
const DATACUBE_API_KEY = process.env.DATACUBE_API_KEY; // 🔐

// ===== MIDDLEWARE =====
app.use(cors({
  origin: "*",          // allow all origins (safe for now)
  methods: ["GET", "POST", "OPTIONS"],
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

// ---------- ADD COLLECTION ----------
app.post("/api/add_collection", async (req, res) => {
  try {
    const r = await fetch(`${DATACUBE_BASE}/add_collection`, {
      method: "POST",
      headers: authHeaders(), // 🔐 API KEY INCLUDED
      body: JSON.stringify(req.body)
    });

    const text = await r.text();
    res.status(r.status).send(text);
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
      headers: authHeaders(), // 🔐 API KEY INCLUDED
      body: JSON.stringify(req.body)
    });

    const text = await r.text();
    res.status(r.status).send(text);
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
      headers: authHeaders() // 🔐 API KEY INCLUDED
    });

    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err) {
    console.error("crud GET error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  if (!DATACUBE_API_KEY) {
    console.warn("⚠️ DATACUBE_API_KEY is NOT set");
  }
  console.log(`✅ Datacube proxy running on http://localhost:${PORT}`);
});
