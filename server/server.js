import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";

import crypto from "crypto";

import FormData from "form-data";
import multer from "multer";

const upload = multer();


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

// ===== ALIAS HELPER =====
function generateAlias(length = 8) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

//Encrypt Function

function encryptPayload(payload) {
  if (!process.env.QR_ENCRYPTION_KEY) {
    throw new Error("QR_ENCRYPTION_KEY is missing");
  }

  const key = Buffer.from(process.env.QR_ENCRYPTION_KEY.trim(), "hex");

  if (key.length !== 32) {
    throw new Error(`Invalid QR_ENCRYPTION_KEY length: ${key.length}`);
  }

  const iv = crypto.randomBytes(12); // GCM standard

  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  // iv + tag + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function decryptPayload(token) {
  if (!process.env.QR_ENCRYPTION_KEY) {
    throw new Error("QR_ENCRYPTION_KEY missing");
  }

  const key = Buffer.from(process.env.QR_ENCRYPTION_KEY.trim(), "hex");

  if (key.length !== 32) {
    throw new Error("Invalid encryption key length");
  }

  const buffer = Buffer.from(token, "base64url");

  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

/**
 * Stores a QR token + alias record in DataCube.
 * Collection: "qr_tokens" inside your main DATABASE_ID.
 *
 * Fields stored:
 *   alias      - short 8-char identifier used in QR URLs
 *   token      - full AES-256-GCM encrypted payload
 *   target_url - original destination URL (plaintext, for quick lookup)
 *   db_id      - client database ID
 *   qr_id      - QR code ID
 *   created_at - ISO timestamp
 */
async function storeQrToken({ alias, token, target_url, db_id, qr_id }) {
  const payload = {
    database_id: process.env.DATABASE_ID,
    collection_name: "qr_tokens",
    documents: [
      {
        alias,
        token,
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

// app.post("/api/build_qr_url", (req, res) => {
//   console.log("🔹 /api/build_qr_url hit");

//   try {
//     console.log("➡️ Request body:", req.body);

//     const { base_url, target_url, db_id, qr_id } = req.body || {};

//     if (!base_url || !target_url || !db_id || !qr_id) {
//       return res.status(400).json({ error: "Missing fields" });
//     }

//     console.log("✅ Required fields present");

//     const cleanBase = base_url.endsWith("/")
//       ? base_url.slice(0, -1)
//       : base_url;

//     console.log("🔹 Clean base URL:", cleanBase);

//     console.log("🔑 ENV KEY:", process.env.QR_ENCRYPTION_KEY);
//     console.log(
//       "🔑 ENV KEY length:",
//       process.env.QR_ENCRYPTION_KEY?.length
//     );
//     console.log(
//       "🔑 BYTE length:",
//       Buffer.from(process.env.QR_ENCRYPTION_KEY || "", "hex").length
//     );


//     // ---------- KEY VALIDATION (NEW) ----------
//     const rawKey = process.env.QR_ENCRYPTION_KEY;

//     console.log("🔑 Raw key present:", !!rawKey);
//     console.log("🔑 Raw key length:", rawKey?.length);

//     if (!rawKey) {
//       throw new Error("QR_ENCRYPTION_KEY is missing");
//     }

//     const key = Buffer.from(rawKey.trim(), "hex");

//     console.log("🔑 Key byte length:", key.length);

//     if (key.length !== 32) {
//       throw new Error(`Invalid key length: ${key.length}`);
//     }
//     // -----------------------------------------

//     console.log("🔐 Starting encryption");
//     console.log("🔐 Payload:", { db_id, qr_id });

//     const encrypted = encryptPayload({ target_url, db_id, qr_id });

//     console.log("🔐 Encryption success");
//     console.log("🔐 Encrypted length:", encrypted.length);

//     const finalUrl = `${cleanBase}?token=${encrypted}`;

//     console.log("✅ Final QR URL built");

//     res.json({ url: finalUrl });

//   } catch (err) {
//     console.error("❌ QR build error");
//     console.error("❌ Error name:", err?.name);
//     console.error("❌ Error message:", err?.message);
//     console.error("❌ Stack:", err?.stack);

//     res.status(500).json({ error: "Failed to build QR URL" });
//   }
// });

/**
 * POST /api/build_qr_url
 *
 * Encrypts QR payload, generates a short alias, stores both
 * in the DataCube "qr_tokens" collection, and returns the
 * short alias-based URL to embed in the QR code.
 *
 * Request body:
 *   base_url   {string}  - The verify/landing page URL
 *   target_url {string}  - The destination URL to embed
 *   db_id      {string}  - Client database ID
 *   qr_id      {string}  - QR code ID
 *
 * Response:
 *   { url, alias, token }
 *     url   - Short URL to embed in QR  e.g. https://verify.page?alias=xK9mP2
 *     alias - The short alias string
 *     token - The full encrypted token (for your own reference)
 */
app.post("/api/build_qr_url", async (req, res) => {
  try {
    const { base_url, target_url, db_id, qr_id } = req.body || {};

    if (!base_url || !target_url || !db_id || !qr_id) {
      return res.status(400).json({ error: "Missing required fields: base_url, target_url, db_id, qr_id" });
    }

    const cleanBase = base_url.endsWith("/") ? base_url.slice(0, -1) : base_url;

    // 1. Encrypt the payload
    const token = encryptPayload({ target_url, db_id, qr_id });

    // 2. Generate a short unique alias
    const alias = generateAlias(8);

    // 3. Store token + alias in DataCube
    await storeQrToken({ alias, token, target_url, db_id, qr_id });

    // 4. Return short alias-based URL
    const finalUrl = `${cleanBase}?alias=${alias}`;

    res.json({ url: finalUrl, alias, token });

  } catch (err) {
    console.error("QR build error:", err.message);
    res.status(500).json({ error: "Failed to build QR URL" });
  }
});

app.post("/api/encrypt", (req, res) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const token = encryptPayload(payload);

    res.json({ token });

  } catch (err) {
    console.error("Encrypt error:", err);
    res.status(500).json({ error: "Encryption failed" });
  }
});

app.post("/api/decrypt", (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Missing token" });
    }

    const data = decryptPayload(token);

    res.json(data);

  } catch (err) {
    console.error("Decrypt error:", err);
    res.status(400).json({ error: "Invalid token" });
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

/**
 * GET /api/resolve/:alias
 *
 * PUBLIC endpoint — resolves a short alias to its full token
 * and decrypted payload. Used by QR verify pages and other
 * teams who need to decode QR data.
 *
 * URL params:
 *   alias  {string}  - The 8-char alias from the QR URL
 *
 * Response (success):
 *   {
 *     alias      : "xK9mP2ab",
 *     token      : "<encrypted string>",   // full token if needed
 *     target_url : "https://...",           // decrypted destination
 *     db_id      : "123456",
 *     qr_id      : "7",
 *     created_at : "2025-01-01T00:00:00Z"
 *   }
 *
 * Response (error):
 *   404  { error: "Alias not found" }
 *   400  { error: "Missing alias" }
 *   500  { error: "Server error" }
 */
app.get("/api/resolve/:alias", async (req, res) => {
  try {
    const { alias } = req.params;

    if (!alias) {
      return res.status(400).json({ error: "Missing alias" });
    }

    // 1. Fetch record from DataCube
    const record = await fetchQrTokenByAlias(alias);

    if (!record) {
      return res.status(404).json({ error: "Alias not found" });
    }

    // 2. Decrypt the token
    const decrypted = decryptPayload(record.token);

    // 3. Return everything the caller needs
    res.json({
      alias: record.alias,
      token: record.token,
      target_url: decrypted.target_url,
      db_id: decrypted.db_id,
      qr_id: decrypted.qr_id,
      created_at: record.created_at
    });

  } catch (err) {
    console.error("Resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve alias" });
  }
});

/**
 * Fetches a single QR token record from DataCube by alias.
 * Returns the document object or null if not found.
 */
async function fetchQrTokenByAlias(alias) {
  const params = new URLSearchParams({
    database_id: process.env.DATABASE_ID,
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

/**
 * PUT /api/update_qr_token
 *
 * Updates an existing alias record when a QR code is edited.
 * Re-encrypts with new data, keeps the same alias so the
 * printed QR code still works.
 *
 * Request body:
 *   alias      {string}  - Existing alias to update
 *   target_url {string}  - New destination URL
 *   db_id      {string}  - Client database ID
 *   qr_id      {string}  - QR code ID
 *
 * Response:
 *   { success: true, alias, token }
 */
app.put("/api/update_qr_token", async (req, res) => {
  try {
    const { alias, target_url, db_id, qr_id } = req.body || {};

    if (!alias || !target_url || !db_id || !qr_id) {
      return res.status(400).json({ error: "Missing required fields: alias, target_url, db_id, qr_id" });
    }

    // Re-encrypt with updated data
    const token = encryptPayload({ target_url, db_id, qr_id });

    const payload = {
      database_id: process.env.DATABASE_ID,
      collection_name: "qr_tokens",
      filters: { alias },
      update_data: {
        token,
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
    console.warn("⚠️ DATACUBE_API_KEY is NOT set");
  }
  console.log(`✅ Datacube proxy running on http://localhost:${PORT}`);
});
