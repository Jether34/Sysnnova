import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import UserArchive from "../models/UserArchive.js";
import School from "../models/School.js";
import GradeSheet from "../models/GradeSheet.js";
import Assessment from "../models/Assessment.js";
import Message from "../models/Message.js";
import UserDevice from "../models/UserDevice.js";
import Session from "../models/Session.js";
import { signToken, cookieOptions, extractToken, signRefreshToken, refreshCookieOptions, clearAuthCookies, extractRefreshToken, generateRefreshTokenString, createSession, revokeSession, hashRefreshToken } from "../middleware/auth.js";
import { isShsGrade, STRANDS, SEMESTERS, BLOCKS, subjectsFor, env } from "../config/index.js";
import { validateClassEntry, validateTeachingEntry, advisoryTaken, assignmentTaken, teacherSlotTaken, adviserSlotTaken } from "../services/classes.js";
import { sendAccountCreated, sendLoginVerification, sendPasswordReset } from "../services/mailer.js";
import { generateUserKeys } from "../services/keys.js";
import { fullName } from "../services/excel.js";
import { generateCode, hashCode, codeMatches, getClientIp, maskEmail } from "../services/verify.js";
import { enabledSubjectsFor } from "../services/subjects.js";
import { recordEvent } from "../services/events.js";

const router = express.Router();

const CODE_TTL_MS = 10 * 60 * 1000;
const devMode = env.nodeEnv !== "production";

function devCodeOnly(code) {
  return devMode ? { devCode: code } : {};
}

export function publicUser(u) {
  return {
    id: u._id,
    role: u.role,
    email: u.email,
    firstName: u.firstName,
    middleName: u.middleName,
    lastName: u.lastName,
    fullName: fullName(u),
    gender: u.gender,
    grade: u.grade,
    strand: u.strand,
    tvlStrand: u.tvlStrand || "",
    specialization: u.specialization || "",
    section: u.section,
    schoolId: u.schoolId,
    school: u.school,
    subject: u.subject,
    semester: u.semester,
    academicYear: u.academicYear,
    advisories: u.advisories || [],
    teachingLoad: u.teachingLoad || [],
    publicKey: u.publicKey,
    privateKey: u.privateKey,
    createdAt: u.createdAt,
  };
}

async function ensureUserKeys(user) {
  if (user.role === "student" || user.role === "admin") return user;
  if (user.publicKey && user.privateKey) return user;
  const { publicKey, privateKey } = generateUserKeys();
  user.publicKey = publicKey;
  user.privateKey = privateKey;
  await user.save();
  return user;
}

