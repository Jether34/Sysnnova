import express from "express";
import mongoose from "mongoose";
import { authRequired, roleGuard } from "../middleware/auth.js";
import { getLogs } from "../services/logs.js";
import EventLog from "../models/EventLog.js";

const router = express.Router();

router.use(authRequired, roleGuard("admin"));

const REDACT_KEYS = ["password", "privatekey", "emailcode", "codehash", "secret", "token"];

function isSensitiveKey(key) {
  const k = String(key).toLowerCase();
  return REDACT_KEYS.some((r) => k.includes(r));
}

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[deep]";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
    if (value instanceof Date) return value.toISOString();
    if (value._bsontype === "ObjectId") return value.toString();
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveKey(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function serializeDoc(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  return redact(plain);
}

async function collectionNames() {
  const db = mongoose.connection.db;
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  return cols.map((c) => c.name);
}

async function collectionCount(name) {
  const db = mongoose.connection.db;
  return db.collection(name).countDocuments();
}

// GET /api/admin/db/stats - database overview + per-collection counts
router.get("/db/stats", async (_req, res) => {
  const db = mongoose.connection.db;
  const dbStats = await db.stats({ scale: 1024 });
  const names = await collectionNames();
  const collections = [];
  for (const name of names.sort()) {
    try {
      const count = await collectionCount(name);
      collections.push({ name, count });
    } catch {
      collections.push({ name, count: null });
    }
  }
  const totalDocs = collections.reduce((sum, c) => sum + (c.count || 0), 0);
  return res.json({
    dbName: db.databaseName,
    host: mongoose.connection.host,
    collections,
    totalCollections: collections.length,
    totalDocs,
    dataSizeKb: dbStats.dataSize || 0,
    storageSizeKb: dbStats.storageSize || 0,
    indexSizeKb: dbStats.indexSize || 0,
  });
});

// GET /api/admin/db/collections - list collections with counts
router.get("/db/collections", async (_req, res) => {
  const names = await collectionNames();
  const collections = [];
  for (const name of names.sort()) {
    try {
      collections.push({ name, count: await collectionCount(name) });
    } catch {
      collections.push({ name, count: null });
    }
  }
  return res.json({ collections });
});

// GET /api/admin/db/collections/:name?page=1&limit=25&q=search
router.get("/db/collections/:name", async (req, res) => {
  const name = String(req.params.name || "").trim();
  const allowed = await collectionNames();
  if (!allowed.includes(name)) return res.status(404).json({ error: "Collection not found." });

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 25), 100);
  const q = String(req.query.q || "").trim();

  const db = mongoose.connection.db;
  const coll = db.collection(name);

  let filter = {};
  if (q) {
    // Find text-ish fields from a sample document to build a $or regex search.
    const sample = await coll.findOne({});
    const fields = [];
    if (sample) {
      for (const [k, v] of Object.entries(sample)) {
        if (typeof v === "string" || (v && typeof v === "object" && v._bsontype === "ObjectId")) fields.push(k);
        if (fields.length >= 8) break;
      }
    }
    if (fields.length) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter = { $or: fields.map((f) => ({ [f]: re })) };
    }
  }

  const total = await coll.countDocuments(filter);
  const docs = await coll.find(filter).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).toArray();

  return res.json({
    collection: name,
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    docs: docs.map(serializeDoc),
  });
});

// GET /api/admin/events?type=&actor=&q=&page=&limit=
router.get("/events", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 50), 200);
  const filter = {};

  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.actor && mongoose.isValidObjectId(req.query.actor)) filter.actor = req.query.actor;
  if (req.query.q) {
    const needle = String(req.query.q);
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ action: re }, { actorEmail: re }, { target: re }];
  }

  const total = await EventLog.countDocuments(filter);
  const docs = await EventLog.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const types = await EventLog.distinct("type");
  return res.json({
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
    types: types.sort(),
    events: docs.map((e) => ({
      id: e._id,
      type: e.type,
      action: e.action,
      actorEmail: e.actorEmail,
      actorRole: e.actorRole,
      target: e.target,
      meta: e.meta,
      ip: e.ip,
      createdAt: e.createdAt,
    })),
  });
});

// GET /api/admin/logs?level=&q=&source=&limit=
router.get("/logs", (req, res) => {
  return res.json({ logs: getLogs(req.query) });
});

export default router;
