import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Assessment from "../models/Assessment.js";
import GradeSheet from "../models/GradeSheet.js";
import { authRequired, roleGuard } from "../middleware/auth.js";
import { fullName } from "../services/excel.js";
import { computeGrade } from "../services/compute.js";
import { sendGradesSubmitted } from "../services/mailer.js";

const router = express.Router();

function toNum(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const match = (a, cls) => {
  const sameBase =
    String(a.grade) === String(cls.grade) &&
    (a.strand || "") === (cls.strand || "") &&
    String(a.section || "") === String(cls.section || "") &&
    String(a.academicYear) === String(cls.academicYear);
  const sameTvl =
    (cls.strand || "") !== "TVL" ||
    ((a.tvlStrand || "") === (cls.tvlStrand || "") && (a.specialization || "") === (cls.specialization || ""));
  return sameBase && sameTvl;
};

function assignedToClass(me, cls) {
  const isAdviser = me.role === "adviser" && (match(me, cls) || (me.advisories || []).some((a) => match(a, cls)));
  const isTeacher = (me.teachingLoad || []).some((a) => match(a, cls));
  return isAdviser || isTeacher;
}

function teachesSubject(me, cls, subject) {
  if (me.role === "adviser" && (match(me, cls) || (me.advisories || []).some((a) => match(a, cls)))) return true;
  return (me.teachingLoad || []).some((a) => match(a, cls) && a.subject === subject);
}

async function findAdviser(me, cls) {
  if (me.role === "adviser" && (match(me, cls) || (me.advisories || []).some((a) => match(a, cls)))) {
    return me;
  }
  const q = { role: "adviser", schoolId: me.schoolId, grade: cls.grade, strand: cls.strand, section: cls.section, academicYear: cls.academicYear };
  if ((cls.strand || "") === "TVL") {
    if (cls.tvlStrand) q.tvlStrand = cls.tvlStrand;
    if (cls.specialization) q.specialization = cls.specialization;
  } else if (cls.specialization) {
    q.specialization = cls.specialization;
  }
  return User.findOne(q);
}

function studentQuery(me, cls) {
  const q = { role: "student", schoolId: me.schoolId, grade: cls.grade, strand: cls.strand || "", section: cls.section, academicYear: cls.academicYear };
  if ((cls.strand || "") === "TVL") {
    if (cls.tvlStrand) q.tvlStrand = cls.tvlStrand;
    if (cls.specialization) q.specialization = cls.specialization;
  } else if (cls.specialization) {
    q.specialization = cls.specialization;
  }
  return q;
}

// GET /api/assessments/summary?grade&strand&section&ay&subject&semester
// Running totals + computed grades for a class+subject+quarter, summed from every component in the DB.
router.get("/summary", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const cls = {
    grade: String(req.query.grade || me.grade),
    strand: req.query.strand ?? me.strand ?? "",
    section: String(req.query.section || ""),
    academicYear: String(req.query.ay || me.academicYear),
    specialization: req.query.specialization ? String(req.query.specialization) : "",
    tvlStrand: req.query.tvlStrand ? String(req.query.tvlStrand) : "",
  };
  const subject = req.query.subject?.trim();
  const semester = req.query.semester?.trim();
  // scope=all aggregates every teacher's components for the class+subject+quarter (adviser advisory view);
  // the default scope=mine only counts the requesting teacher's own submissions.
  const scope = req.query.scope === "all" ? "all" : "mine";
  if (!cls.section) return res.status(400).json({ error: "Please select a section/block." });
  if (!subject || !semester) return res.status(400).json({ error: "Subject and quarter are required." });

  if (!assignedToClass(me, cls)) {
    return res.status(403).json({ error: "You are not assigned to this class." });
  }

  const match = {
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    academicYear: cls.academicYear,
    subject,
    semester,
  };
  if ((cls.strand || "") === "TVL") {
    if (cls.tvlStrand) match.tvlStrand = cls.tvlStrand;
    if (cls.specialization) match.specialization = cls.specialization;
  } else if (cls.specialization) {
    match.specialization = cls.specialization;
  }
  if (scope === "mine") match.teacherId = me._id;

  const records = await Assessment.find(match);

  const students = await User.find(studentQuery(me, cls)).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });

  const components = { ww: 0, pt: 0, qa: 0 };
  const totals = { ww: 0, wwItems: 0, pt: 0, ptItems: 0, qa: 0, qaItems: 0 };
  const byStudent = new Map();

  for (const rec of records) {
    components[rec.type] += 1;
    const recItem = Number(rec.item) > 0 ? Number(rec.item) : 0;
    totals[`${rec.type}Items`] += recItem;
    for (const sc of rec.scores || []) {
      const item = Number(sc.item) > 0 ? Number(sc.item) : recItem;
      const key = String(sc.studentId);
      const row = byStudent.get(key) || { ww: 0, wwItems: 0, pt: 0, ptItems: 0, qa: 0, qaItems: 0, wwScored: 0, ptScored: 0, qaScored: 0 };
      row[`${rec.type}Items`] += item;
      const score = toNum(sc.score);
      if (score !== null) {
        row[rec.type] += score;
        row[`${rec.type}Scored`] += 1;
        totals[rec.type] += score;
      }
      byStudent.set(key, row);
    }
  }

  const rows = students.map((s) => {
    const row = {
      id: s._id,
      firstName: s.firstName,
      middleName: s.middleName,
      lastName: s.lastName,
      gender: s.gender,
      ww: null,
      wwItems: null,
      pt: null,
      ptItems: null,
      qa: null,
      qaItems: null,
      weighted: null,
      transmuted: null,
      remark: "",
      complete: false,
    };
    const t = byStudent.get(String(s._id));
    if (t) {
      for (const f of ["ww", "pt", "qa"]) {
        row[f] = t[`${f}Scored`] > 0 ? Math.round(t[f] * 100) / 100 : null;
        row[`${f}Items`] = t[`${f}Items`] || 0;
      }
      const result = computeGrade({
        ww: row.ww,
        pt: row.pt,
        qa: row.qa,
        items: { ww: row.wwItems, pt: row.ptItems, qa: row.qaItems },
      });
      row.weighted = result.weighted;
      row.transmuted = result.transmuted;
      row.remark = result.remark;
      row.complete = result.complete;
    }
    return row;
  });

  return res.json({ components, totals, students: rows });
});

