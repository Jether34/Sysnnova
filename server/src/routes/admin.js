import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import School from "../models/School.js";
import SchoolSubjects from "../models/SchoolSubjects.js";
import { authRequired, roleGuard } from "../middleware/auth.js";
import { getTrafficStats } from "../services/traffic.js";
import { fullName } from "../services/excel.js";
import { isShsGrade, STRANDS, SEMESTERS, BLOCKS, JHS_SUBJECTS, SHS_SUBJECTS, subjectsFor } from "../config/index.js";
import { generateUserKeys } from "../services/keys.js";
import { sendAccountCreated } from "../services/mailer.js";
import { enabledSubjectsFor } from "../services/subjects.js";
import { recordEvent } from "../services/events.js";
import { getClientIp } from "../services/verify.js";

const router = express.Router();

const ROLES = ["adviser", "teacher", "student", "admin"];

function bad(req, res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

function adminBrief(u) {
  return {
    id: u._id,
    role: u.role,
    fullName: fullName(u),
    firstName: u.firstName,
    middleName: u.middleName,
    lastName: u.lastName,
    email: u.email,
    gender: u.gender,
    grade: u.grade,
    strand: u.strand,
    tvlStrand: u.tvlStrand || "",
    specialization: u.specialization || "",
    section: u.section,
    subject: u.subject,
    semester: u.semester,
    academicYear: u.academicYear,
    schoolId: u.schoolId,
    school: u.school,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

function validateUser(body, { creating }) {
  const errors = [];
  if (!ROLES.includes(body.role)) errors.push("Invalid role.");
  if (!body.firstName || !body.lastName) errors.push("First and last name are required.");
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push("A valid email is required.");
  if (creating && (!body.password || body.password.length < 6)) errors.push("Password must be at least 6 characters.");
  if (body.password && creating === false && body.password.length < 6) errors.push("Password must be at least 6 characters.");

  if (body.role !== "admin") {
    if (!body.grade) errors.push("Grade level is required.");
    if (!body.academicYear) errors.push("Academic year is required.");
    if (isShsGrade(body.grade) && !STRANDS.includes(body.strand)) errors.push(`A valid strand is required for SHS: ${STRANDS.join(", ")}.`);
    if (body.strand === "TVL" && !body.tvlStrand) errors.push("TVL Track is required for TVL strand.");
    if (body.strand === "TVL" && !body.specialization) errors.push("A specialization is required for TVL strand.");
    if (body.role === "adviser" && !BLOCKS.includes(body.section)) errors.push("Section/Block is required for advisers (Block 1-20).");
    if (body.role === "student" && !BLOCKS.includes(body.section)) errors.push("Section/Block is required for students (Block 1-20).");
    if (body.role === "teacher") {
      if (!subjectsFor(body.grade).includes(body.subject)) errors.push(`Subject is required for subject teachers. Choose from: ${subjectsFor(body.grade).join(", ")}.`);
      if (!SEMESTERS.includes(body.semester)) errors.push("Semester is required for subject teachers.");
    }
  }
  return errors;
}

async function validateTeacherSubject(body) {
  if (body.role !== "teacher" || !body.grade) return null;
  const { grade, subject, semester, schoolId } = body;
  const enabled = await enabledSubjectsFor({ schoolId, semester, grade });
  if (!enabled.includes(subject)) {
    return `"${subject}" is not an enabled subject for this school and semester. Choose from: ${enabled.join(", ")}.`;
  }
  return null;
}

async function resolveSchool(b) {
  const name = String(b.school?.name || "").trim();
  const province = String(b.school?.province || "").trim();
  const city = String(b.school?.city || "").trim();
  const barangay = String(b.school?.barangay || "").trim();
  if (!name && !province && !city && !barangay) return { schoolId: null, school: null };
  if (!name || !province || !city || !barangay) {
    return { error: "Please select a school from the list (school, province, city/municipality and barangay are required)." };
  }
  const s = await School.findOne({ name, province, city, barangay });
  if (!s) return { error: "School not found. Please select a valid school from the list." };
  return { schoolId: s._id, school: { id: s._id, name: s.name, province: s.province, city: s.city, barangay: s.barangay } };
}

async function ensureKeysFor(role, user) {
  if (role !== "teacher" && role !== "adviser") return;
  if (user.publicKey && user.privateKey) return;
  const { publicKey, privateKey } = generateUserKeys();
  user.publicKey = publicKey;
  user.privateKey = privateKey;
}

// GET /api/admin/users - list all accounts (optional ?role= filter)
router.get("/users", authRequired, roleGuard("admin"), async (req, res) => {
  const query = {};
  if (req.query.role && ROLES.includes(req.query.role)) query.role = req.query.role;
  const users = await User.find(query).sort({ role: 1, lastName: 1, firstName: 1 });
  return res.json({ users: users.map(adminBrief) });
});

// POST /api/admin/users - create an account
router.post("/users", authRequired, roleGuard("admin"), async (req, res) => {
  const b = req.body || {};
  const errors = validateUser(b, { creating: true });
  if (errors.length) return bad(req, res, errors.join(" "));

  if (await User.findOne({ email: String(b.email).toLowerCase().trim() })) {
    return bad(req, res, "An account with this email already exists.", 409);
  }

  if (b.role !== "admin") {
    const school = await resolveSchool(b);
    if (school.error) return bad(req, res, school.error);
    b.schoolId = school.schoolId;
    b.school = school.school;
  } else {
    b.schoolId = null;
    b.school = null;
  }

  const subjectError = await validateTeacherSubject(b);
  if (subjectError) return bad(req, res, subjectError);

  const hash = await bcrypt.hash(b.password, 10);
  const keys = b.role === "teacher" || b.role === "adviser" ? generateUserKeys() : {};
  const isAdmin = b.role === "admin";
  const user = await User.create({
    role: b.role,
    email: String(b.email).toLowerCase().trim(),
    password: hash,
    firstName: b.firstName,
    middleName: b.middleName || "",
    lastName: b.lastName,
    gender: b.gender || "",
    grade: isAdmin ? "N/A" : String(b.grade),
    strand: isAdmin ? "" : b.strand || "",
    specialization: isAdmin ? "" : b.specialization || "",
    tvlStrand: isAdmin ? "" : b.tvlStrand || "",
    section: b.section || "",
    subject: b.subject || "",
    semester: b.semester || "",
    academicYear: isAdmin ? "N/A" : String(b.academicYear),
    schoolId: b.schoolId,
    school: b.school,
    publicKey: keys.publicKey || "",
    privateKey: keys.privateKey || "",
  });

  sendAccountCreated(user.email, {
    firstName: user.firstName,
    role: user.role,
    email: user.email,
    grade: user.grade,
    strand: user.strand,
    section: user.section,
    subject: user.subject,
    semester: user.semester,
    academicYear: user.academicYear,
    school: user.school,
  }).catch(() => {});
  recordEvent({
    type: "admin.user.create",
    action: `Created ${user.role} account`,
    actor: req.userId,
    actorEmail: req.userEmail || "",
    actorRole: "admin",
    target: user.email,
    meta: { role: user.role, grade: user.grade, strand: user.strand, school: user.school?.name || "" },
    ip: getClientIp(req),
  });
  return res.status(201).json({ user: adminBrief(user) });
});

// PUT /api/admin/users/:id - edit an account
router.put("/users/:id", authRequired, roleGuard("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(req, res, "Invalid user.");
  const user = await User.findById(req.params.id);
  if (!user) return bad(req, res, "User not found", 404);

  const b = req.body || {};
  const errors = validateUser(b, { creating: false });
  if (errors.length) return bad(req, res, errors.join(" "));

  const email = String(b.email).toLowerCase().trim();
  if (await User.findOne({ email, _id: { $ne: user._id } })) {
    return bad(req, res, "An account with this email already exists.", 409);
  }

  if (b.role !== "admin") {
    const school = await resolveSchool(b);
    if (school.error) return bad(req, res, school.error);
    user.schoolId = school.schoolId;
    user.school = school.school;
  } else {
    user.schoolId = null;
    user.school = null;
  }

  const subjectError = await validateTeacherSubject({ ...b, schoolId: user.schoolId });
  if (subjectError) return bad(req, res, subjectError);

  const isAdmin = b.role === "admin";
  user.role = b.role;
  user.email = email;
  user.firstName = b.firstName;
  user.middleName = b.middleName || "";
  user.lastName = b.lastName;
  user.gender = b.gender || "";
  user.grade = isAdmin ? "N/A" : String(b.grade);
  user.strand = isAdmin ? "" : b.strand || "";
  user.specialization = isAdmin ? "" : b.specialization || "";
  user.tvlStrand = isAdmin ? "" : b.tvlStrand || "";
  user.section = b.section || "";
  user.subject = b.subject || "";
  user.semester = b.semester || "";
  user.academicYear = isAdmin ? "N/A" : String(b.academicYear);
  if (b.password) user.password = await bcrypt.hash(b.password, 10);

  if (user.role !== "admin") await ensureKeysFor(user.role, user);
  await user.save();

  recordEvent({
    type: "admin.user.update",
    action: `Updated ${user.role} account`,
    actor: req.userId,
    actorEmail: req.userEmail || "",
    actorRole: "admin",
    target: user.email,
    meta: { role: user.role, grade: user.grade, strand: user.strand, school: user.school?.name || "" },
    ip: getClientIp(req),
  });

  return res.json({ user: adminBrief(user) });
});

// DELETE /api/admin/users/:id - delete an account
router.delete("/users/:id", authRequired, roleGuard("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(req, res, "Invalid user.");
  if (String(req.params.id) === String(req.userId)) return bad(req, res, "You cannot delete your own account.", 400);
  const user = await User.findById(req.params.id);
  if (!user) return bad(req, res, "User not found", 404);
  await User.findByIdAndDelete(req.params.id);
  recordEvent({
    type: "admin.user.delete",
    action: `Deleted ${user.role} account`,
    actor: req.userId,
    actorEmail: req.userEmail || "",
    actorRole: "admin",
    target: user.email,
    meta: { role: user.role, fullName: fullName(user) },
    ip: getClientIp(req),
  });
  return res.json({ ok: true });
});

// GET /api/admin/traffic - real-time system traffic stats
router.get("/traffic", authRequired, roleGuard("admin"), async (req, res) => {
  const stats = getTrafficStats();
  stats.totalUsers = await User.countDocuments();
  return res.json(stats);
});

// GET /api/admin/subjects - list enabled-subject configs, optionally for a school
router.get("/subjects", authRequired, roleGuard("admin"), async (req, res) => {
  const filter = {};
  if (req.query.schoolId && mongoose.isValidObjectId(req.query.schoolId)) filter.schoolId = req.query.schoolId;
  const configs = await SchoolSubjects.find(filter).sort({ createdAt: -1 });
  return res.json({ configs });
});

// PUT /api/admin/subjects - upsert the enabled-subject list for a school + semester
router.put("/subjects", authRequired, roleGuard("admin"), async (req, res) => {
  const { schoolId, semester, jhs, shs } = req.body || {};
  if (!mongoose.isValidObjectId(schoolId)) return bad(req, res, "A valid school is required.");
  if (!semester) return bad(req, res, "Semester is required.");
  const school = await School.findById(schoolId);
  if (!school) return bad(req, res, "School not found.", 404);

  const clean = (list) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.map((s) => String(s).trim()).filter((s) => s && !seen.has(s) && seen.add(s));
  };
  const jhsClean = clean(jhs);
  const shsClean = clean(shs);

  const config = await SchoolSubjects.findOneAndUpdate(
    { schoolId, semester },
    { jhs: jhsClean, shs: shsClean },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  recordEvent({
    type: "admin.subjects.update",
    action: `Enabled subjects for ${semester}`,
    actor: req.userId,
    actorEmail: req.userEmail || "",
    actorRole: "admin",
    target: school.name,
    meta: { schoolId: schoolId, school: school.name, semester, jhs: jhsClean.length, shs: shsClean.length },
    ip: getClientIp(req),
  });
  return res.json({ config });
});

// DELETE /api/admin/subjects?schoolId=X&semester=Y - remove a config (fall back to defaults)
router.delete("/subjects", authRequired, roleGuard("admin"), async (req, res) => {
  const { schoolId, semester } = req.query;
  if (!mongoose.isValidObjectId(schoolId) || !semester) return bad(req, res, "schoolId and semester are required.");
  await SchoolSubjects.findOneAndDelete({ schoolId, semester });
  const school = await School.findById(schoolId);
  recordEvent({
    type: "admin.subjects.delete",
    action: `Disabled subjects for ${semester}`,
    actor: req.userId,
    actorEmail: req.userEmail || "",
    actorRole: "admin",
    target: school?.name || schoolId,
    meta: { schoolId, semester },
    ip: getClientIp(req),
  });
  return res.json({ ok: true });
});

// GET /api/admin/subjects/options - all semesters + static subject lists for the UI
router.get("/subjects/options", authRequired, roleGuard("admin"), (req, res) => {
  return res.json({ jhs: JHS_SUBJECTS, shs: SHS_SUBJECTS, semesters: SEMESTERS });
});

export default router;