function bad(req, res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

function classLabel(g, strand, tvlStrand, specialization, section) {
  let label = `Grade ${g}${strand ? " - " + strand : ""}`;
  if (tvlStrand) label += ` (${tvlStrand})`;
  if (specialization) label += ` - ${specialization}`;
  if (section) label += ` - ${section}`;
  return label;
}

async function buildDuplicateError({ role, email, grade, strand, tvlStrand, specialization, section, subject, semester, academicYear, schoolId, advisories = [], teachingLoad = [] }) {
  if (await User.findOne({ email: String(email || "").toLowerCase().trim() })) {
    return "An account with this email already exists.";
  }
  if (role === "adviser") {
    const cls = { grade, strand, section, tvlStrand, specialization };
    if (await advisoryTaken(schoolId, academicYear, cls)) {
      return `An adviser for ${classLabel(grade, strand, tvlStrand, specialization, section)} (S.Y. ${academicYear}) already exists in this school. Duplicate adviser accounts are not allowed.`;
    }
    const adviserSlot = await adviserSlotTaken(schoolId, { grade, strand, section, academicYear, tvlStrand, specialization });
    if (adviserSlot.taken) {
      return `An adviser for ${classLabel(grade, strand, tvlStrand, specialization, section)} (S.Y. ${academicYear}) already exists in this school at the same location. Only one adviser per class is allowed.`;
    }
    for (const a of advisories) {
      if (await advisoryTaken(schoolId, a.academicYear || academicYear, a)) {
        return `Adviser for ${classLabel(a.grade, a.strand, a.tvlStrand, a.specialization, a.section)} (S.Y. ${a.academicYear || academicYear}) already exists in this school.`;
      }
    }
    for (const a of teachingLoad) {
      if (await assignmentTaken(schoolId, a)) {
        return `A subject teacher for ${a.subject} (${classLabel(a.grade, a.strand, a.tvlStrand, a.specialization, a.section)}, ${a.semester}, S.Y. ${a.academicYear}) already exists in this school.`;
      }
    }
  } else if (role === "teacher") {
    const slot = await teacherSlotTaken(schoolId, { grade, strand, section: section || "", academicYear, tvlStrand, specialization });
    if (slot.taken) {
      const name = slot.teacher ? fullName(slot.teacher) : "Another teacher";
      return `${name} is already assigned as the subject teacher for ${classLabel(grade, strand, tvlStrand, specialization, section)} (S.Y. ${academicYear}) in this school. Only one subject teacher per class is allowed.`;
    }
    for (const a of teachingLoad) {
      if (await assignmentTaken(schoolId, a)) {
        return `A subject teacher for ${a.subject} (${classLabel(a.grade, a.strand, a.tvlStrand, a.specialization, a.section)}, ${a.semester}, S.Y. ${a.academicYear}) already exists in this school.`;
      }
    }
  }
  return "";
}

function validateSignup(body) {
  const { role, email, password, firstName, lastName, grade, academicYear } = body;
  const errors = [];
  if (!["adviser", "teacher", "student"].includes(role)) errors.push("Invalid role.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("A valid email is required.");
  if (!password || password.length < 6) errors.push("Password must be at least 6 characters.");
  if (!firstName || !lastName) errors.push("First and last name are required.");
  if (!grade) errors.push("Grade level is required.");
  if (!academicYear) errors.push("Academic year is required.");

  if (isShsGrade(grade) && !STRANDS.includes(body.strand)) errors.push(`A valid strand is required for SHS: ${STRANDS.join(", ")}.`);
  if (!isShsGrade(grade)) body.strand = "";
  if (body.strand === "TVL" && !body.tvlStrand) errors.push("TVL Track is required for TVL strand.");
  if (body.strand === "TVL" && !body.specialization) errors.push("A specialization is required for TVL strand.");

  if (role === "adviser" && !BLOCKS.includes(body.section)) errors.push("Section/Block is required for advisers (Block 1-20).");
  if (role === "student" && !BLOCKS.includes(body.section)) errors.push("Section/Block is required for students (Block 1-20).");
  if (role === "teacher") {
    if (!subjectsFor(grade).includes(body.subject)) {
      errors.push(`Subject is required for subject teachers. Choose from: ${subjectsFor(grade).join(", ")}.`);
    }
    if (!SEMESTERS.includes(body.semester)) errors.push("Semester is required for subject teachers.");
  }

  if (Array.isArray(body.advisories)) {
    for (const a of body.advisories) errors.push(...validateClassEntry(a));
  }
  if (Array.isArray(body.teachingLoad)) {
    for (const a of body.teachingLoad) errors.push(...validateTeachingEntry(a));
  }
  return errors;
}

async function issueTokens(user, deviceId, req, res) {
  const refreshTokenString = generateRefreshTokenString();
  const session = await createSession(user, {
    deviceId,
    deviceName: req.headers["x-device-name"] || req.headers["user-agent"] || "",
    platform: req.headers["x-platform"] || "",
    tokenString: refreshTokenString,
    ip: getClientIp(req),
    userAgent: req.headers["user-agent"] || "",
  });
  const token = signToken(user, deviceId);
  const refresh = signRefreshToken(user, deviceId, session._id, refreshTokenString);
  res.cookie("token", token, cookieOptions());
  res.cookie("refresh", refresh, refreshCookieOptions());
  return { token, refresh, sessionId: session._id };
}

async function findOrCreateDevice(user, deviceId, deviceName, platform) {
  const existing = await UserDevice.findOne({ userId: user._id, deviceId });
  if (existing) {
    existing.lastSeenAt = new Date();
    existing.isActive = true;
    await existing.save();
    return existing;
  }
  if (deviceName && platform) {
    return UserDevice.create({
      userId: user._id,
      deviceId,
      deviceName,
      platform,
      isActive: true,
    });
  }
  const dev = await UserDevice.create({
    userId: user._id,
    deviceId,
    deviceName: deviceName || "Unknown Device",
    platform: platform || "unknown",
    isActive: true,
  });
  return dev;
}

// POST /api/auth/signup
router.post("/signup", async (req, res, next) => {
  const b = req.body;
  const errors = validateSignup(b);
  if (errors.length) return bad(req, res, errors.join(" "));

  const schoolName = String(b.school?.name || "").trim();
  const province = String(b.school?.province || "").trim();
  const city = String(b.school?.city || "").trim();
  const barangay = String(b.school?.barangay || "").trim();
  if (!schoolName || !province || !city || !barangay) {
    return bad(req, res, "Please select a school from the list (school, province, city/municipality and barangay are required).");
  }
  const school = await School.findOne({ name: schoolName, province, city, barangay });
  if (!school) {
    return bad(req, res, "School not found. Please select a valid school from the list.");
  }

  if (b.role === "teacher") {
    const enabled = await enabledSubjectsFor({ schoolId: school._id, semester: b.semester, grade: b.grade });
    if (!enabled.includes(b.subject)) {
      return bad(req, res, `"${b.subject}" is not an enabled subject for this school and semester. Choose from: ${enabled.join(", ")}.`);
    }
    for (const entry of Array.isArray(b.teachingLoad) ? b.teachingLoad : []) {
      const entryEnabled = await enabledSubjectsFor({ schoolId: school._id, semester: entry.semester, grade: entry.grade });
      if (!entryEnabled.includes(entry.subject)) {
        return bad(req, res, `"${entry.subject}" is not an enabled subject for this school and semester. Choose from: ${entryEnabled.join(", ")}.`);
      }
    }
  }

  const dup = await buildDuplicateError({ ...b, schoolId: school._id });
  if (dup) return bad(req, res, dup, 409);

  const hash = await bcrypt.hash(b.password, 10);
  const keys = b.role === "student" ? {} : generateUserKeys();
  const clientIp = getClientIp(req);

  const advisory = { grade: String(b.grade), strand: b.strand || "", tvlStrand: b.tvlStrand || "", specialization: b.specialization || "", section: String(b.section || ""), academicYear: b.academicYear };
  const advisories = b.role === "adviser"
    ? [advisory, ...(Array.isArray(b.advisories) ? b.advisories.map((a) => ({ grade: String(a.grade), strand: a.strand || "", tvlStrand: a.tvlStrand || "", specialization: a.specialization || "", section: String(a.section || ""), academicYear: a.academicYear })) : [])]
    : [];
  const teachingLoad = [
    ...(b.role === "teacher"
      ? [{ grade: String(b.grade), strand: b.strand || "", tvlStrand: b.tvlStrand || "", specialization: b.specialization || "", section: String(b.section || ""), academicYear: b.academicYear, subject: String(b.subject).trim(), semester: String(b.semester).trim() }]
      : []),
    ...(Array.isArray(b.teachingLoad)
      ? b.teachingLoad.map((a) => ({
          grade: String(a.grade), strand: a.strand || "", tvlStrand: a.tvlStrand || "", specialization: a.specialization || "",
          section: String(a.section || ""), academicYear: a.academicYear, subject: String(a.subject).trim(), semester: String(a.semester).trim(),
        }))
      : []),
  ];

  let user;
  try {
    user = await User.create({
      role: b.role,
      email: b.email.toLowerCase().trim(),
      password: hash,
      firstName: b.firstName,
      middleName: b.middleName || "",
      lastName: b.lastName,
      gender: b.gender || "",
      grade: String(b.grade),
      strand: b.strand || "",
      tvlStrand: b.tvlStrand || "",
      specialization: b.specialization || "",
      section: b.section || "",
      schoolId: school._id,
      school: { id: school._id, name: school.name, province: school.province, city: school.city, barangay: school.barangay },
      subject: b.subject || "",
      semester: b.semester || "",
      academicYear: b.academicYear,
      advisories,
      teachingLoad,
      publicKey: keys.publicKey || "",
      privateKey: keys.privateKey || "",
      verifiedIps: clientIp ? [clientIp] : [],
    });
  } catch (err) {
    if (err?.code === 11000) {
      return bad(req, res, "An account with this email already exists.", 409);
    }
    return next(err);
  }

  sendAccountCreated(user.email, {
    firstName: user.firstName,
    role: user.role,
    email: user.email,
    grade: user.grade,
    strand: user.strand,
    tvlStrand: user.tvlStrand,
    specialization: user.specialization,
    section: user.section,
    subject: user.subject,
    semester: user.semester,
    academicYear: user.academicYear,
    school: user.school,
  }).catch(() => {});

  await ensureUserKeys(user);

  const deviceId = req.headers["x-device-id"] || "";
  const deviceName = req.headers["x-device-name"] || req.headers["user-agent"] || "";
  const platform = req.headers["x-platform"] || "";

  if (deviceId) {
    await findOrCreateDevice(user, deviceId, deviceName, platform);
  }

  const tokens = await issueTokens(user, deviceId, req, res);
  recordEvent({
    type: "auth.signup",
    action: "Account registered",
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    target: user.email,
    meta: { grade: user.grade, strand: user.strand, school: user.school?.name || "", deviceId },
    ip: getClientIp(req),
  });
  return res.status(201).json({ user: publicUser(user), token: tokens.token, refresh: tokens.refresh, sessionId: tokens.sessionId });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return bad(req, res, "Email and password are required.");
  const clientIp = getClientIp(req);
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    recordEvent({
      type: "auth.login_failed",
      action: "Login failed",
      actorEmail: email.toLowerCase().trim(),
      target: email.toLowerCase().trim(),
      meta: { reason: "invalid credentials" },
      ip: clientIp,
    });
    return bad(req, res, "Invalid email or password.", 401);
  }

  const deviceId = req.headers["x-device-id"] || "";

  if (!deviceId) {
    await ensureUserKeys(user);
    const tokens = await issueTokens(user, "", req, res);
    recordEvent({
      type: "auth.login",
      action: "Logged in (no device id)",
      actor: user._id,
      actorEmail: user.email,
      actorRole: user.role,
      target: user.email,
      ip: clientIp,
    });
    return res.json({ user: publicUser(user), token: tokens.token, refresh: tokens.refresh, sessionId: tokens.sessionId });
  }

  const existingDevice = await UserDevice.findOne({ userId: user._id, deviceId, isActive: true });
  if (existingDevice) {
    await UserDevice.updateOne({ _id: existingDevice._id }, { lastSeenAt: new Date() });
  } else {
    const deviceName = req.headers["x-device-name"] || req.headers["user-agent"] || "";
    const platform = req.headers["x-platform"] || "";
    await findOrCreateDevice(user, deviceId, deviceName, platform);
    user.deviceId = deviceId;
    await user.save();
  }

  const knownIps = user.verifiedIps || [];
  if (knownIps.length === 0) {
    user.verifiedIps = clientIp ? [clientIp] : [];
    await user.save();
  } else if (clientIp && !knownIps.includes(clientIp)) {
    const code = generateCode();
    user.emailCode = { codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS), purpose: "login" };
    await user.save();
    sendLoginVerification(user.email, { firstName: user.firstName, code, ip: clientIp }).catch(() => {});
    return res.json({ needsVerification: true, maskedEmail: maskEmail(user.email), ...devCodeOnly(code) });
  }

  await ensureUserKeys(user);
  const tokens = await issueTokens(user, deviceId, req, res);
  recordEvent({
    type: "auth.login",
    action: "Logged in",
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    target: user.email,
    meta: { deviceId },
    ip: clientIp,
  });
  return res.json({ user: publicUser(user), token: tokens.token, refresh: tokens.refresh, sessionId: tokens.sessionId });
});