// POST /api/assessments/submit - generate a grade sheet from the teacher's recorded WW / PT / QA
// components for a class+subject+quarter and route it to the adviser with the full component
// breakdown, so the adviser and (after publishing) students can see how every grade was computed.
// Shared engine for POST /submit and POST /submit-bulk: computes every student's grade
// from the teacher's recorded WW / PT / QA components for one teaching assignment and
// routes the sheet to the class adviser. Students with missing scores (absences) are
// included in the sheet and flagged incomplete (grade null) instead of blocking it.
async function buildAndRouteSheet(me, cls, subject, semester, notes = "") {
  if (!cls.section) return { ok: false, status: 400, error: "Please select a section/block." };
  if (!subject || !semester) return { ok: false, status: 400, error: "Subject and quarter are required." };

  if (!assignedToClass(me, cls)) {
    return { ok: false, status: 403, error: "You are not assigned to this class." };
  }
  if (!teachesSubject(me, cls, subject)) {
    return { ok: false, status: 403, error: `You do not teach ${subject} in this class.` };
  }

  const adviser = await findAdviser(me, cls);
  if (!adviser) {
    return { ok: false, status: 400, error: `No adviser found for Grade ${cls.grade}${cls.strand ? " - " + cls.strand : ""}${cls.tvlStrand ? " · " + cls.tvlStrand : ""}${cls.specialization ? ` (${cls.specialization})` : ""} - ${cls.section} (${cls.academicYear}).` };
  }

  const records = await Assessment.find({
    teacherId: me._id,
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    academicYear: cls.academicYear,
    subject,
    semester,
    ...((cls.strand || "") === "TVL"
      ? { ...(cls.tvlStrand ? { tvlStrand: cls.tvlStrand } : {}), ...(cls.specialization ? { specialization: cls.specialization } : {}) }
      : cls.specialization ? { specialization: cls.specialization } : {}),
  }).sort({ type: 1, createdAt: 1, label: 1 });

  const students = await User.find(studentQuery(me, cls)).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });

  const totals = new Map();
  for (const rec of records) {
    const recItem = Number(rec.item) > 0 ? Number(rec.item) : 0;
    for (const sc of rec.scores || []) {
      const item = Number(sc.item) > 0 ? Number(sc.item) : recItem;
      const key = String(sc.studentId);
      const row = totals.get(key) || { ww: 0, wwItems: 0, wwScored: 0, pt: 0, ptItems: 0, ptScored: 0, qa: 0, qaItems: 0, qaScored: 0 };
      row[`${rec.type}Items`] += item;
      const score = toNum(sc.score);
      if (score !== null) {
        row[rec.type] += score;
        row[`${rec.type}Scored`] += 1;
      }
      totals.set(key, row);
    }
  }

  const breakdown = records.map((rec) => ({
    type: rec.type,
    label: rec.label,
    item: Number(rec.item) > 0 ? Number(rec.item) : 0,
    scores: (rec.scores || []).map((sc) => ({
      studentId: sc.studentId,
      score: toNum(sc.score),
      item: toNum(sc.item),
    })),
  }));

  const entries = [];
  let complete = 0;
  for (const s of students) {
    const t = totals.get(String(s._id));
    const rowItems = { ww: t?.wwItems || 0, pt: t?.ptItems || 0, qa: t?.qaItems || 0 };
    const result = computeGrade({
      ww: t && t.wwScored > 0 ? Math.round(t.ww * 100) / 100 : null,
      pt: t && t.ptScored > 0 ? Math.round(t.pt * 100) / 100 : null,
      qa: t && t.qaScored > 0 ? Math.round(t.qa * 100) / 100 : null,
      items: rowItems,
    });
    entries.push({
      studentId: s._id,
      firstName: s.firstName,
      middleName: s.middleName,
      lastName: s.lastName,
      gender: s.gender,
      grade: result.complete ? result.transmuted : null,
      incomplete: !result.complete,
      ww: t ? Math.round(t.ww * 100) / 100 : null,
      pt: t ? Math.round(t.pt * 100) / 100 : null,
      qa: t ? Math.round(t.qa * 100) / 100 : null,
      wwItems: rowItems.ww,
      ptItems: rowItems.pt,
      qaItems: rowItems.qa,
    });
    if (result.complete) complete += 1;
  }

  const q = {
    teacherId: me._id,
    subject,
    semester,
    academicYear: cls.academicYear,
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    ...((cls.strand || "") === "TVL"
      ? { ...(cls.tvlStrand ? { tvlStrand: cls.tvlStrand } : {}), ...(cls.specialization ? { specialization: cls.specialization } : {}) }
      : cls.specialization ? { specialization: cls.specialization } : {}),
  };
  const existing = await GradeSheet.findOne(q);
  if (existing && existing.status === "published") {
    return { ok: false, status: 409, error: `Grades for ${subject} (${semester}) on this class were already sent to students. Unsend them first if you need to regenerate.` };
  }

  const doc = {
    teacherId: me._id,
    teacherName: fullName(me),
    adviserId: adviser._id,
    adviserName: fullName(adviser),
    subject,
    semester,
    academicYear: cls.academicYear,
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    specialization: cls.specialization || "",
    tvlStrand: cls.tvlStrand || "",
    entries,
    breakdown,
    status: "submitted",
    notes: notes || "",
    publishedAt: null,
  };

  let sheet;
  if (existing) {
    Object.assign(existing, doc);
    sheet = await existing.save();
  } else {
    sheet = await GradeSheet.create(doc);
  }

  const emailStudents = students.filter((s) => s.email);
  for (const st of emailStudents) {
    sendGradesSubmitted(st.email, {
      firstName: st.firstName,
      subject,
      semester,
      academicYear: cls.academicYear,
      gradeLevel: cls.grade,
      strand: cls.strand,
      section: cls.section,
      teacherName: fullName(me),
      adviserName: fullName(adviser),
    }).catch(() => {});
  }

  const incomplete = entries.length - complete;
  return {
    ok: true,
    label: `${subject} · Grade ${cls.grade}${cls.strand ? " - " + cls.strand : ""} - ${cls.section}`,
    sheetId: sheet._id,
    message: `Grades for ${subject} generated from your ${records.length} component${records.length === 1 ? "" : "s"} and routed to ${fullName(adviser)}'s review — ${complete} student${complete === 1 ? "" : "s"} complete, ${incomplete} incomplete/absent flagged. The full WW / PT / QA breakdown is included.`,
    computed: complete,
    incomplete,
    components: records.length,
  };
}

