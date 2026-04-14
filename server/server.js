import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import "dotenv/config";
import crypto, { sign } from "crypto";
import nodemailer from "nodemailer";
import FormData from "form-data";
import multer from "multer";

const upload = multer();
const app = express();
const PORT = process.env.PORT || 3001;

// ===== CONFIG =====
const DATACUBE_BASE    = "https://datacube.uxlivinglab.online/api/v2";
const DATACUBE_API_KEY = process.env.DATACUBE_API_KEY;
const DB_ID            = "69985c0844ca8a1af7fd639e";

// ===== STARTUP CHECKS =====
console.log("========================================");
console.log("  QR Manager Server Starting");
console.log("========================================");
console.log(`  PORT            : ${PORT}`);
console.log(`  DATACUBE_BASE   : ${DATACUBE_BASE}`);
console.log(`  DB_ID           : ${DB_ID}`);
console.log(`  DATACUBE_API_KEY: ${DATACUBE_API_KEY ? "SET (" + DATACUBE_API_KEY.slice(0,6) + "...)" : "NOT SET ⚠️"}`);
console.log(`  SMTP_HOST       : ${process.env.SMTP_HOST       || "NOT SET ⚠️"}`);
console.log(`  SMTP_PORT       : ${process.env.SMTP_PORT       || "NOT SET ⚠️"}`);
console.log(`  SMTP_USER       : ${process.env.SMTP_USER       || "NOT SET ⚠️"}`);
console.log(`  SMTP_PASS       : ${process.env.SMTP_PASS ? "SET" : "NOT SET ⚠️"}`);
console.log("========================================");

// ===== MAILER =====
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Verify SMTP connection at startup
mailer.verify((err, success) => {
  if (err) {
    console.error("SMTP connection FAILED:", err.message);
  } else {
    console.log("SMTP connection OK ✓");
  }
});

// ===== MIDDLEWARE =====
app.use(cors({
  origin:         "*",
  methods:        ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "50mb" }));  // PDF base64 can be large

// ===== REQUEST LOGGER =====
app.use((req, res, next) => {
  console.log(`\n→ ${req.method} ${req.path} [${new Date().toISOString()}]`);
  next();
});

// ===== HELPERS =====
function authHeaders() {
  return {
    "Content-Type":  "application/json",
    "Authorization": `Api-Key ${DATACUBE_API_KEY}`
  };
}

function generateAlias(length = 8) {
  return crypto.randomBytes(length).toString("base64url").slice(0, length);
}

function makeQrName(index, qrId) {
  const padded = String(index + 1).padStart(4, "0");
  return `QR-${padded}-${qrId}`;
}

// ===== DB HELPER: log all DataCube calls =====
async function datacubeRequest(method, path, body = null, label = "") {
  const url = `${DATACUBE_BASE}${path}`;
  console.log(`  [DataCube] ${method} ${path} ${label ? "(" + label + ")" : ""}`);

  const options = {
    method,
    headers: body
      ? authHeaders()
      : { "Authorization": `Api-Key ${DATACUBE_API_KEY}` }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    console.error(`  [DataCube] ✗ ${res.status} — ${JSON.stringify(data)}`);
  } else {
    console.log(`  [DataCube] ✓ ${res.status}`);
  }

  return { ok: res.ok, status: res.status, data };
}

// ===== STORE QR TOKEN =====
async function storeQrToken({ alias, target_url, db_id, qr_id }) {
  console.log(`  [storeQrToken] alias=${alias} qr_id=${qr_id} db_id=${db_id}`);

  const payload = {
    database_id:     DB_ID,
    collection_name: "qr_tokens",
    documents: [{
      alias,
      target_url,
      db_id:      String(db_id),
      qr_id:      String(qr_id),
      created_at: new Date().toISOString()
    }]
  };

  const { ok, data } = await datacubeRequest("POST", "/crud", payload, "storeQrToken");
  if (!ok) throw new Error(`Failed to store QR token: ${JSON.stringify(data)}`);
  return data;
}

// ===== FETCH QR TOKEN BY ALIAS =====
async function fetchQrTokenByAlias(alias) {
  console.log(`  [fetchQrTokenByAlias] alias=${alias}`);

  const params = new URLSearchParams({
    database_id:     DB_ID,
    collection_name: "qr_tokens",
    filters:         JSON.stringify({ alias }),
    page:            1,
    page_size:       1
  });

  const res = await fetch(`${DATACUBE_BASE}/crud?${params}`, {
    headers: authHeaders()
  });

  const json = await res.json();
  const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

  console.log(`  [fetchQrTokenByAlias] found=${docs.length > 0}`);
  return docs.length > 0 ? docs[0] : null;
}


