import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";
import Message from "../models/Message.js";
import MessageArchive from "../models/MessageArchive.js";
import User from "../models/User.js";
import { authRequired, roleGuard } from "../middleware/auth.js";
import { fullName } from "../services/excel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

const router = express.Router();

function allowedTargets(me) {
  if (me.role === "adviser") return { role: "teacher" };
  if (me.role === "teacher") return { role: "adviser" };
  return null;
}

function sameSchool(me, peer) {
  if (!me.schoolId || !peer.schoolId) return true;
  return String(me.schoolId) === String(peer.schoolId);
}

function contactView(u, last, unread) {
  return {
    id: u._id,
    role: u.role,
    fullName: fullName(u),
    grade: u.grade,
    strand: u.strand,
    specialization: u.specialization || "",
    section: u.section,
    subject: u.subject,
    semester: u.semester,
    academicYear: u.academicYear,
    lastMessageAt: last?.createdAt || null,
    lastSenderId: last?.senderId || null,
    unread,
  };
}

// POST /api/messages/upload - upload a file attachment
router.post("/upload", authRequired, roleGuard("adviser", "teacher"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided." });
  const url = `/messages/file/${req.file.filename}`;
  return res.json({
    filename: req.file.originalname,
    url,
    size: req.file.size,
    type: req.file.mimetype,
  });
});

// GET /api/messages/file/:filename - download a file attachment
router.get("/file/:filename", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(__dirname, "..", "..", "uploads", filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }
  return res.download(filePath, filename);
});

// GET /api/messages/contacts
router.get("/contacts", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const target = allowedTargets(me);
  const contacts = await User.find({ role: target.role, schoolId: me.schoolId }).sort({ lastName: 1 });

  const out = [];
  for (const c of contacts) {
    const last = await Message.findOne({
      $or: [
        { senderId: me._id, recipientId: c._id },
        { senderId: c._id, recipientId: me._id },
      ],
    }).sort({ createdAt: -1 });
    const unread = await Message.countDocuments({ senderId: c._id, recipientId: me._id, read: false });
    out.push(contactView(c, last, unread));
  }
  return res.json({ contacts: out });
});

// GET /api/messages/search?peerId=...&q=... — returns all encrypted messages between two users for client-side search
router.get("/search", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const { peerId } = req.query;
  if (!peerId) return res.json({ messages: [] });

  const target = allowedTargets(me);
  const peer = await User.findById(peerId);
  if (!peer || peer.role !== target.role) return res.json({ messages: [] });

  const messages = await Message.find({
    $or: [
      { senderId: me._id, recipientId: peer._id },
      { senderId: peer._id, recipientId: me._id },
    ],
  }).sort({ createdAt: 1 });

  return res.json({
    messages: messages.map((m) => ({
      id: m._id,
      senderId: m.senderId,
      ciphertext: m.ciphertext,
      iv: m.iv,
      wrappedKey: m.wrappedKey,
      selfCiphertext: m.selfCiphertext,
      selfIv: m.selfIv,
      selfWrappedKey: m.selfWrappedKey,
      createdAt: m.createdAt,
    })),
  });
});

// DELETE /api/messages/conversation/:peerId — archive and delete conversation with a peer
router.delete("/conversation/:peerId", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const peerId = req.params.peerId;
  if (!mongoose.isValidObjectId(peerId)) return res.status(400).json({ error: "Invalid user." });

  const target = allowedTargets(me);
  const peer = await User.findById(peerId);
  if (!peer || peer.role !== target.role) return res.status(400).json({ error: "Invalid peer." });

  const messages = await Message.find({
    $or: [
      { senderId: me._id, recipientId: peer._id },
      { senderId: peer._id, recipientId: me._id },
    ],
  });

  if (messages.length === 0) return res.status(404).json({ error: "No messages found." });

  const archives = messages.map((m) => ({
    originalMessageId: m._id,
    senderId: m.senderId,
    recipientId: m.recipientId,
    ciphertext: m.ciphertext,
    iv: m.iv,
    wrappedKey: m.wrappedKey,
    selfCiphertext: m.selfCiphertext || "",
    selfIv: m.selfIv || "",
    selfWrappedKey: m.selfWrappedKey || "",
    attachments: m.attachments || [],
    read: m.read,
    originalCreatedAt: m.createdAt,
    archivedBy: me._id,
  }));

  await MessageArchive.insertMany(archives);
  await Message.deleteMany({ _id: { $in: messages.map((m) => m._id) } });

  return res.json({ message: `${messages.length} message${messages.length === 1 ? "" : "s"} archived and deleted.`, count: messages.length });
});

