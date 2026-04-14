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
      alias: record.alias,
      target_url: record.target_url,
      db_id: record.db_id,
      qr_id: record.qr_id,
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

    res.json({ success: true, alias });

  } catch (err) {
    console.error("Update token error:", err.message);
    res.status(500).json({ error: "Failed to update QR token" });
  }
});

// =====================================================================
// ADD THESE ROUTES AND HELPERS TO YOUR EXISTING server.js
// =====================================================================
// Place the helper functions alongside your other helpers,
// and the app.post/app.get routes alongside your other routes.
// =====================================================================


// =====================================================================
// ADD THESE TO server.js
// =====================================================================
import nodemailer from "nodemailer";

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ── HELPER: generate QR name from ID and index ───────────────────────
// Format: QR-<index padded to 4 digits>-<id>
// e.g. QR-0001-xK9m1234, QR-0002-pL3r5678
function makeQrName(index, qrId) {
  const padded = String(index + 1).padStart(4, "0");
  return `QR-${padded}-${qrId}`;
}


// ── ROUTE: POST /api/setup_pdf_collection ────────────────────────────
// Run ONCE after manually creating your PDF database in DataCube.
// Hit this endpoint to create the pdf_records collection inside it.
//
// Request body:
//   pdf_db_id {string} - the database ID you created for PDF records
app.post("/api/setup_pdf_collection", async (req, res) => {
  try {
    const { pdf_db_id } = req.body || {};
    if (!pdf_db_id) return res.status(400).json({ error: "Missing pdf_db_id" });

    const payload = {
      database_id: pdf_db_id,
      collections: [{
        name: "pdf_records",
        fields: [
          { name: "pdf_id", type: "string" },
          { name: "client_name", type: "string" },
          { name: "qr_db_id", type: "string" },
          { name: "email", type: "string" },
          { name: "qr_count", type: "number" },
          { name: "qr_ids", type: "string" },
          { name: "qr_names", type: "string" },
          { name: "date", type: "string" },
          { name: "time", type: "string" },
          { name: "created_at", type: "string" },
          { name: "file_id", type: "string" }, 
          { name: "signed_url", type: "string" }
        ]
      }]
    };

    const r = await fetch(`${DATACUBE_BASE}/add_collection`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    res.json({ success: true, data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── ROUTE: POST /api/save_pdf_record ─────────────────────────────────
/**
 * POST /api/save_pdf_record
 *
 * Saves a bulk PDF generation record into the dedicated PDF database.
 *
 * Request body:
 *   pdf_db_id   {string}   - the PDF database ID (PDF_DB_ID constant)
 *   pdf_id      {string}   - unique ID for this PDF batch
 *   client_name {string}   - client name
 *   qr_db_id    {string}   - client's scan database ID (QR_DB_ID)
 *   email       {string}   - recipient email
 *   qr_count    {number}   - total QR codes in this batch
 *   qr_ids      {string[]} - array of QR ID strings
 *   qr_names    {string[]} - array of QR name strings (same order as qr_ids)
 *   date        {string}   - YYYY-MM-DD
 *   time        {string}   - HH:MM:SS
 *
 * Response:
 *   { success: true, pdf_id }
 */
app.post("/api/save_pdf_record", async (req, res) => {
  try {
    const {
      pdf_db_id, pdf_id, client_name, qr_db_id,
      email, qr_count, qr_ids, qr_names, date, time,
      file_id, signed_url
    } = req.body || {};

    if (!pdf_db_id || !pdf_id || !client_name || !qr_db_id || !email || !qr_count || !qr_ids) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payload = {
      database_id: pdf_db_id,
      collection_name: "pdf_records",
      documents: [{
        pdf_id,
        client_name,
        qr_db_id,
        email,
        qr_count,
        qr_ids: JSON.stringify(qr_ids),
        qr_names: JSON.stringify(qr_names || []),
        date,
        time,
        created_at: new Date().toISOString(),
        file_id: req.body.file_id || null,
        signed_url: req.body.signed_url || null
      }]
    };

    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    if (!r.ok) throw new Error(`DataCube error: ${await r.text()}`);

    res.json({ success: true, pdf_id });

  } catch (err) {
    console.error("Save PDF record error:", err.message);
    res.status(500).json({ error: "Failed to save PDF record" });
  }
});


// ── ROUTE: POST /api/send_pdf_email ──────────────────────────────────
/**
 * POST /api/send_pdf_email
 *
 * Sends the generated PDF as an email attachment.
 *
 * Request body:
 *   email       {string} - recipient
 *   pdf_base64  {string} - base64 PDF (data URI or raw)
 *   pdf_id      {string} - batch ID (used in filename + subject)
 *   qr_count    {number} - number of QR codes
 *   client_name {string} - client name
 *
 * Response:
 *   { success: true }
 */
app.post("/api/send_pdf_email", async (req, res) => {
  try {
    const { email, signed_url, pdf_id, qr_count, client_name } = req.body || {};

    if (!email || !signed_url || !pdf_id) {
      return res.status(400).json({ error: "Missing required fields: email, signed_url, pdf_id" });
    }

    // Fetch PDF buffer from DataCube signed URL
    // Signed URLs are self-authenticating — no API key needed
    const fileRes = await fetch(signed_url);
    if (!fileRes.ok) throw new Error(`Failed to fetch PDF from signed URL: ${fileRes.status}`);

    const arrayBuffer = await fileRes.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    await mailer.sendMail({
      from: `"QR Manager" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `QR Code Batch Ready — ${qr_count} codes (${pdf_id})`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
          <h2 style="color:#7c6af7;margin-bottom:8px;">Your QR Codes are Ready</h2>
          <p style="color:#555;margin-bottom:16px;">
            Your QR codes batch has been generated successfully.
          </p>
          <table style="background:#f8fafc;border-radius:10px;padding:16px;width:100%;border-collapse:collapse;">
            <tr>
              <td style="color:#888;padding:4px 0;font-size:13px;">PDF ID</td>
              <td style="font-family:monospace;font-size:13px;text-align:right;">${pdf_id}</td>
            </tr>
            <tr>
              <td style="color:#888;padding:4px 0;font-size:13px;">QR codes</td>
              <td style="font-size:13px;text-align:right;">${qr_count}</td>
            </tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:20px;">
            The PDF is attached. Each QR code is labeled with its unique name and ID.
          </p>
        </div>
      `,
      attachments: [{
        filename: `qr-bulk-${pdf_id}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }]
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Send email error:", err.message);
    res.status(500).json({ error: "Failed to send email: " + err.message });
  }
});


// =====================================================================
// PUBLIC API ENDPOINTS — for other teams to fetch PDF and QR info
// =====================================================================

// ── GET /api/public/pdf/:pdf_id ───────────────────────────────────────
/**
 * GET /api/public/pdf/:pdf_id
 *
 * Fetches a single PDF batch record by its PDF ID.
 * Returns the PDF metadata and the list of QR codes in that batch.
 *
 * PUBLIC — no auth required.
 *
 * URL params:
 *   pdf_id    {string} - the PDF batch ID
 *
 * Query params:
 *   pdf_db_id {string} - the PDF database ID
 *
 * Response:
 *   {
 *     pdf_id:      "xK9m1234",
 *     client_name: "AcmeCorp",
 *     qr_db_id:    "...",
 *     email:       "user@example.com",
 *     qr_count:    50,
 *     qr_ids:      ["id1", "id2", ...],
 *     qr_names:    ["QR-0001-id1", "QR-0002-id2", ...],
 *     date:        "2025-01-15",
 *     time:        "10:30:00",
 *     created_at:  "2025-01-15T10:30:00.000Z"
 *   }
 *
 * Errors:
 *   400  { error: "Missing pdf_db_id" }
 *   404  { error: "PDF record not found" }
 *   500  { error: "Server error" }
 */
app.get("/api/public/pdf/:pdf_id", async (req, res) => {
  try {
    const { pdf_id } = req.params;
    const { pdf_db_id } = req.query;

    if (!pdf_db_id) {
      return res.status(400).json({ error: "Missing query param: pdf_db_id" });
    }

    const params = new URLSearchParams({
      database_id: pdf_db_id,
      collection_name: "pdf_records",
      filters: JSON.stringify({ pdf_id }),
      page: 1,
      page_size: 1
    });

    const r = await fetch(`${DATACUBE_BASE}/crud?${params}`, {
      headers: authHeaders()
    });

    if (!r.ok) throw new Error("DataCube fetch failed");

    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json
        : [];

    if (!docs.length) {
      return res.status(404).json({ error: "PDF record not found" });
    }

    const doc = docs[0];

    // Parse the JSON-stringified arrays back
    res.json({
      pdf_id: doc.pdf_id,
      client_name: doc.client_name,
      qr_db_id: doc.qr_db_id,
      email: doc.email,
      qr_count: doc.qr_count,
      qr_ids: JSON.parse(doc.qr_ids || "[]"),
      qr_names: JSON.parse(doc.qr_names || "[]"),
      date: doc.date,
      time: doc.time,
      created_at: doc.created_at,
      file_id:    doc.file_id    || null,
      signed_url: doc.signed_url || null,
    });

  } catch (err) {
    console.error("Public PDF fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch PDF record" });
  }
});


// ── GET /api/public/pdf ───────────────────────────────────────────────
/**
 * GET /api/public/pdf
 *
 * Lists all PDF batch records, optionally filtered by client.
 *
 * PUBLIC — no auth required.
 *
 * Query params:
 *   pdf_db_id   {string}  - REQUIRED — the PDF database ID
 *   client_name {string}  - optional filter by client
 *   page        {number}  - page number (default 1)
 *   page_size   {number}  - results per page (default 50, max 200)
 *
 * Response:
 *   {
 *     data: [ ...pdf records ],
 *     page: 1,
 *     page_size: 50
 *   }
 */
app.get("/api/public/pdf", async (req, res) => {
  try {
    const { pdf_db_id, client_name, page = 1, page_size = 50 } = req.query;

    if (!pdf_db_id) {
      return res.status(400).json({ error: "Missing query param: pdf_db_id" });
    }

    const filters = client_name ? { client_name } : {};

    const params = new URLSearchParams({
      database_id: pdf_db_id,
      collection_name: "pdf_records",
      filters: JSON.stringify(filters),
      page: Number(page),
      page_size: Math.min(Number(page_size), 200)
    });

    const r = await fetch(`${DATACUBE_BASE}/crud?${params}`, {
      headers: authHeaders()
    });

    if (!r.ok) throw new Error("DataCube fetch failed");

    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json
        : [];

    // Parse stringified arrays in each record
    const data = docs.map(doc => ({
      pdf_id: doc.pdf_id,
      client_name: doc.client_name,
      qr_db_id: doc.qr_db_id,
      email: doc.email,
      qr_count: doc.qr_count,
      qr_ids: JSON.parse(doc.qr_ids || "[]"),
      qr_names: JSON.parse(doc.qr_names || "[]"),
      date: doc.date,
      time: doc.time,
      created_at: doc.created_at,
      file_id:    doc.file_id    || null,
      signed_url: doc.signed_url || null,
    }));

    res.json({ data, page: Number(page), page_size: Number(page_size) });

  } catch (err) {
    console.error("Public PDF list error:", err.message);
    res.status(500).json({ error: "Failed to fetch PDF records" });
  }
});


// ── GET /api/public/qr/:qr_id ─────────────────────────────────────────
/**
 * GET /api/public/qr/:qr_id
 *
 * Fetches a single QR code record from the metadata database.
 *
 * PUBLIC — no auth required.
 *
 * URL params:
 *   qr_id       {string} - the QR code ID
 *
 * Query params:
 *   client_name {string} - REQUIRED — the client collection name
 *
 * Response:
 *   {
 *     qr_id:     "xK9m1234",
 *     qr_name:   "QR-0001-xK9m1234",
 *     qr_url:    "https://survey.html?alias=abcd1234",
 *     qr_alias:  "abcd1234",
 *     qr_status: 1,
 *     qr_pdf_id: "pdfBatchId",
 *     db_id:     "clientDbId",
 *     date:      "2025-01-15",
 *     time:      "10:30:00"
 *   }
 *
 * Errors:
 *   400  { error: "Missing client_name" }
 *   404  { error: "QR code not found" }
 */
app.get("/api/public/qr/:qr_id", async (req, res) => {
  try {
    const { qr_id } = req.params;
    const { client_name } = req.query;

    if (!client_name) {
      return res.status(400).json({ error: "Missing query param: client_name" });
    }

    const params = new URLSearchParams({
      database_id: DB_ID,             // your main metadata DATABASE_ID
      collection_name: client_name,
      filters: JSON.stringify({ qr_id }),
      page: 1,
      page_size: 1
    });

    const r = await fetch(`${DATACUBE_BASE}/crud?${params}`, {
      headers: authHeaders()
    });

    if (!r.ok) throw new Error("DataCube fetch failed");

    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json
        : [];

    if (!docs.length) {
      return res.status(404).json({ error: "QR code not found" });
    }

    const doc = docs[0];

    res.json({
      qr_id: doc.qr_id,
      qr_name: doc.qr_name,
      qr_url: doc.qr_url,
      qr_alias: doc.qr_alias,
      qr_status: doc.qr_status,
      qr_pdf_id: doc.qr_pdf_id || null,
      db_id: doc.db_id,
      date: doc.date,
      time: doc.time
    });

  } catch (err) {
    console.error("Public QR fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch QR code" });
  }
});


// ── GET /api/public/qr ────────────────────────────────────────────────
/**
 * GET /api/public/qr
 *
 * Lists all active QR codes for a client, optionally filtered by pdf_id.
 *
 * PUBLIC — no auth required.
 *
 * Query params:
 *   client_name {string}  - REQUIRED — the client collection name
 *   pdf_id      {string}  - optional — filter to one PDF batch
 *   page        {number}  - page number (default 1)
 *   page_size   {number}  - results per page (default 50, max 200)
 *
 * Response:
 *   {
 *     data: [ ...qr records ],
 *     page: 1,
 *     page_size: 50
 *   }
 */
app.get("/api/public/qr", async (req, res) => {
  try {
    const { client_name, pdf_id, page = 1, page_size = 50 } = req.query;

    if (!client_name) {
      return res.status(400).json({ error: "Missing query param: client_name" });
    }

    // Base filter — only active QRs, skip the qr_id:0 metadata row
    const filters = { qr_status: 1 };
    if (pdf_id) filters.qr_pdf_id = pdf_id;

    const params = new URLSearchParams({
      database_id: DB_ID,
      collection_name: client_name,
      filters: JSON.stringify(filters),
      page: Number(page),
      page_size: Math.min(Number(page_size), 200)
    });

    const r = await fetch(`${DATACUBE_BASE}/crud?${params}`, {
      headers: authHeaders()
    });

    if (!r.ok) throw new Error("DataCube fetch failed");

    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data
      : Array.isArray(json) ? json
        : [];

    const data = docs
      .filter(d => d.qr_id !== 0)   // exclude metadata row
      .map(doc => ({
        qr_id: doc.qr_id,
        qr_name: doc.qr_name,
        qr_url: doc.qr_url,
        qr_alias: doc.qr_alias,
        qr_status: doc.qr_status,
        qr_pdf_id: doc.qr_pdf_id || null,
        db_id: doc.db_id,
        date: doc.date,
        time: doc.time
      }));

    res.json({ data, page: Number(page), page_size: Number(page_size) });

  } catch (err) {
    console.error("Public QR list error:", err.message);
    res.status(500).json({ error: "Failed to fetch QR codes" });
  }
});


// ADD this before the app.listen() at the bottom

app.post("/api/upload_pdf", async (req, res) => {
  try {
    const { pdf_base64, filename } = req.body || {};

    if (!pdf_base64 || !filename) {
      return res.status(400).json({ error: "Missing pdf_base64 or filename" });
    }

    // Strip data URI prefix if present
    const base64Data = pdf_base64.includes(",")
      ? pdf_base64.split(",")[1]
      : pdf_base64;

    const pdfBuffer = Buffer.from(base64Data, "base64");

    // Build multipart form for DataCube /files/ endpoint
    const form = new FormData();
    form.append("file", pdfBuffer, {
      filename: filename,
      contentType: "application/pdf"
    });
    form.append("filename", filename);
    form.append("content_type", "application/pdf");

    const r = await fetch(`${DATACUBE_BASE}/files/`, {
      method: "POST",
      headers: {
        "Authorization": `Api-Key ${DATACUBE_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`DataCube upload failed: ${text}`);
    }

    const data = await r.json();

    res.json({
      success: true,
      file_id: data.file_id,
      signed_url: data.signed_url
    });

  } catch (err) {
    console.error("PDF upload error:", err.message);
    res.status(500).json({ error: "Failed to upload PDF: " + err.message });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => {
  if (!DATACUBE_API_KEY) {
    console.warn("DATACUBE_API_KEY is NOT set");
  }
  console.log(`Datacube proxy running on http://localhost:${PORT}`);
});