// ===================================================
// ROUTES
// ===================================================

// ---------- ADD COLLECTION ----------
app.post("/api/add_collection", async (req, res) => {
  console.log("  [add_collection] database_id:", req.body?.database_id, "| collections:", req.body?.collections?.map(c => c.name));
  try {
    const r = await fetch(`${DATACUBE_BASE}/add_collection`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify(req.body)
    });
    const data = await r.json();
    console.log(`  [add_collection] result: ${r.status} — ${JSON.stringify(data)}`);
    res.status(r.status).json(data);
  } catch (err) {
    console.error("  [add_collection] ERROR:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CRUD POST ----------
app.post("/api/crud", async (req, res) => {
  console.log("  [crud POST] collection:", req.body?.collection_name, "| docs:", req.body?.documents?.length);
  try {
    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify(req.body)
    });
    const data = await r.json();
    console.log(`  [crud POST] result: ${r.status} | inserted_ids:`, data?.inserted_ids);
    res.status(r.status).json(data);
  } catch (err) {
    console.error("  [crud POST] ERROR:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CRUD PUT ----------
app.put("/api/crud", async (req, res) => {
  console.log("  [crud PUT] collection:", req.body?.collection_name, "| filters:", req.body?.filters);
  try {
    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method:  "PUT",
      headers: authHeaders(),
      body:    JSON.stringify(req.body)
    });
    const data = await r.json();
    console.log(`  [crud PUT] result: ${r.status}`);
    res.status(r.status).json(data);
  } catch (err) {
    console.error("  [crud PUT] ERROR:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CRUD GET ----------
app.get("/api/crud", async (req, res) => {
  console.log("  [crud GET] collection:", req.query?.collection_name, "| filters:", req.query?.filters);
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${DATACUBE_BASE}/crud?${qs}`, {
      headers: authHeaders()
    });
    const data = await r.json();
    const count = Array.isArray(data?.data) ? data.data.length : Array.isArray(data) ? data.length : "?";
    console.log(`  [crud GET] result: ${r.status} | docs returned: ${count}`);
    res.status(r.status).json(data);
  } catch (err) {
    console.error("  [crud GET] ERROR:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- LIST COLLECTIONS ----------
app.get("/api/list_collections", async (req, res) => {
  console.log("  [list_collections] database_id:", req.query?.database_id);
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r  = await fetch(`${DATACUBE_BASE}/list_collections?${qs}`, {
      headers: authHeaders()
    });
    const data = await r.json();
    console.log(`  [list_collections] result: ${r.status} | collections: ${data?.collections?.length}`);
    res.status(r.status).json(data);
  } catch (err) {
    console.error("  [list_collections] ERROR:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- CREATE DATABASE ----------
app.post("/api/create_database", async (req, res) => {
  console.log("  [create_database] db_name:", req.body?.db_name);
  try {
    const r = await fetch(`${DATACUBE_BASE}/create_database`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify(req.body)
    });
    const data = await r.json();
    console.log(`  [create_database] result: ${r.status} | new db_id: ${data?.database?.id}`);
    res.status(r.status).json(data);
  } catch (err) {
    console.error("  [create_database] ERROR:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

// ---------- BUILD QR URL ----------
app.post("/api/build_qr_url", async (req, res) => {
  console.log("  [build_qr_url] qr_id:", req.body?.qr_id, "| db_id:", req.body?.db_id);
  try {
    const { base_url, target_url, db_id, qr_id } = req.body || {};

    if (!base_url || !target_url || !db_id || !qr_id) {
      console.warn("  [build_qr_url] Missing fields:", { base_url: !!base_url, target_url: !!target_url, db_id: !!db_id, qr_id: !!qr_id });
      return res.status(400).json({ error: "Missing required fields: base_url, target_url, db_id, qr_id" });
    }

    const cleanBase = base_url.endsWith("/") ? base_url.slice(0, -1) : base_url;
    const alias     = generateAlias(8);
    console.log("  [build_qr_url] generated alias:", alias);

    await storeQrToken({ alias, target_url, db_id, qr_id });

    const finalUrl = `${cleanBase}?id=${alias}`;
    console.log("  [build_qr_url] final URL:", finalUrl);

    res.json({ url: finalUrl, alias });

  } catch (err) {
    console.error("  [build_qr_url] ERROR:", err.message);
    res.status(500).json({ error: "Failed to build QR URL" });
  }
});

// ---------- GENERATE QR ----------
app.post("/api/generate_qr", upload.single("logo"), async (req, res) => {
  console.log("  [generate_qr] link:", req.body?.link?.slice(0, 60) + "...", "| has logo:", !!req.file);
  try {
    const { link, color } = req.body;
    if (!link || !color) {
      return res.status(400).json({ error: "Missing link or color" });
    }

    const formData = new FormData();
    formData.append("link",  link);
    formData.append("color", color);
    if (req.file) {
      formData.append("logo", req.file.buffer, {
        filename:    req.file.originalname,
        contentType: req.file.mimetype
      });
    }

    const response = await fetch(
      "https://www.dowellsmartlabelling.uxlivinglab.org/api/v1/qr/create-custom-qr",
      { method: "POST", body: formData, headers: formData.getHeaders() }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("  [generate_qr] upstream failed:", response.status, text);
      return res.status(response.status).send(text);
    }

    console.log("  [generate_qr] streaming PNG back");
    res.setHeader("Content-Type", "image/png");
    response.body.pipe(res);

  } catch (err) {
    console.error("  [generate_qr] ERROR:", err.message);
    res.status(500).json({ error: "QR generation failed" });
  }
});

// ---------- RESOLVE ALIAS ----------
app.get("/api/resolve/:alias", async (req, res) => {
  console.log("  [resolve] alias:", req.params.alias);
  try {
    const { alias } = req.params;
    if (!alias) return res.status(400).json({ error: "Missing alias" });

    const record = await fetchQrTokenByAlias(alias);
    if (!record) {
      console.warn("  [resolve] alias not found:", alias);
      return res.status(404).json({ error: "Alias not found" });
    }

    console.log("  [resolve] found → qr_id:", record.qr_id, "| db_id:", record.db_id);
    res.json({
      alias:      record.alias,
      target_url: record.target_url,
      db_id:      record.db_id,
      qr_id:      record.qr_id,
      created_at: record.created_at
    });

  } catch (err) {
    console.error("  [resolve] ERROR:", err.message);
    res.status(500).json({ error: "Failed to resolve alias" });
  }
});

// ---------- UPDATE QR TOKEN ----------
app.put("/api/update_qr_token", async (req, res) => {
  console.log("  [update_qr_token] alias:", req.body?.alias, "| qr_id:", req.body?.qr_id);
  try {
    const { alias, target_url, db_id, qr_id } = req.body || {};

    if (!alias || !target_url || !db_id || !qr_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const payload = {
      database_id:     DB_ID,
      collection_name: "qr_tokens",
      filters:         { alias },
      update_data: {
        target_url,
        db_id:      String(db_id),
        qr_id:      String(qr_id),
        updated_at: new Date().toISOString()
      }
    };

    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method:  "PUT",
      headers: authHeaders(),
      body:    JSON.stringify(payload)
    });

    const data = await r.json();
    if (!r.ok) throw new Error(`DataCube update failed: ${JSON.stringify(data)}`);

    console.log("  [update_qr_token] updated OK");
    res.json({ success: true, alias });

  } catch (err) {
    console.error("  [update_qr_token] ERROR:", err.message);
    res.status(500).json({ error: "Failed to update QR token" });
  }
});

// ---------- SETUP PDF COLLECTION ----------
app.post("/api/setup_pdf_collection", async (req, res) => {
  console.log("  [setup_pdf_collection] pdf_db_id:", req.body?.pdf_db_id);
  try {
    const { pdf_db_id } = req.body || {};
    if (!pdf_db_id) return res.status(400).json({ error: "Missing pdf_db_id" });

    const payload = {
      database_id: pdf_db_id,
      collections: [{
        name: "pdf_records",
        fields: [
          { name: "pdf_id",      type: "string" },
          { name: "client_name", type: "string" },
          { name: "qr_db_id",    type: "string" },
          { name: "email",       type: "string" },
          { name: "qr_count",    type: "number" },
          { name: "qr_ids",      type: "string" },
          { name: "qr_names",    type: "string" },
          { name: "date",        type: "string" },
          { name: "time",        type: "string" },
          { name: "created_at",  type: "string" },
          { name: "file_id",     type: "string" },
          { name: "signed_url",  type: "string" }
        ]
      }]
    };

    const r = await fetch(`${DATACUBE_BASE}/add_collection`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify(payload)
    });

    const data = await r.json();
    console.log("  [setup_pdf_collection] result:", r.status, JSON.stringify(data));
    res.json({ success: true, data });

  } catch (err) {
    console.error("  [setup_pdf_collection] ERROR:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------- SAVE PDF RECORD ----------
app.post("/api/save_pdf_record", async (req, res) => {
  console.log("  [save_pdf_record] pdf_id:", req.body?.pdf_id, "| client:", req.body?.client_name, "| qr_count:", req.body?.qr_count);
  try {
    const {
      pdf_db_id, pdf_id, client_name, qr_db_id,
      email, qr_count, qr_ids, qr_names, date, time,
      file_id, signed_url
    } = req.body || {};

    if (!pdf_db_id || !pdf_id || !client_name || !qr_db_id || !email || !qr_count || !qr_ids) {
      const missing = { pdf_db_id: !!pdf_db_id, pdf_id: !!pdf_id, client_name: !!client_name, qr_db_id: !!qr_db_id, email: !!email, qr_count: !!qr_count, qr_ids: !!qr_ids };
      console.warn("  [save_pdf_record] missing fields:", missing);
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log("  [save_pdf_record] file_id:", file_id, "| signed_url:", signed_url ? signed_url.slice(0, 60) + "..." : "NULL ⚠️");

    const payload = {
      database_id:     pdf_db_id,
      collection_name: "pdf_records",
      documents: [{
        pdf_id,
        client_name,
        qr_db_id,
        email,
        qr_count,
        qr_ids:     JSON.stringify(qr_ids),
        qr_names:   JSON.stringify(qr_names || []),
        date,
        time,
        created_at: new Date().toISOString(),
        file_id:    file_id    || null,
        signed_url: signed_url || null
      }]
    };

    const r = await fetch(`${DATACUBE_BASE}/crud`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify(payload)
    });

    const data = await r.json();
    if (!r.ok) throw new Error(`DataCube error: ${JSON.stringify(data)}`);

    console.log("  [save_pdf_record] saved OK | inserted_ids:", data?.inserted_ids);
    res.json({ success: true, pdf_id });

  } catch (err) {
    console.error("  [save_pdf_record] ERROR:", err.message);
    res.status(500).json({ error: "Failed to save PDF record" });
  }
});

// ---------- UPLOAD PDF ----------
app.post("/api/upload_pdf", async (req, res) => {
  console.log("  [upload_pdf] filename:", req.body?.filename);
  try {
    const { pdf_base64, filename } = req.body || {};

    if (!pdf_base64 || !filename) {
      console.warn("  [upload_pdf] missing pdf_base64 or filename");
      return res.status(400).json({ error: "Missing pdf_base64 or filename" });
    }

    const base64Data = pdf_base64.includes(",")
      ? pdf_base64.split(",")[1]
      : pdf_base64;

    const pdfBuffer = Buffer.from(base64Data, "base64");
    console.log("  [upload_pdf] buffer size:", pdfBuffer.length, "bytes");

    const form = new FormData();
    form.append("file", pdfBuffer, {
      filename:    filename,
      contentType: "application/pdf"
    });
    form.append("filename",     filename);
    form.append("content_type", "application/pdf");

    console.log("  [upload_pdf] uploading to DataCube...");
    const r = await fetch(`${DATACUBE_BASE}/files/`, {
      method:  "POST",
      headers: {
        "Authorization": `Api-Key ${DATACUBE_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    const data = await r.json();
    console.log("  [upload_pdf] DataCube response:", r.status, JSON.stringify(data));

    if (!r.ok) {
      throw new Error(`DataCube upload failed (${r.status}): ${JSON.stringify(data)}`);
    }

    // Handle different possible field names from DataCube
    const fileId    = data.file_id    || data.fileId    || null;
    const signedUrl = data.signed_url || data.signedUrl || data.url || null;

    console.log("  [upload_pdf] file_id:", fileId, "| signed_url:", signedUrl ? signedUrl.slice(0, 60) + "..." : "NULL ⚠️");

    if (!fileId || !signedUrl) {
      throw new Error("DataCube returned no file_id or signed_url. Full response: " + JSON.stringify(data));
    }

    res.json({ success: true, file_id: fileId, signed_url: signedUrl });

  } catch (err) {
    console.error("  [upload_pdf] ERROR:", err.message);
    res.status(500).json({ error: "Failed to upload PDF: " + err.message });
  }
});

// ---------- SEND PDF EMAIL ----------
app.post("/api/send_pdf_email", async (req, res) => {
  console.log("  [send_pdf_email] to:", req.body?.email, "| pdf_id:", req.body?.pdf_id, "| qr_count:", req.body?.qr_count);
  try {
    const { email, signed_url, pdf_id, qr_count, client_name } = req.body || {};

    if (!email || !signed_url || !pdf_id) {
      const missing = { email: !!email, signed_url: !!signed_url, pdf_id: !!pdf_id };
      console.warn("  [send_pdf_email] missing fields:", missing);
      return res.status(400).json({ error: "Missing required fields: email, signed_url, pdf_id" });
    }

    console.log("  [send_pdf_email] fetching PDF from signed_url:", signed_url.slice(0, 80) + "...");

    url_signed = "https://datacube.uxlivinglab.online" + signed_url;
    console.log("Actual signed url foe fetching: " + url_signed);

    if (!signed_url.startsWith("http")) {
      throw new Error("Invalid signed_url — does not start with http: " + signed_url);
    }

    const fileRes = await fetch(url_signed);
    console.log("  [send_pdf_email] signed_url fetch status:", fileRes.status);

    if (!fileRes.ok) {
      throw new Error(`Failed to fetch PDF from signed URL: ${fileRes.status} ${fileRes.statusText}`);
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const pdfBuffer   = Buffer.from(arrayBuffer);
    console.log("  [send_pdf_email] PDF buffer size:", pdfBuffer.length, "bytes");

    console.log("  [send_pdf_email] sending via SMTP...");
    const info = await mailer.sendMail({
      from:    `"QR Manager" <${process.env.SMTP_USER}>`,
      to:      email,
      subject: `QR Code Batch Ready — ${qr_count} codes (${pdf_id})`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
          <h2 style="color:#7c6af7;margin-bottom:8px;">Your QR Codes are Ready</h2>
          <p style="color:#555;margin-bottom:16px;">
            Your QR code batch has been generated successfully.
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
            <tr>
              <td style="color:#888;padding:4px 0;font-size:13px;">Client</td>
              <td style="font-size:13px;text-align:right;">${client_name || "—"}</td>
            </tr>
          </table>
          <p style="color:#888;font-size:12px;margin-top:20px;">
            The PDF is attached. Each QR code is labeled with its unique name and ID.
          </p>
        </div>
      `,
      attachments: [{
        filename:    `qr-bulk-${pdf_id}.pdf`,
        content:     pdfBuffer,
        contentType: "application/pdf"
      }]
    });

    console.log("  [send_pdf_email] sent OK | messageId:", info.messageId);
    res.json({ success: true });

  } catch (err) {
    console.error("  [send_pdf_email] ERROR:", err.message);
    res.status(500).json({ error: "Failed to send email: " + err.message });
  }
});


// =====================================================================
// PUBLIC API ENDPOINTS
// =====================================================================

// ---------- GET single PDF record ----------
app.get("/api/public/pdf/:pdf_id", async (req, res) => {
  console.log("  [public/pdf] pdf_id:", req.params.pdf_id, "| pdf_db_id:", req.query.pdf_db_id);
  try {
    const { pdf_id }    = req.params;
    const { pdf_db_id } = req.query;

    if (!pdf_db_id) return res.status(400).json({ error: "Missing query param: pdf_db_id" });

    const params = new URLSearchParams({
      database_id:     pdf_db_id,
      collection_name: "pdf_records",
      filters:         JSON.stringify({ pdf_id }),
      page:            1,
      page_size:       1
    });

    const r    = await fetch(`${DATACUBE_BASE}/crud?${params}`, { headers: authHeaders() });
    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    console.log("  [public/pdf] found:", docs.length > 0);
    if (!docs.length) return res.status(404).json({ error: "PDF record not found" });

    const doc = docs[0];
    res.json({
      pdf_id:      doc.pdf_id,
      client_name: doc.client_name,
      qr_db_id:    doc.qr_db_id,
      email:       doc.email,
      qr_count:    doc.qr_count,
      qr_ids:      JSON.parse(doc.qr_ids   || "[]"),
      qr_names:    JSON.parse(doc.qr_names || "[]"),
      date:        doc.date,
      time:        doc.time,
      created_at:  doc.created_at,
      file_id:     doc.file_id    || null,
      signed_url:  doc.signed_url || null
    });

  } catch (err) {
    console.error("  [public/pdf] ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch PDF record" });
  }
});

// ---------- LIST PDF records ----------
app.get("/api/public/pdf", async (req, res) => {
  console.log("  [public/pdf list] pdf_db_id:", req.query.pdf_db_id, "| client:", req.query.client_name);
  try {
    const { pdf_db_id, client_name, page = 1, page_size = 50 } = req.query;
    if (!pdf_db_id) return res.status(400).json({ error: "Missing query param: pdf_db_id" });

    const filters = client_name ? { client_name } : {};
    const params  = new URLSearchParams({
      database_id:     pdf_db_id,
      collection_name: "pdf_records",
      filters:         JSON.stringify(filters),
      page:            Number(page),
      page_size:       Math.min(Number(page_size), 200)
    });

    const r    = await fetch(`${DATACUBE_BASE}/crud?${params}`, { headers: authHeaders() });
    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    console.log("  [public/pdf list] returned:", docs.length, "records");

    const data = docs.map(doc => ({
      pdf_id:      doc.pdf_id,
      client_name: doc.client_name,
      qr_db_id:    doc.qr_db_id,
      email:       doc.email,
      qr_count:    doc.qr_count,
      qr_ids:      JSON.parse(doc.qr_ids   || "[]"),
      qr_names:    JSON.parse(doc.qr_names || "[]"),
      date:        doc.date,
      time:        doc.time,
      created_at:  doc.created_at,
      file_id:     doc.file_id    || null,
      signed_url:  doc.signed_url || null
    }));

    res.json({ data, page: Number(page), page_size: Number(page_size) });

  } catch (err) {
    console.error("  [public/pdf list] ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch PDF records" });
  }
});

// ---------- GET single QR record ----------
app.get("/api/public/qr/:qr_id", async (req, res) => {
  console.log("  [public/qr] qr_id:", req.params.qr_id, "| client:", req.query.client_name);
  try {
    const { qr_id }       = req.params;
    const { client_name } = req.query;

    if (!client_name) return res.status(400).json({ error: "Missing query param: client_name" });

    const params = new URLSearchParams({
      database_id:     DB_ID,
      collection_name: client_name,
      filters:         JSON.stringify({ qr_id }),
      page:            1,
      page_size:       1
    });

    const r    = await fetch(`${DATACUBE_BASE}/crud?${params}`, { headers: authHeaders() });
    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    console.log("  [public/qr] found:", docs.length > 0);
    if (!docs.length) return res.status(404).json({ error: "QR code not found" });

    const doc = docs[0];
    res.json({
      qr_id:     doc.qr_id,
      qr_name:   doc.qr_name,
      qr_url:    doc.qr_url,
      qr_alias:  doc.qr_alias,
      qr_status: doc.qr_status,
      qr_pdf_id: doc.qr_pdf_id || null,
      db_id:     doc.db_id,
      date:      doc.date,
      time:      doc.time
    });

  } catch (err) {
    console.error("  [public/qr] ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch QR code" });
  }
});

// ---------- LIST QR records ----------
app.get("/api/public/qr", async (req, res) => {
  console.log("  [public/qr list] client:", req.query.client_name, "| pdf_id:", req.query.pdf_id);
  try {
    const { client_name, pdf_id, page = 1, page_size = 50 } = req.query;
    if (!client_name) return res.status(400).json({ error: "Missing query param: client_name" });

    const filters = { qr_status: 1 };
    if (pdf_id) filters.qr_pdf_id = pdf_id;

    const params = new URLSearchParams({
      database_id:     DB_ID,
      collection_name: client_name,
      filters:         JSON.stringify(filters),
      page:            Number(page),
      page_size:       Math.min(Number(page_size), 200)
    });

    const r    = await fetch(`${DATACUBE_BASE}/crud?${params}`, { headers: authHeaders() });
    const json = await r.json();
    const docs = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];

    console.log("  [public/qr list] returned:", docs.length, "records");

    const data = docs
      .filter(d => d.qr_id !== 0)
      .map(doc => ({
        qr_id:     doc.qr_id,
        qr_name:   doc.qr_name,
        qr_url:    doc.qr_url,
        qr_alias:  doc.qr_alias,
        qr_status: doc.qr_status,
        qr_pdf_id: doc.qr_pdf_id || null,
        db_id:     doc.db_id,
        date:      doc.date,
        time:      doc.time
      }));

    res.json({ data, page: Number(page), page_size: Number(page_size) });

  } catch (err) {
    console.error("  [public/qr list] ERROR:", err.message);
    res.status(500).json({ error: "Failed to fetch QR codes" });
  }
});


// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`\nServer listening on port ${PORT} ✓\n`);
});