// GET /api/messages/:userId
router.get("/:userId", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(400).json({ error: "Invalid user." });
  const me = await User.findById(req.userId);
  const peer = await User.findById(req.params.userId);
  if (!peer) return res.status(404).json({ error: "User not found." });

  const target = allowedTargets(me);
  if (peer.role !== target.role) {
    return res.status(403).json({ error: "You can only message " + (target.role === "teacher" ? "subject teachers" : "advisers") + "." });
  }
  if (!sameSchool(me, peer)) {
    return res.status(403).json({ error: "You can only message people in your own school." });
  }

  const messages = await Message.find({
    $or: [
      { senderId: me._id, recipientId: peer._id },
      { senderId: peer._id, recipientId: me._id },
    ],
  }).sort({ createdAt: 1 });

  await Message.updateMany({ senderId: peer._id, recipientId: me._id, read: false }, { $set: { read: true } });

  return res.json({
    peer: {
      id: peer._id,
      role: peer.role,
      fullName: fullName(peer),
      publicKey: peer.publicKey,
      grade: peer.grade,
      strand: peer.strand,
      section: peer.section,
      subject: peer.subject,
      semester: peer.semester,
      academicYear: peer.academicYear,
    },
    messages: messages.map((m) => ({
      id: m._id,
      senderId: m.senderId,
      recipientId: m.recipientId,
      ciphertext: m.ciphertext,
      iv: m.iv,
      wrappedKey: m.wrappedKey,
      selfCiphertext: m.selfCiphertext,
      selfIv: m.selfIv,
      selfWrappedKey: m.selfWrappedKey,
      attachments: m.attachments || [],
      read: m.read,
      createdAt: m.createdAt,
    })),
  });
});

// POST /api/messages
router.post("/", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const { recipientId, ciphertext, iv, wrappedKey, selfCiphertext, selfIv, selfWrappedKey, attachments, clientOpId } = req.body;
  if (!recipientId || !ciphertext || !iv || !wrappedKey) {
    return res.status(400).json({ error: "Missing encrypted message payload." });
  }
  if (!mongoose.isValidObjectId(recipientId)) {
    return res.status(400).json({ error: "Invalid recipient." });
  }
  const recipient = await User.findById(recipientId);
  if (!recipient) return res.status(404).json({ error: "Recipient not found." });

  const target = allowedTargets(me);
  if (recipient.role !== target.role) {
    return res.status(403).json({ error: "You can only message " + (target.role === "teacher" ? "subject teachers" : "advisers") + "." });
  }
  if (!sameSchool(me, recipient)) {
    return res.status(403).json({ error: "You can only message people in your own school." });
  }

  if (clientOpId) {
    const existing = await Message.findOne({ senderId: me._id, clientOpId });
    if (existing) {
      return res.status(200).json({ message: { id: existing._id, createdAt: existing.createdAt } });
    }
  }

  const message = await Message.create({
    senderId: me._id,
    recipientId,
    ciphertext,
    iv,
    wrappedKey,
    selfCiphertext: selfCiphertext || "",
    selfIv: selfIv || "",
    selfWrappedKey: selfWrappedKey || "",
    attachments: Array.isArray(attachments) ? attachments : [],
    clientOpId: clientOpId || "",
  });
  return res.status(201).json({ message: { id: message._id, createdAt: message.createdAt } });
});

export default router;