router.post("/submit", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const cls = {
    grade: String(req.body.grade || me.grade),
    strand: req.body.strand ?? me.strand ?? "",
    section: String(req.body.section || ""),
    academicYear: String(req.body.academicYear || me.academicYear),
    specialization: req.body.specialization ? String(req.body.specialization) : "",
    tvlStrand: req.body.tvlStrand ? String(req.body.tvlStrand) : "",
  };
  const result = await buildAndRouteSheet(me, cls, req.body.subject?.trim(), req.body.semester?.trim(), req.body.notes || "");
  if (!result.ok) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  return res.status(201).json({
    message: result.message,
    sheetId: result.sheetId,
    computed: result.computed,
    incomplete: result.incomplete,
    components: result.components,
  });
});

// POST /api/assessments/submit-bulk - generate & route grades for several teaching loads at once
router.post("/submit-bulk", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const items = Array.isArray(req.body.assignments) ? req.body.assignments : [];
  if (items.length === 0) {
    return res.status(400).json({ error: "Select at least one teaching load to generate grades for." });
  }

  const results = [];
  for (const item of items) {
    const cls = {
      grade: String(item.grade || me.grade),
      strand: item.strand ?? me.strand ?? "",
      section: String(item.section || ""),
      academicYear: String(item.academicYear || me.academicYear),
      specialization: item.specialization ? String(item.specialization) : "",
      tvlStrand: item.tvlStrand ? String(item.tvlStrand) : "",
    };
    const subject = String(item.subject || "").trim();
    const semester = String(item.semester || "").trim();
    const result = await buildAndRouteSheet(me, cls, subject, semester, item.notes || "");
    if (result.ok) {
      results.push({
        ok: true,
        label: result.label,
        message: result.message,
        sheetId: result.sheetId,
        computed: result.computed,
        incomplete: result.incomplete,
        components: result.components,
      });
    } else {
      results.push({
        ok: false,
        label: subject ? `${subject} · Grade ${cls.grade}${cls.strand ? " - " + cls.strand : ""} - ${cls.section || "?"}` : "Teaching load",
        error: result.error,
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return res.json({
    message: `Generated grades for ${okCount} of ${results.length} teaching load${results.length === 1 ? "" : "s"}.`,
    results,
  });
});

// GET /api/assessments/subjects?grade&strand&section&ay&semester
// Subjects available for the class+quarter on the Classes tab: the teaching assignments for
// that class+quarter (so a subject shows up even before any component is recorded), unioned
// with any subjects that already have assessment components recorded for the class+quarter.
// scope=all aggregates every teacher's subjects (adviser advisory view); the default scope=mine
// only lists the requesting teacher's own subjects.
router.get("/subjects", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const cls = {
    grade: String(req.query.grade || me.grade),
    strand: req.query.strand ?? me.strand ?? "",
    section: String(req.query.section || ""),
    academicYear: String(req.query.ay || me.academicYear),
    specialization: req.query.specialization ? String(req.query.specialization) : "",
    tvlStrand: req.query.tvlStrand ? String(req.query.tvlStrand) : "",
  };
  const semester = req.query.semester?.trim();
  const scope = req.query.scope === "all" ? "all" : "mine";
  if (!cls.section) return res.status(400).json({ error: "Please select a section/block." });
  if (!semester) return res.status(400).json({ error: "Quarter is required." });

  if (!assignedToClass(me, cls)) {
    return res.status(403).json({ error: "You are not assigned to this class." });
  }

  const out = new Map();
  const addSubject = (subject, fromAssignment) => {
    if (!subject) return;
    const existing = out.get(subject);
    if (existing) {
      if (fromAssignment) existing.fromAssignment = true;
      return;
    }
    out.set(subject, { subject, components: { ww: 0, pt: 0, qa: 0 }, fromAssignment: Boolean(fromAssignment) });
  };

  if (scope === "mine") {
    for (const a of me.teachingLoad || []) {
      if (match(a, cls) && a.semester === semester) addSubject(a.subject, true);
    }
  } else {
    const holders = await User.find({
      schoolId: me.schoolId,
      $or: [{ role: "teacher" }, { role: "adviser", teachingLoad: { $ne: [] } }],
    });
    for (const h of holders) {
      for (const a of h.teachingLoad || []) {
        if (match(a, cls) && a.semester === semester) addSubject(a.subject, true);
      }
    }
  }

  const query = {
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    academicYear: cls.academicYear,
    semester,
  };
  if (scope === "mine") query.teacherId = me._id;

  const rows = await Assessment.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$subject",
        ww: { $sum: { $cond: [{ $eq: ["$type", "ww"] }, 1, 0] } },
        pt: { $sum: { $cond: [{ $eq: ["$type", "pt"] }, 1, 0] } },
        qa: { $sum: { $cond: [{ $eq: ["$type", "qa"] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  for (const r of rows) {
    addSubject(r._id, false);
    const entry = out.get(r._id);
    entry.components = { ww: r.ww, pt: r.pt, qa: r.qa };
  }

  const subjects = [...out.values()].sort((a, b) => a.subject.localeCompare(b.subject));
  return res.json({ subjects });
});

// GET /api/assessments?grade&strand&section&ay&subject&semester - assessment components for a class+subject
// semester is optional: omit it to return components across every quarter for the teaching assignment.
router.get("/", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const cls = {
    grade: String(req.query.grade || me.grade),
    strand: req.query.strand ?? me.strand ?? "",
    section: String(req.query.section || ""),
    academicYear: String(req.query.ay || me.academicYear),
    specialization: req.query.specialization ? String(req.query.specialization) : "",
    tvlStrand: req.query.tvlStrand ? String(req.query.tvlStrand) : "",
  };
  const subject = req.query.subject?.trim();
  const semester = req.query.semester?.trim();
  if (!cls.section) return res.status(400).json({ error: "Please select a section/block." });
  if (!subject) return res.status(400).json({ error: "Subject is required." });

  if (!assignedToClass(me, cls)) {
    return res.status(403).json({ error: "You are not assigned to this class." });
  }

  const query = {
    teacherId: me._id,
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    academicYear: cls.academicYear,
    subject,
  };
  if (semester) query.semester = semester;
  if (cls.specialization) query.specialization = cls.specialization;

  const records = await Assessment.find(query).sort({ semester: 1, type: 1, label: 1 }).lean();

  const students = await User.find(studentQuery(me, cls)).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });
  const meta = new Map(students.map((s) => [String(s._id), s]));
  for (const rec of records) {
    const scores = rec.scores || [];
    for (const sc of scores) {
      const st = meta.get(String(sc.studentId));
      if (st) {
        sc.gender = st.gender;
        sc.firstName = st.firstName;
        sc.middleName = st.middleName;
        sc.lastName = st.lastName;
      }
    }
    scores.sort(
      (a, b) =>
        (a.gender === "Male" ? 0 : a.gender === "Female" ? 1 : 2) - (b.gender === "Male" ? 0 : b.gender === "Female" ? 1 : 2) ||
        String(a.lastName || "").localeCompare(String(b.lastName || "")) ||
        String(a.firstName || "").localeCompare(String(b.firstName || "")) ||
        String(a.middleName || "").localeCompare(String(b.middleName || ""))
    );
    rec.scores = scores;
  }

  return res.json({ assessments: records });
});

// POST /api/assessments - create a component and pre-fill the roster
router.post("/", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const { grade, strand, section, academicYear, subject, semester, type, label, item, specialization, tvlStrand } = req.body;
  if (!section || !subject || !semester || !academicYear || !type || !label) {
    return res.status(400).json({ error: "Class, subject, quarter, academic year, type and label are required." });
  }
  const cls = { grade: String(grade), strand: strand || "", section, academicYear, specialization: specialization || "", tvlStrand: tvlStrand || "" };
  if (!assignedToClass(me, cls)) return res.status(403).json({ error: "You are not assigned to this class." });
  if (!teachesSubject(me, cls, subject)) {
    return res.status(403).json({ error: `You do not teach ${subject} in this class.` });
  }

  const designated = await User.findOne({
    schoolId: me.schoolId,
    $or: [
      { role: "teacher", grade: cls.grade, strand: cls.strand, section: String(cls.section), subject: String(subject).trim(), semester, academicYear: String(cls.academicYear) },
      { role: { $in: ["teacher", "adviser"] }, teachingLoad: { $elemMatch: { grade: cls.grade, strand: cls.strand, section: String(cls.section), subject: String(subject).trim(), semester, academicYear: String(cls.academicYear) } } },
    ],
  });
  if (designated && String(designated._id) !== String(me._id)) {
    return res.status(403).json({ error: `${fullName(designated)} is the designated ${subject} teacher for this class — only they can record assessment components for it.` });
  }

  const adviser = await findAdviser(me, cls);
  if (!adviser) {
    return res.status(400).json({ error: `No adviser found for Grade ${grade}${strand ? " - " + strand : ""} - ${section} (${academicYear}).` });
  }

  const itemTotal = Number(item) > 0 ? Number(item) : 20;

  const students = await User.find(studentQuery(me, cls)).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });

  const clientId = req.body._id && mongoose.isValidObjectId(req.body._id) ? String(req.body._id) : null;
  if (clientId) {
    const existing = await Assessment.findOne({ _id: clientId, teacherId: me._id });
    if (existing) {
      return res.status(200).json({ message: `${existing.label} is already recorded for this class.`, assessment: existing });
    }
  }

  const record = await Assessment.create({
    ...(clientId ? { _id: clientId } : {}),
    teacherId: me._id,
    teacherName: fullName(me),
    adviserId: adviser._id,
    subject: String(subject).trim(),
    semester,
    academicYear,
    gradeLevel: cls.grade,
    strand: cls.strand,
    section: cls.section,
    specialization: cls.specialization || "",
    tvlStrand: cls.tvlStrand || "",
    type,
    label: String(label).trim(),
    title: String(subject).trim(),
    item: itemTotal,
    scores: students.map((s) => ({
      studentId: s._id,
      firstName: s.firstName,
      middleName: s.middleName,
      lastName: s.lastName,
      gender: s.gender,
      score: null,
      item: null,
    })),
  });

  return res.status(201).json({ message: `${record.label} added for ${students.length} student(s).`, assessment: record });
});

