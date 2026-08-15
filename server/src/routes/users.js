import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { authRequired, roleGuard } from "../middleware/auth.js";
import { fullName } from "../services/excel.js";
import { validateClassEntry, validateTeachingEntry, advisoryTaken, assignmentTaken, normalizeClassEntry } from "../services/classes.js";

const router = express.Router();

function brief(u) {
  return {
    id: u._id,
    role: u.role,
    fullName: fullName(u),
    firstName: u.firstName,
    middleName: u.middleName,
    lastName: u.lastName,
    email: u.email,
    grade: u.grade,
    strand: u.strand,
    tvlStrand: u.tvlStrand || "",
    specialization: u.specialization || "",
    section: u.section,
    subject: u.subject,
    semester: u.semester,
    academicYear: u.academicYear,
    gender: u.gender,
  };
}

// GET /api/users/advisers - all advisers (for teachers to message / submit to)
router.get("/advisers", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const advisers = await User.find({ role: "adviser", schoolId: me.schoolId }).sort({ grade: 1, section: 1, lastName: 1 });
  return res.json({ advisers: advisers.map(brief) });
});

// GET /api/users/teachers - all teachers grouped by subject (for adviser dashboard)
router.get("/teachers", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const teachers = await User.find({
    schoolId: me.schoolId,
    $or: [{ role: "teacher" }, { role: "adviser", teachingLoad: { $ne: [] } }],
  }).sort({ lastName: 1 });
  const grouped = {};
  const list = [];
  const pushBrief = (t, subject, semester) => {
    list.push({ ...brief(t), subject, semester });
    (grouped[subject || "General"] ||= []).push({ id: t._id, fullName: fullName(t), subject, semester });
  };
  for (const t of teachers) {
    if (t.role === "teacher") {
      pushBrief(t, t.subject || "General", t.semester || "");
    } else {
      for (const a of t.teachingLoad || []) pushBrief(t, a.subject, a.semester);
    }
  }
  return res.json({ teachers: list, grouped });
});

// GET /api/users/students - students in the adviser's advisory
router.get("/students", authRequired, roleGuard("adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  if (!me) return res.status(404).json({ error: "Account not found" });
  const filter = {
    role: "student",
    schoolId: me.schoolId,
    grade: me.grade,
    strand: me.strand,
    section: me.section,
    academicYear: me.academicYear,
  };
  if (me.strand === "TVL") {
    if (me.tvlStrand) filter.tvlStrand = me.tvlStrand;
    if (me.specialization) filter.specialization = me.specialization;
  } else if (me.specialization) {
    filter.specialization = me.specialization;
  }
  const students = await User.find(filter).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });
  const boys = students.filter((s) => s.gender === "Male");
  const girls = students.filter((s) => s.gender === "Female");
  return res.json({ students: students.map(brief), boys: boys.map(brief), girls: girls.map(brief) });
});

// GET /api/users/me/classes - the account's advisories + subject-teaching classes
router.get("/me/classes", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const load = async (a) => {
    const adviser = await User.findOne({
      role: "adviser", schoolId: me.schoolId,
      grade: a.grade, strand: a.strand || "", section: a.section, academicYear: a.academicYear,
      ...(a.strand === "TVL" ? { tvlStrand: a.tvlStrand || "", specialization: a.specialization || "" } : {}),
    });
    return { id: a._id, ...a.toObject(), adviserName: adviser ? fullName(adviser) : "" };
  };
  const advisories = (me.advisories || []).map((a) => {
    const primary =
      a.grade === me.grade && (a.strand || "") === (me.strand || "") && a.section === me.section && a.academicYear === me.academicYear &&
      ((a.strand || "") !== "TVL" || ((a.tvlStrand || "") === (me.tvlStrand || "") && (a.specialization || "") === (me.specialization || "")));
    return { id: a._id, ...a.toObject(), primary };
  });
  const teachingLoad = await Promise.all((me.teachingLoad || []).map(load));
  return res.json({ advisories, teachingLoad });
});