// POST /api/auth/login/verify - approve a login from a new IP via emailed code
router.post("/login/verify", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return bad(req, res, "Email and verification code are required.");
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.emailCode?.purpose !== "login" || !codeMatches(user.emailCode, code)) {
    return bad(req, res, "Invalid or expired verification code.", 400);
  }
  const clientIp = getClientIp(req);
  if (clientIp && !(user.verifiedIps || []).includes(clientIp)) {
    user.verifiedIps = [...(user.verifiedIps || []), clientIp];
  }
  user.emailCode = null;

  const deviceId = req.headers["x-device-id"] || "";
  if (deviceId) {
    const deviceName = req.headers["x-device-name"] || req.headers["user-agent"] || "";
    const platform = req.headers["x-platform"] || "";
    await findOrCreateDevice(user, deviceId, deviceName, platform);
    user.deviceId = deviceId;
  }

  await ensureUserKeys(user);
  await user.save();
  const tokens = await issueTokens(user, deviceId, req, res);
  recordEvent({
    type: "auth.login_verified",
    action: "Login verified from new device",
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    target: user.email,
    meta: { deviceId },
    ip: getClientIp(req),
  });
  return res.json({ user: publicUser(user), token: tokens.token, refresh: tokens.refresh, sessionId: tokens.sessionId });
});