// PUT /api/assessments/:id - update label/title/item and per-student scores
router.put("/:id", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const record = await Assessment.findById(req.params.id);
  if (!record) return res.status(404).json({ error: "Assessment component not found." });
  if (String(record.teacherId) !== String(me._id)) {
    return res.status(403).json({ error: "You can only edit assessment components you created." });
  }

  const { label, item, scores } = req.body;
  if (label !== undefined && String(label).trim()) record.label = String(label).trim();
  record.title = record.subject;
  if (item !== undefined && Number(item) > 0) record.item = Number(item);

  if (Array.isArray(scores)) {
    const maxItem = Number(record.item) > 0 ? Number(record.item) : null;
    for (const upd of scores) {
      if (upd.score === null || upd.score === undefined || upd.score === "") continue;
      const v = Number(upd.score);
      if (maxItem && Number.isFinite(v) && v > maxItem) {
        return res.status(400).json({ error: `A score of ${v} exceeds the ${maxItem}-item total for ${record.label}.` });
      }
    }
    record.scores = record.scores.map((old) => {
      const upd = scores.find((s) => s.studentId && String(s.studentId) === String(old.studentId));
      if (!upd) return old;
      return {
        studentId: old.studentId,
        firstName: old.firstName,
        middleName: old.middleName,
        lastName: old.lastName,
        gender: old.gender,
        score: upd.score === null || upd.score === undefined || upd.score === "" ? null : Number(upd.score),
        item: upd.item === null || upd.item === undefined || upd.item === "" ? null : Number(upd.item),
      };
    });
  }

  await record.save();
  return res.json({ message: `${record.label} saved.`, assessment: record });
});