// POST /api/users/me/classes - add a subject-teaching class (adviser or teacher)
router.post("/me/classes", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const me = await User.findById(req.userId);
  const entry = normalizeClassEntry(req.body);
  entry.subject = String(req.body.subject || "").trim();
  entry.semester = String(req.body.semester || "").trim();
  entry.tvlStrand = String(req.body.tvlStrand || "").trim();
  entry.specialization = String(req.body.specialization || "").trim();
  const errors = validateTeachingEntry(entry);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const ownDup = (me.teachingLoad || []).some((a) =>
    a.subject === entry.subject && a.semester === entry.semester && a.academicYear === entry.academicYear &&
    a.grade === entry.grade && (a.strand || "") === entry.strand && a.section === entry.section &&
    (a.tvlStrand || "") === entry.tvlStrand && (a.specialization || "") === entry.specialization
  );
  if (ownDup) return res.status(409).json({ error: `You are already teaching ${entry.subject} for this class.` });
  if (await assignmentTaken(me.schoolId, entry)) {
    return res.status(409).json({ error: `Another account already teaches ${entry.subject} for this class.` });
  }

  me.teachingLoad.push(entry);
  await me.save();
  const adviser = await User.findOne({
    role: "adviser", schoolId: me.schoolId,
    grade: entry.grade, strand: entry.strand, section: entry.section, academicYear: entry.academicYear,
    ...(entry.strand === "TVL" ? { tvlStrand: entry.tvlStrand || "", specialization: entry.specialization || "" } : {}),
  });
  return res.status(201).json({
    message: `${entry.subject} (Grade ${entry.grade}${entry.strand ? " - " + entry.strand : ""}${entry.tvlStrand ? " · " + entry.tvlStrand : ""}${entry.specialization ? " - " + entry.specialization : ""} - ${entry.section}) added to your teaching load.`,
    assignment: { id: me.teachingLoad[me.teachingLoad.length - 1]._id, ...entry, adviserName: adviser ? fullName(adviser) : "" },
  });
});

// DELETE /api/users/me/classes - remove multiple subject-teaching classes in one call
router.delete("/me/classes", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) return res.status(400).json({ error: "No teaching assignments selected." });
  const invalid = ids.find((id) => !mongoose.isValidObjectId(id));
  if (invalid) return res.status(400).json({ error: "Invalid assignment." });
  const me = await User.findById(req.userId);
  const set = new Set(ids.map((id) => String(id)));
  const before = (me.teachingLoad || []).length;
  me.teachingLoad = (me.teachingLoad || []).filter((a) => !set.has(String(a._id)));
  const removed = before - me.teachingLoad.length;
  if (removed === 0) return res.status(404).json({ error: "No matching teaching assignments found." });
  await me.save();
  return res.json({ message: `${removed} teaching assignment${removed === 1 ? "" : "s"} removed from your load.`, removed });
});

