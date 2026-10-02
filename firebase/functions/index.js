const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
setGlobalOptions({ region: "asia-south1", maxInstances: 10 });

const db = getFirestore();
const CODE_RE = /^[A-Z0-9]{8,16}$/;
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const TTL_MS = 10 * 60 * 1000;

function json(res, status, body) {
  res.status(status).set("Cache-Control", "no-store").json(body);
}

function body(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function validPair(data) {
  return CODE_RE.test(String(data.code || "").toUpperCase()) &&
    SECRET_RE.test(String(data.client_secret || ""));
}

function docFor(code) {
  return db.collection("vxcDeviceAuth").doc(code);
}

exports.vxcAuth = onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return json(res, 405, { error: "POST required" });

  const data = body(req);
  const action = String(data.action || "").trim();

  try {
    if (action === "register") {
      const code = String(data.code || "").trim().toUpperCase();
      const clientSecret = String(data.client_secret || "");
      if (!CODE_RE.test(code) || !SECRET_RE.test(clientSecret)) {
        return json(res, 400, { error: "Invalid device authorization parameters" });
      }

      const now = Date.now();
      await docFor(code).set({
        code,
        clientSecretHash: crypto.createHash("sha256").update(clientSecret).digest("hex"),
        createdAt: now,
        expiresAt: now + TTL_MS,
        status: "pending"
      });
      return json(res, 200, { status: "pending", expires_in: TTL_MS / 1000 });
    }

    if (action === "poll") {
      const code = String(data.code || "").trim().toUpperCase();
      const clientSecret = String(data.client_secret || "");
      if (!CODE_RE.test(code) || !SECRET_RE.test(clientSecret)) {
        return json(res, 400, { error: "Invalid device authorization parameters" });
      }

      const snap = await docFor(code).get();
      if (!snap.exists) return json(res, 404, { error: "Unknown or expired device code" });
      const d = snap.data();
      const secretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
      if (secretHash !== d.clientSecretHash) return json(res, 401, { error: "Invalid device secret" });
      if (Date.now() > Number(d.expiresAt || 0)) {
        await docFor(code).delete().catch(() => {});
        return json(res, 404, { error: "Device authorization expired" });
      }

      if (d.status !== "authorized") return json(res, 200, { status: "pending", authenticated: false });

      return json(res, 200, {
        status: "authorized",
        authenticated: true,
        exchange_ticket: d.exchangeTicket,
        email: d.email || "",
        expires_in: Math.max(0, Math.floor((Number(d.expiresAt) - Date.now()) / 1000))
      });
    }

    if (action === "authorize") {
      const code = String(data.code || "").trim().toUpperCase();
      if (!CODE_RE.test(code)) return json(res, 400, { error: "Invalid code" });

      const bearer = String(req.get("authorization") || "");
      const idToken = bearer.replace(/^Bearer\s+/i, "").trim();
      if (!idToken) return json(res, 401, { error: "Firebase sign-in required" });

      const snap = await docFor(code).get();
      if (!snap.exists) return json(res, 404, { error: "Unknown or expired device code" });
      const d = snap.data();
      if (Date.now() > Number(d.expiresAt || 0)) {
        await docFor(code).delete().catch(() => {});
        return json(res, 404, { error: "Device authorization expired" });
      }

      const decoded = await getAuth().verifyIdToken(idToken);
      const exchangeTicket = crypto.randomBytes(32).toString("hex");
      await docFor(code).update({
        status: "authorized",
        uid: decoded.uid,
        email: String(decoded.email || "").toLowerCase(),
        exchangeTicket,
        authorizedAt: Date.now(),
        // Never persist the Firebase ID token.
        firebaseTokenStored: false
      });
      return json(res, 200, { status: "authorized", email: decoded.email || "" });
    }

    if (action === "exchange") {
      const code = String(data.code || "").trim().toUpperCase();
      const clientSecret = String(data.client_secret || "");
      const ticket = String(data.exchange_ticket || "");
      if (!CODE_RE.test(code) || !SECRET_RE.test(clientSecret) || !/^[a-f0-9]{64}$/i.test(ticket)) {
        return json(res, 400, { error: "Invalid exchange parameters" });
      }

      const snap = await docFor(code).get();
      if (!snap.exists) return json(res, 404, { error: "Unknown or expired device code" });
      const d = snap.data();
      const secretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
      if (secretHash !== d.clientSecretHash) return json(res, 401, { error: "Invalid device secret" });
      if (d.status !== "authorized" || d.exchangeTicket !== ticket) {
        return json(res, 401, { error: "Authorization not completed" });
      }
      if (Date.now() > Number(d.expiresAt || 0)) {
        await docFor(code).delete().catch(() => {});
        return json(res, 404, { error: "Device authorization expired" });
      }

      await docFor(code).delete().catch(() => {});
      return json(res, 200, {
        status: "ok",
        authenticated: true,
        email: d.email || "",
        uid: d.uid || ""
      });
    }

    return json(res, 400, { error: "Unknown action" });
  } catch (err) {
    console.error("VirgoX auth error:", err);
    return json(res, 500, { error: "Authentication backend error" });
  }
});