// POST /api/auth/forgot-password - email a reset code
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(req, res, "A valid email is required.");
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  const resp = { ok: true, maskedEmail: maskEmail(email) };
  if (!user) return res.json(resp);
  const code = generateCode();
  user.emailCode = { codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS), purpose: "reset" };
  await user.save();
  sendPasswordReset(user.email, { firstName: user.firstName, code }).catch(() => {});
  return res.json({ ...resp, ...devCodeOnly(code) });
});

// POST /api/auth/reset-password - set a new password with a valid reset code
router.post("/reset-password", async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code) return bad(req, res, "Email and reset code are required.");
  if (!password || password.length < 6) return bad(req, res, "Password must be at least 6 characters.");
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || user.emailCode?.purpose !== "reset" || !codeMatches(user.emailCode, code)) {
    return bad(req, res, "Invalid or expired reset code.", 400);
  }
  user.password = await bcrypt.hash(password, 10);
  user.emailCode = null;
  await user.save();
  return res.json({ ok: true });
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  const token = extractToken(req);
  const refreshToken = extractRefreshToken(req);

  if (refreshToken) {
    try {
      const rp = jwt.verify(refreshToken, env.jwtSecret);
      if (rp.type === "refresh") {
        await Session.updateOne(
          { _id: rp.sessionId, refreshTokenHash: hashRefreshToken(rp.token || ""), revokedAt: null },
          { revokedAt: new Date() }
        );
      }
    } catch {
      /* ignore invalid refresh token */
    }
  }

  clearAuthCookies(res);
  return res.json({ ok: true });
});