// POST /api/assessments/:id/answer-key — save the correct answers for OMR scanning
router.post("/:id/answer-key", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const record = await Assessment.findById(req.params.id);
  if (!record) return res.status(404).json({ error: "Assessment component not found." });
  if (String(record.teacherId) !== String(me._id)) {
    return res.status(403).json({ error: "You can only edit assessment components you created." });
  }
  const { answerKey } = req.body;
  if (!Array.isArray(answerKey) || answerKey.length !== record.item) {
    return res.status(400).json({ error: `Answer key must have exactly ${record.item} entries (one per item).` });
  }
  const valid = ["A", "B", "C", "D", "E"];
  for (let i = 0; i < answerKey.length; i++) {
    if (!valid.includes(answerKey[i])) {
      return res.status(400).json({ error: `Item ${i + 1}: "${answerKey[i]}" is not valid. Use A, B, C, D, or E.` });
    }
  }
  record.answerKey = answerKey;
  await record.save();
  return res.json({ message: "Answer key saved.", assessment: record });
});

// DELETE /api/assessments/:id
router.delete("/:id", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid assessment." });
  const record = await Assessment.findById(req.params.id);
  if (!record) return res.json({ ok: true, message: "Assessment already removed." });
  if (String(record.teacherId) !== String(me._id)) {
    return res.status(403).json({ error: "You can only delete assessment components you created." });
  }
  await record.deleteOne();
  return res.json({ ok: true, message: `${record.label} deleted.` });
});

export default router;