// DELETE /api/users/me/classes/:id - remove a subject-teaching class
router.delete("/me/classes/:id", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid assignment." });
  const me = await User.findById(req.userId);
  const idx = (me.teachingLoad || []).findIndex((a) => String(a._id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Teaching assignment not found." });
  me.teachingLoad.splice(idx, 1);
  await me.save();
  return res.json({ message: "Teaching assignment removed from your load." });
});

// POST /api/users/me/advisories - adviser adds another advisory class
router.post("/me/advisories", authRequired, roleGuard("adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const entry = normalizeClassEntry(req.body);
  const errors = validateClassEntry(entry);
  if (errors.length) return res.status(400).json({ error: errors.join(" ") });

  const ownDup = (me.advisories || []).some((a) =>
    a.academicYear === entry.academicYear && a.grade === entry.grade && (a.strand || "") === entry.strand && a.section === entry.section &&
    ((entry.strand || "") !== "TVL" || ((a.tvlStrand || "") === entry.tvlStrand && (a.specialization || "") === entry.specialization))
  );
  if (ownDup) return res.status(409).json({ error: "You are already the adviser of this class." });
  if (await advisoryTaken(me.schoolId, entry.academicYear, entry)) {
    return res.status(409).json({ error: `Another adviser already handles Grade ${entry.grade}${entry.strand ? " - " + entry.strand : ""}${entry.tvlStrand ? " (" + entry.tvlStrand + ")" : ""}${entry.specialization ? " - " + entry.specialization : ""} - ${entry.section} (S.Y. ${entry.academicYear}).` });
  }

  me.advisories.push(entry);
  await me.save();
  return res.status(201).json({
    message: `Grade ${entry.grade}${entry.strand ? " - " + entry.strand : ""}${entry.tvlStrand ? " (" + entry.tvlStrand + ")" : ""}${entry.specialization ? " - " + entry.specialization : ""} - ${entry.section} (S.Y. ${entry.academicYear}) added to your advisories.`,
    advisory: { id: me.advisories[me.advisories.length - 1]._id, ...entry },
  });
});

// DELETE /api/users/me/advisories/:id - adviser removes an advisory class (primary stays)
router.delete("/me/advisories/:id", authRequired, roleGuard("adviser"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid advisory." });
  const me = await User.findById(req.userId);
  const entry = (me.advisories || []).find((a) => String(a._id) === String(req.params.id));
  if (!entry) return res.status(404).json({ error: "Advisory not found." });
  if (entry.grade === me.grade && (entry.strand || "") === (me.strand || "") && entry.section === me.section && entry.academicYear === me.academicYear &&
    ((entry.strand || "") !== "TVL" || ((entry.tvlStrand || "") === (me.tvlStrand || "") && (entry.specialization || "") === (me.specialization || "")))) {
    return res.status(400).json({ error: "Your primary advisory cannot be removed here. Ask an admin to reassign it." });
  }
  me.advisories.pull(entry._id);
  await me.save();
  return res.json({ message: "Advisory class removed." });
});

// GET /api/users/school-structure - every advisory + teaching load, grouped by grade/strand/block/spec/subject/ay,
// with per-advisory student counts. Used by the teacher dashboard to show the whole school at a glance.
router.get("/school-structure", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const advisers = await User.find({ role: "adviser", schoolId: me.schoolId }).lean();
  const teachers = await User.find({ schoolId: me.schoolId, $or: [{ role: "teacher" }, { role: "adviser", teachingLoad: { $ne: [] } }] }).lean();
  const students = await User.find({ role: "student", schoolId: me.schoolId }).lean();

  const rosterKey = (s) =>
    `${s.grade}|${s.strand || ""}|${s.section || ""}|${s.academicYear}|${s.specialization || ""}|${s.tvlStrand || ""}`;

  const rosters = new Map();
  for (const s of students) {
    const k = rosterKey(s);
    const r = rosters.get(k) || { total: 0, boys: 0, girls: 0 };
    r.total++;
    if (s.gender === "Male") r.boys++;
    else if (s.gender === "Female") r.girls++;
    rosters.set(k, r);
  }

  const advisories = [];
  const seenAdvisory = new Set();
  const addAdvisory = (adv, a) => {
    const spec = a.specialization || adv.specialization || "";
    const tvl = a.tvlStrand || adv.tvlStrand || "";
    const k = `${a.grade}|${a.strand || ""}|${a.section || ""}|${a.academicYear}|${spec}|${tvl}`;
    if (seenAdvisory.has(k)) return;
    seenAdvisory.add(k);
    const r = rosters.get(k) || { total: 0, boys: 0, girls: 0 };
    advisories.push({
      grade: a.grade,
      strand: a.strand || "",
      section: a.section,
      academicYear: a.academicYear,
      specialization: spec,
      tvlStrand: tvl,
      adviserId: adv._id,
      adviserName: fullName(adv),
      total: r.total,
      boys: r.boys,
      girls: r.girls,
    });
  };

  for (const adv of advisers) {
    if (adv.grade !== "N/A" && adv.section) addAdvisory(adv, adv);
    for (const a of adv.advisories || []) addAdvisory(adv, a);
  }

  const loads = [];
  const seenLoad = new Set();
  for (const t of teachers) {
    for (const a of t.teachingLoad || []) {
      const spec = a.specialization || "";
      const tvl = a.tvlStrand || "";
      const k = `${a.grade}|${a.strand || ""}|${a.section || ""}|${a.academicYear}|${spec}|${tvl}|${a.subject}|${a.semester}`;
      if (seenLoad.has(k)) continue;
      seenLoad.add(k);
      loads.push({
        grade: a.grade,
        strand: a.strand || "",
        section: a.section,
        academicYear: a.academicYear,
        specialization: spec,
        tvlStrand: tvl,
        subject: a.subject,
        semester: a.semester,
        teacherId: t._id,
        teacherName: fullName(t),
      });
    }
  }

  advisories.sort((a, b) => String(a.grade).localeCompare(String(b.grade), undefined, { numeric: true }) || a.strand.localeCompare(b.strand) || String(a.section).localeCompare(String(b.section), undefined, { numeric: true }) || a.academicYear.localeCompare(b.academicYear) || a.specialization.localeCompare(b.specialization));
  loads.sort((a, b) => String(a.grade).localeCompare(String(b.grade), undefined, { numeric: true }) || a.strand.localeCompare(b.strand) || String(a.section).localeCompare(String(b.section), undefined, { numeric: true }) || a.academicYear.localeCompare(b.academicYear) || a.subject.localeCompare(b.subject));

  return res.json({ advisories, loads });
});

// GET /api/users/class-blocks?grade&strand&tvlStrand&specialization&ay -> the section/block dropdown options
// for the add-advisory and add-teaching forms. For TVL classes, blocks are filtered by specialization so a
// teacher/adviser only sees blocks that actually have students enrolled in that specialization.
router.get("/class-blocks", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const grade = String(req.query.grade || "");
  const strand = String(req.query.strand || "");
  const tvlStrand = String(req.query.tvlStrand || "");
  const specialization = String(req.query.specialization || "");
  const ay = String(req.query.ay || "");

  const q = { role: "student", schoolId: me.schoolId };
  if (grade) q.grade = grade;
  if (strand) q.strand = strand;
  if (tvlStrand) q.tvlStrand = tvlStrand;
  if (specialization) q.specialization = specialization;
  if (ay) q.academicYear = ay;

  const students = await User.find(q).select("section").lean();
  const blocks = [...new Set(students.map((s) => s.section).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  return res.json({ grade, strand, tvlStrand, specialization, ay, blocks });
});

// GET /api/users/:id/public-key - recipient public key for E2E messaging
router.get("/:id/public-key", authRequired, roleGuard("adviser", "teacher"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid user." });
  const user = await User.findById(req.params.id).select("publicKey role fullName firstName lastName");
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json({ publicKey: user.publicKey, role: user.role });
});

export default router;