// GET /api/auth/me - validate current session and return user info
router.get("/me", async (req, res) => {
  const token = extractToken(req);
  let user = null;
  let sessionId = null;

  if (token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      if (payload.type === "access") {
        user = await User.findById(payload.id);
        sessionId = payload.sessionId || null;
      }
    } catch {
      user = null;
    }
  }

  if (!user) {
    const refreshToken = extractRefreshToken(req);
    if (refreshToken) {
      try {
        const rp = jwt.verify(refreshToken, env.jwtSecret);
        if (rp.type === "refresh") {
          const session = await Session.findById(rp.sessionId).exec();
          if (session && !session.revokedAt && new Date(session.expiresAt) > new Date()) {
            const candidate = await User.findById(rp.id);
            if (candidate) {
              await Session.updateOne({ _id: session._id }, { lastUsedAt: new Date() });
              user = candidate;
              sessionId = session._id;
              const newToken = signToken(user, rp.deviceId, session._id);
              const newRefresh = signRefreshToken(user, rp.deviceId, session._id);
              res.cookie("token", newToken, cookieOptions());
              res.cookie("refresh", newRefresh, refreshCookieOptions());
            }
          }
        }
      } catch {
        /* ignore invalid refresh token */
      }
    }
  }

  if (!user) return res.json({ user: null });
  await ensureUserKeys(user);
  return res.json({ user: publicUser(user), sessionId });
});

// POST /api/auth/refresh - obtain a new access token using a valid refresh token
router.post("/refresh", async (req, res) => {
  const refreshToken = extractRefreshToken(req);
  if (!refreshToken) return bad(req, res, "Refresh token is required.", 401);

  try {
    const payload = jwt.verify(refreshToken, env.jwtSecret);
    if (payload.type !== "refresh") {
      return bad(req, res, "Invalid refresh token.", 401);
    }

    const session = await Session.findById(payload.sessionId).exec();
    if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
      return bad(req, res, "Session expired, please login again.", 401);
    }

    const tokenHash = hashRefreshToken(payload.token || "");
    if (session.refreshTokenHash !== tokenHash) {
      return bad(req, res, "Invalid session, please login again.", 401);
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return bad(req, res, "User not found.", 401);
    }

    await Session.updateOne({ _id: session._id }, { lastUsedAt: new Date() });
    const newToken = signToken(user, payload.deviceId, session._id);
    return res.json({ token: newToken });
  } catch (err) {
    return bad(req, res, "Invalid or expired refresh token.", 401);
  }
});

// DELETE /api/auth/me - delete own account (archive data first)
router.delete("/me", async (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Invalid token." });
  }
  const user = await User.findById(payload.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  // Archive the user
  await UserArchive.create({
    originalId: user._id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    gender: user.gender,
    grade: user.grade,
    strand: user.strand,
    section: user.section,
    schoolId: user.schoolId,
    school: user.school,
    subject: user.subject,
    semester: user.semester,
    academicYear: user.academicYear,
    advisories: user.advisories || [],
    teachingLoad: user.teachingLoad || [],
    deletedBy: user._id,
  });

  // Remove related data
  await GradeSheet.deleteMany({ $or: [{ teacherId: user._id }, { adviserId: user._id }] });
  await Assessment.deleteMany({ $or: [{ teacherId: user._id }, { adviserId: user._id }] });
  await Message.deleteMany({ $or: [{ senderId: user._id }, { recipientId: user._id }] });
  await Session.deleteMany({ userId: user._id });
  await UserDevice.deleteMany({ userId: user._id });
  await user.deleteOne();

  recordEvent({
    type: "account.deleted",
    action: "Account deleted",
    actor: user._id,
    actorEmail: user.email,
    actorRole: user.role,
    target: user.email,
    meta: { selfDelete: true },
    ip: getClientIp(req),
  });

  clearAuthCookies(res);
  return res.json({ ok: true, message: "Account deleted and data archived." });
});

export default router;
