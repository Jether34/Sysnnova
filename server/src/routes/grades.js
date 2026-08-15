import express from "express";
import multer from "multer";
import User from "../models/User.js";
import School from "../models/School.js";
import GradeSheet from "../models/GradeSheet.js";
import { authRequired, roleGuard } from "../middleware/auth.js";
import { GRADE_LEVELS, STRANDS, BLOCKS, SEMESTERS, isShsGrade, subjectsFor, TVL_STRANDS, TVL_SPECIALIZATIONS } from "../config/index.js";
import { buildTemplate, parseSubmission, fullName } from "../services/excel.js";
import { sendGradesPublished } from "../services/mailer.js";
import { computeGrade } from "../services/compute.js";
import { buildReportCardsWorkbook, buildStudentReportCardWorkbook, reportCardFileName } from "../services/reportcards.js";
import { buildGradeSheetPdf } from "../services/gradepdf.js";
import { getClientIp } from "../services/verify.js";
import { recordEvent } from "../services/events.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function normalizeName(n = "") {
  return n.toLowerCase().replace(/\s+/g, "").trim();
}

// The extra class-identity fields that must match for TVL classes, so each specialization owns
// its own blocks 1-20. Returns {} for non-TVL classes.
function tvlIdentity({ strand, tvlStrand, specialization }) {
  if ((strand || "") !== "TVL") return {};
  const q = {};
  if (tvlStrand) q.tvlStrand = String(tvlStrand);
  if (specialization) q.specialization = String(specialization);
  return q;
}

function tvlLabel(strand, tvlStrand, specialization) {
  if ((strand || "") !== "TVL") return "";
  const parts = [];
  if (tvlStrand) parts.push(tvlStrand);
  if (specialization) parts.push(specialization);
  return parts.length ? ` (${parts.join(" · ")})` : "";
}

function matchAdviserName(fileName, adviser) {
  if (!fileName) return true;
  const a = normalizeName(fileName);
  const b = normalizeName(fullName(adviser));
  return a === b;
}

// Field-accuracy check: grade level, strand (SHS), TVL track + specialization, section/block,
// academic year, subject and semester must all be valid and consistent before a submission is accepted.
function validateSubmissionContext({ grade, strand, tvlStrand, specialization, section, academicYear, subject, semester }) {
  const errors = [];
  if (!grade) errors.push("Grade level is missing.");
  else if (!GRADE_LEVELS.includes(String(grade))) errors.push(`"${grade}" is not a valid grade level (${GRADE_LEVELS.join(", ")}).`);

  if (isShsGrade(grade)) {
    if (!strand) errors.push(`Strand is required for SHS Grade ${grade}.`);
    else if (!STRANDS.includes(strand)) errors.push(`"${strand}" is not a valid SHS strand (${STRANDS.join(", ")}).`);
    if (strand === "TVL") {
      if (!tvlStrand) errors.push("TVL Track is required for the TVL strand.");
      else if (!TVL_STRANDS.includes(tvlStrand)) errors.push(`"${tvlStrand}" is not a valid TVL track (${TVL_STRANDS.join(", ")}).`);
      if (!specialization) errors.push("Specialization is required for the TVL strand.");
      else if (tvlStrand && TVL_SPECIALIZATIONS[tvlStrand] && !TVL_SPECIALIZATIONS[tvlStrand].includes(specialization)) {
        errors.push(`"${specialization}" is not a valid specialization for ${tvlStrand}.`);
      }
    }
  }

  if (!section) errors.push("Section/Block is missing.");
  else if (!BLOCKS.includes(String(section))) errors.push(`"${section}" is not a valid section/block (Blocks ${BLOCKS[0]}-${BLOCKS[BLOCKS.length - 1]}).`);

  if (!academicYear) errors.push("Academic year is missing.");

  if (!subject) errors.push("Subject is missing.");
  else if (grade && !subjectsFor(grade).includes(subject)) errors.push(`"${subject}" is not offered for Grade ${grade}.`);

  if (!semester) errors.push("Semester is missing.");
  else if (!SEMESTERS.includes(semester)) errors.push(`"${semester}" is not a valid semester/quarter.`);

  return errors;
}

function classEquals(a, { grade, strand, tvlStrand, specialization, section, academicYear }) {
  const sameBase =
    String(a.grade || "") === String(grade || "") &&
    (a.strand || "") === (strand || "") &&
    String(a.section || "") === String(section || "") &&
    String(a.academicYear || "") === String(academicYear || "");
  const sameTvl =
    (a.strand || "") !== "TVL" ||
    ((a.tvlStrand || "") === (tvlStrand || "") && (a.specialization || "") === (specialization || ""));
  return sameBase && sameTvl;
}

function assignmentEquals(a, { grade, strand, tvlStrand, specialization, section, academicYear, subject, semester }) {
  const norm = (x) => String(x || "").trim();
  return (
    classEquals(a, { grade, strand, tvlStrand, specialization, section, academicYear }) &&
    norm(a.subject) === norm(subject) &&
    norm(a.semester) === norm(semester)
  );
}

// Whether the uploader is allowed to submit grades for the given class.
// - Advisers: their own advisory classes (primary + extra) or their explicit teaching-load entries.
// - Teachers: their primary subject covers every section of their grade/strand/AY/semester, plus any teaching-load entries.
function hasTeachingAssignment(me, ctx) {
  if ((me.teachingLoad || []).some((a) => assignmentEquals(a, ctx))) return true;
  if (me.role === "adviser" && [me, ...(me.advisories || [])].some((a) => classEquals(a, ctx))) return true;
  if (me.role === "teacher") {
    const sameBase =
      String(me.grade || "") === String(ctx.grade || "") &&
      (me.strand || "") === (ctx.strand || "") &&
      String(me.academicYear || "") === String(ctx.academicYear || "") &&
      String(me.subject || "").trim() === String(ctx.subject || "").trim() &&
      String(me.semester || "").trim() === String(ctx.semester || "").trim();
    const sameTvl =
      (ctx.strand || "") !== "TVL" ||
      ((me.tvlStrand || "") === (ctx.tvlStrand || "") && (me.specialization || "") === (ctx.specialization || ""));
    return sameBase && sameTvl;
  }
  return false;
}

// Marks a sheet as published and emails every student. Only the adviser's publish action calls this.
async function publishSheet(sheet) {
  sheet.status = "published";
  sheet.publishedAt = new Date();
  await sheet.save();

  const ids = sheet.entries.map((e) => e.studentId).filter(Boolean);
  const students = await User.find({ _id: { $in: ids } }).select("email firstName lastName");
  const emails = students.filter((s) => s.email);
  for (const st of emails) {
    sendGradesPublished(st.email, {
      firstName: st.firstName,
      subject: sheet.subject,
      semester: sheet.semester,
      academicYear: sheet.academicYear,
      gradeLevel: sheet.gradeLevel,
      strand: sheet.strand,
      section: sheet.section,
      teacherName: sheet.teacherName,
    });
  }
  return emails.length;
}

// GET /api/grades/sections?grade&strand&tvlStrand&specialization&ay  -> available sections + their advisers
router.get("/sections", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const grade = req.query.grade || me.grade;
  const strand = req.query.strand || me.strand;
  const ay = req.query.ay || me.academicYear;

  const q = { role: "adviser", schoolId: me.schoolId, grade, strand, academicYear: ay, ...tvlIdentity({ strand, tvlStrand: req.query.tvlStrand || me.tvlStrand, specialization: req.query.specialization || me.specialization }) };
  const advisers = await User.find(q).sort({ section: 1 });
  const sections = advisers.map((a) => ({ section: a.section, adviser: { id: a._id, name: fullName(a) } }));
  return res.json({ grade, strand, ay, sections });
});

// GET /api/grades/format?grade&strand&tvlStrand&specialization&section&ay&subject -> downloadable Excel template
router.get("/format", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const grade = req.query.grade || me.grade;
  const strand = req.query.strand || me.strand;
  const tvlStrand = req.query.tvlStrand || me.tvlStrand;
  const specialization = req.query.specialization || me.specialization;
  const section = req.query.section;
  const ay = req.query.ay || me.academicYear;
  const subject = req.query.subject?.trim();

  if (!section) return res.status(400).json({ error: "Please select a section/block." });

  const tvl = tvlIdentity({ strand, tvlStrand, specialization });
  const adviser = await User.findOne({ role: "adviser", schoolId: me.schoolId, grade, strand, section, academicYear: ay, ...tvl });
  if (!adviser) {
    return res.status(400).json({ error: `No adviser found for Grade ${grade}${strand ? " - " + strand : ""}${tvlLabel(strand, tvlStrand, specialization)} - ${section} (${ay}).` });
  }

  const students = await User.find({ role: "student", schoolId: me.schoolId, grade, strand, section, academicYear: ay, ...tvl }).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });

  const { buffer, filename } = await buildTemplate({
    gradeLevel: grade,
    strand,
    tvlStrand,
    specialization,
    section,
    academicYear: ay,
    adviserName: fullName(adviser),
    students,
    subject,
    school: me.school,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(Buffer.from(buffer));
});

// POST /api/grades/upload (multipart: file, subject, semester, academicYear)
router.post("/upload", authRequired, roleGuard("teacher", "adviser"), upload.single("file"), async (req, res) => {
  const me = await User.findById(req.userId);
  if (!req.file) return res.status(400).json({ error: "Please attach the exported Excel file." });

  const subject = req.body.subject?.trim();
  const semester = req.body.semester?.trim();
  const academicYear = req.body.academicYear?.trim();
  if (!subject || !semester || !academicYear) {
    return res.status(400).json({ error: "Subject, semester and academic year are required." });
  }

  let data;
  try {
    data = await parseSubmission(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!data.gradeLevel || !data.section || !data.academicYear) {
    return res.status(400).json({ error: "The Excel file is missing metadata (Grade, Section/Block, Academic Year). Please re-download the format and try again." });
  }
  if (data.students.length === 0) {
    return res.status(400).json({ error: "No student rows found in the Excel file." });
  }

  // Validate the class the file claims, and that it is inside the uploader's teaching assignments.
  const ctx = {
    grade: String(data.gradeLevel),
    strand: data.strand || "",
    tvlStrand: data.tvlStrand || "",
    specialization: data.specialization || "",
    section: data.section,
    academicYear: data.academicYear,
    subject,
    semester,
  };
  const ctxErrors = validateSubmissionContext(ctx);
  if (ctxErrors.length) {
    return res.status(400).json({ error: `Submission refused: ${ctxErrors.join(" ")}` });
  }
  if (!hasTeachingAssignment(me, ctx)) {
    return res.status(403).json({
      error: `Submission refused: you are not assigned to teach ${ctx.subject} in Grade ${ctx.grade}${ctx.strand ? " - " + ctx.strand : ""}${tvlLabel(ctx.strand, ctx.tvlStrand, ctx.specialization)} - Block ${ctx.section} (S.Y. ${ctx.academicYear}, ${ctx.semester}). Grades can only be submitted for classes in your own teaching assignments.`,
    });
  }

  // Resolve the school from the file so grades route within the correct school.
  const { name: fName, province, city, barangay } = data.school || {};
  if (!fName || !province || !city || !barangay) {
    return res.status(400).json({ error: "The Excel file is missing the school address header. Please re-download the format and try again." });
  }
  const fileSchool = await School.findOne({ name: fName, province, city, barangay });
  if (!fileSchool) {
    return res.status(400).json({ error: `No school matches this file (${fName}, ${province}, ${city}, ${barangay}). Please re-download the format from the correct school.` });
  }

  // Cross-check the selected class against the file's metadata so grades route to the right adviser.
  const selGrade = req.body.grade?.trim();
  const selStrand = req.body.strand?.trim() || "";
  const selTvlStrand = req.body.tvlStrand?.trim() || "";
  const selSpecialization = req.body.specialization?.trim() || "";
  const selSection = req.body.section?.trim();
  const selAy = req.body.academicYear?.trim();
  const norm = (a) => String(a || "").toLowerCase().replace(/\s+/g, "");
  if (selGrade || selStrand || selTvlStrand || selSpecialization || selSection || selAy) {
    const mismatches = [];
    if (selGrade && norm(selGrade) !== norm(data.gradeLevel)) mismatches.push(`grade (file says ${data.gradeLevel})`);
    if (selStrand && norm(selStrand) !== norm(data.strand || "")) mismatches.push(`strand (file says ${data.strand || "none"})`);
    if (selTvlStrand && norm(selTvlStrand) !== norm(data.tvlStrand || "")) mismatches.push(`TVL track (file says ${data.tvlStrand || "none"})`);
    if (selSpecialization && norm(selSpecialization) !== norm(data.specialization || "")) mismatches.push(`specialization (file says ${data.specialization || "none"})`);
    if (selSection && norm(selSection) !== norm(data.section)) mismatches.push(`section/block (file says ${data.section})`);
    if (selAy && norm(selAy) !== norm(data.academicYear)) mismatches.push(`academic year (file says ${data.academicYear})`);
    if (mismatches.length) {
      return res.status(400).json({ error: `The selected class does not match the file for ${mismatches.join(", ")}. Please re-download the correct format and try again.` });
    }
  }

  const adviser = await User.findOne({
    role: "adviser",
    schoolId: fileSchool._id,
    grade: data.gradeLevel,
    strand: data.strand || "",
    section: data.section,
    academicYear: data.academicYear,
    ...tvlIdentity(data),
  });
  if (!adviser) {
    return res.status(400).json({ error: `No adviser found for Grade ${data.gradeLevel}${data.strand ? " - " + data.strand : ""}${tvlLabel(data.strand, data.tvlStrand, data.specialization)} - ${data.section} (${data.academicYear}).` });
  }
  const adviserMatched = matchAdviserName(data.adviserName, adviser);

  const existing = await GradeSheet.findOne({
    teacherId: me._id,
    subject,
    semester,
    academicYear,
    gradeLevel: data.gradeLevel,
    strand: data.strand || "",
    section: data.section,
    ...tvlIdentity(data),
  });
  if (existing) {
    return res.status(409).json({ error: `Grades for ${subject} (${semester}, ${academicYear}) on this class were already submitted. Duplicate submissions are not allowed.` });
  }

  const classStudents = await User.find({
    role: "student",
    schoolId: fileSchool._id,
    grade: data.gradeLevel,
    strand: data.strand || "",
    section: data.section,
    academicYear: data.academicYear,
    ...tvlIdentity(data),
  });

  const lookup = new Map();
  for (const s of classStudents) {
    const key = normalizeName(s.lastName) + normalizeName(s.firstName);
    lookup.set(key, s);
  }

  const entries = [];
  let unmatched = 0;
  for (const row of data.students) {
    const key = normalizeName(row.lastName) + normalizeName(row.firstName);
    const student = lookup.get(key);
    if (!student) {
      unmatched += 1;
      continue;
    }
    entries.push({
      studentId: student._id,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      gender: student.gender,
      grade: row.grade ?? "",
    });
  }

  if (entries.length === 0) {
    return res.status(400).json({ error: "No students from the file could be matched to registered students in this class." });
  }

  // Attach the WW / PT / QA component breakdown for this class+subject+quarter when the teacher
  // has already recorded assessment components for it, so the adviser sees the full breakdown.
  const Assessment = (await import("../models/Assessment.js")).default;
  const compRecords = await Assessment.find({
    teacherId: me._id,
    gradeLevel: data.gradeLevel,
    strand: data.strand || "",
    section: data.section,
    academicYear: data.academicYear,
    subject,
    semester,
    ...tvlIdentity(data),
  }).sort({ type: 1, createdAt: 1, label: 1 });
  const breakdown = compRecords.map((rec) => ({
    type: rec.type,
    label: rec.label,
    item: Number(rec.item) > 0 ? Number(rec.item) : 0,
    scores: (rec.scores || []).map((sc) => ({
      studentId: sc.studentId,
      score: sc.score === null || sc.score === undefined || sc.score === "" ? null : Number(sc.score),
      item: sc.item === null || sc.item === undefined || sc.item === "" ? null : Number(sc.item),
    })),
  }));

  const sheet = await GradeSheet.create({
    teacherId: me._id,
    teacherName: fullName(me),
    adviserId: adviser._id,
    adviserName: fullName(adviser),
    subject,
    semester,
    academicYear,
    gradeLevel: data.gradeLevel,
    strand: data.strand || "",
    tvlStrand: data.tvlStrand || "",
    specialization: data.specialization || "",
    section: data.section,
    entries,
    breakdown,
    status: "submitted",
  });

  return res.status(201).json({
    message: `Grades for ${subject} routed to ${fullName(adviser)}'s review (${data.section}). Nothing is sent to students until ${fullName(adviser)} publishes them on the Submit Grades page.`,
    sheetId: sheet._id,
    matched: entries.length,
    unmatched,
    adviserMatched,
  });
});

function genderSplit(entries) {
  const boys = entries.filter((e) => e.gender === "Male");
  const girls = entries.filter((e) => e.gender === "Female");
  return { boys, girls, all: entries };
}

// GET /api/grades/roster?grade&strand&tvlStrand&specialization&section&ay - class roster for online encoding
router.get("/roster", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const grade = req.query.grade || me.grade;
  const strand = req.query.strand || me.strand;
  const tvlStrand = req.query.tvlStrand || me.tvlStrand;
  const specialization = req.query.specialization || me.specialization;
  const section = req.query.section;
  const ay = req.query.ay || me.academicYear;
  if (!section) return res.status(400).json({ error: "Please select a section/block." });

  const tvl = tvlIdentity({ strand, tvlStrand, specialization });
  const adviser = await User.findOne({ role: "adviser", schoolId: me.schoolId, grade, strand, section, academicYear: ay, ...tvl });
  if (!adviser) {
    return res.status(400).json({ error: `No adviser found for Grade ${grade}${strand ? " - " + strand : ""}${tvlLabel(strand, tvlStrand, specialization)} - ${section} (${ay}).` });
  }
  const students = await User.find({ role: "student", schoolId: me.schoolId, grade, strand, section, academicYear: ay, ...tvl })
    .sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });
  return res.json({
    adviser: { id: adviser._id, name: fullName(adviser) },
    students: students.map((s) => ({ id: s._id, firstName: s.firstName, middleName: s.middleName, lastName: s.lastName, gender: s.gender })),
  });
});

// POST /api/grades/encode - online raw-score encoding with automatic computation
router.post("/encode", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const { grade, strand, tvlStrand, specialization, section, academicYear, subject, semester, scores, items } = req.body;
  if (!section || !String(subject || "").trim() || !semester || !academicYear) {
    return res.status(400).json({ error: "Class, subject, semester and academic year are required." });
  }
  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: "No student scores were provided." });
  }

  const ctx = {
    grade: String(grade),
    strand: strand || "",
    tvlStrand: tvlStrand || "",
    specialization: specialization || "",
    section: String(section),
    academicYear,
    subject: String(subject).trim(),
    semester,
  };
  const ctxErrors = validateSubmissionContext(ctx);
  if (ctxErrors.length) {
    return res.status(400).json({ error: `Submission refused: ${ctxErrors.join(" ")}` });
  }

  const itemTotals = {
    ww: Number(items?.ww) > 0 ? Number(items.ww) : 100,
    pt: Number(items?.pt) > 0 ? Number(items.pt) : 100,
    qa: Number(items?.qa) > 0 ? Number(items.qa) : 100,
  };

  const adviser = await User.findOne({
    role: "adviser", schoolId: me.schoolId,
    grade: String(grade), strand: strand || "", section, academicYear,
    ...tvlIdentity(ctx),
  });
  if (!adviser) {
    return res.status(400).json({ error: `No adviser found for Grade ${grade}${strand ? " - " + strand : ""}${tvlLabel(strand, tvlStrand, specialization)} - ${section} (${academicYear}).` });
  }

  const existing = await GradeSheet.findOne({
    teacherId: me._id, subject: String(subject).trim(), semester, academicYear,
    gradeLevel: String(grade), strand: strand || "", section,
    ...tvlIdentity(ctx),
  });
  if (existing) {
    return res.status(409).json({ error: `Grades for ${subject} (${semester}, ${academicYear}) on this class were already submitted.` });
  }

  const students = await User.find({
    _id: { $in: scores.map((x) => x.studentId) },
    role: "student", schoolId: me.schoolId, grade: String(grade), strand: strand || "", section, academicYear,
    ...tvlIdentity(ctx),
  });
  const byId = new Map(students.map((s) => [String(s._id), s]));

  const entries = [];
  let complete = 0;
  let incomplete = 0;
  for (const row of scores) {
    const student = byId.get(String(row.studentId));
    if (!student) continue;
    const rowItems = {
      ww: Number(row.wwItems) > 0 ? Number(row.wwItems) : itemTotals.ww,
      pt: Number(row.ptItems) > 0 ? Number(row.ptItems) : itemTotals.pt,
      qa: Number(row.qaItems) > 0 ? Number(row.qaItems) : itemTotals.qa,
    };
    const result = computeGrade({ ww: row.ww, pt: row.pt, qa: row.qa, items: rowItems });
    entries.push({
      studentId: student._id,
      firstName: student.firstName,
      middleName: student.middleName,
      lastName: student.lastName,
      gender: student.gender,
      grade: result.complete ? result.transmuted : null,
      incomplete: !result.complete,
      ww: row.ww != null ? Number(row.ww) : null,
      pt: row.pt != null ? Number(row.pt) : null,
      qa: row.qa != null ? Number(row.qa) : null,
      wwItems: rowItems.ww,
      ptItems: rowItems.pt,
      qaItems: rowItems.qa,
    });
    if (result.complete) complete += 1;
    else incomplete += 1;
  }

  if (entries.length === 0) {
    return res.status(400).json({ error: "No students found for this class. Please check your class roster." });
  }

  if (!hasTeachingAssignment(me, ctx)) {
    return res.status(403).json({
      error: `Submission refused: you are not assigned to teach ${ctx.subject} in Grade ${ctx.grade}${ctx.strand ? " - " + ctx.strand : ""}${tvlLabel(ctx.strand, ctx.tvlStrand, ctx.specialization)} - Block ${ctx.section} (S.Y. ${ctx.academicYear}, ${ctx.semester}). Grades can only be recorded for classes in your own teaching assignments.`,
    });
  }

  const sheet = await GradeSheet.create({
    teacherId: me._id,
    teacherName: fullName(me),
    adviserId: adviser._id,
    adviserName: fullName(adviser),
    subject: String(subject).trim(),
    semester,
    academicYear,
    gradeLevel: String(grade),
    strand: strand || "",
    tvlStrand: tvlStrand || "",
    specialization: specialization || "",
    section,
    entries,
    items: itemTotals,
    status: "submitted",
    notes: req.body.notes || "",
  });

  return res.status(201).json({
    message: `Grades for ${subject} computed and routed to ${fullName(adviser)}'s review (${section}). Nothing is sent to students until ${fullName(adviser)} publishes them on the Submit Grades page.`,
    sheetId: sheet._id,
    computed: entries.length,
    incomplete,
  });
});

// GET /api/grades/report-cards?semester&ay - adviser downloads SF9-style report cards
router.get("/report-cards", authRequired, roleGuard("adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const semester = req.query.semester;
  const ay = req.query.ay || me.academicYear;
  const grade = req.query.grade || me.grade;
  const strand = req.query.strand ?? me.strand;
  const tvlStrand = req.query.tvlStrand ?? me.tvlStrand ?? "";
  const specialization = req.query.specialization ?? me.specialization ?? "";
  const section = req.query.section || me.section;
  if (!semester) return res.status(400).json({ error: "Please select a semester/quarter." });

  const sheets = await GradeSheet.find({ adviserId: me._id, semester, academicYear: ay, gradeLevel: String(grade), strand, section, ...tvlIdentity({ strand, tvlStrand, specialization }) });
  if (sheets.length === 0) {
    return res.status(400).json({ error: `No grade submissions found for ${semester} (S.Y. ${ay}).` });
  }

  const studentMap = new Map();
  for (const s of sheets) {
    for (const e of s.entries) {
      if (!e.studentId || e.grade === "" || e.grade === null || e.grade === undefined) continue;
      const key = String(e.studentId);
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          firstName: e.firstName, middleName: e.middleName, lastName: e.lastName, gender: e.gender, grades: [],
        });
      }
      studentMap.get(key).grades.push({ subject: s.subject, grade: e.grade });
    }
  }

  const genderRank = (s) => (String(s.gender || "").toLowerCase() === "male" ? 0 : String(s.gender || "").toLowerCase() === "female" ? 1 : 2);
  const students = [...studentMap.values()].sort(
    (a, b) =>
      genderRank(a) - genderRank(b) ||
      String(a.lastName || "").localeCompare(String(b.lastName || "")) ||
      String(a.firstName || "").localeCompare(String(b.firstName || "")) ||
      String(a.middleName || "").localeCompare(String(b.middleName || ""))
  );
  if (students.length === 0) {
    return res.status(400).json({ error: "No grades to include in the report cards." });
  }

  const { buffer } = await buildReportCardsWorkbook({
    school: me.school,
    semester,
    academicYear: ay,
    gradeLevel: grade,
    strand,
    tvlStrand,
    specialization,
    section,
    adviserName: fullName(me),
    students,
  });
  const filename = reportCardFileName({ gradeLevel: grade, strand, tvlStrand, specialization, section, semester });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(Buffer.from(buffer));
});

// GET /api/grades/student/report-card - student downloads their own report card
router.get("/student/report-card", authRequired, roleGuard("student"), async (req, res) => {
  const me = await User.findById(req.userId);
  const sheets = await GradeSheet.find({ status: "published", "entries.studentId": me._id }).sort({ publishedAt: 1 });

  const bySem = new Map();
  for (const s of sheets) {
    const mine = s.entries.find((e) => String(e.studentId) === String(me._id));
    if (!mine || mine.grade === "" || mine.grade === null || mine.grade === undefined) continue;
    const key = `${s.semester}||${s.academicYear}`;
    if (!bySem.has(key)) bySem.set(key, { semester: s.semester, academicYear: s.academicYear, grades: [] });
    bySem.get(key).grades.push({ subject: s.subject, teacherName: s.teacherName, grade: mine.grade });
  }

  const semesters = [...bySem.values()].sort(
    (a, b) => a.academicYear.localeCompare(b.academicYear) || a.semester.localeCompare(b.semester)
  );
  if (semesters.length === 0) {
    return res.status(400).json({ error: "No published grades to include in your report card yet." });
  }

  const { buffer } = await buildStudentReportCardWorkbook({ user: me, school: me.school, semesters });
  const filename = `Report_Card_${me.lastName}_${me.firstName}.xlsx`.replace(/\s+/g, "_");

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(Buffer.from(buffer));
});

// GET /api/grades/adviser - adviser dashboard, deeply grouped
router.get("/adviser", authRequired, roleGuard("adviser"), async (req, res) => {
  const sheets = await GradeSheet.find({ adviserId: req.userId }).sort({ createdAt: -1 });

  const tree = [];
  const ays = {};
  for (const s of sheets) {
    const d = genderSplit(s.entries);
    const item = {
      sheetId: s._id,
      subject: s.subject,
      semester: s.semester,
      academicYear: s.academicYear,
      gradeLevel: s.gradeLevel,
      strand: s.strand,
      tvlStrand: s.tvlStrand || "",
      specialization: s.specialization || "",
      section: s.section,
      adviserId: s.adviserId,
      adviserName: s.adviserName,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
      status: s.status,
      notes: s.notes || "",
      publishedAt: s.publishedAt,
      createdAt: s.createdAt,
      entries: d.all,
      boys: d.boys,
      girls: d.girls,
      breakdown: s.breakdown || [],
    };

    (ays[s.academicYear] ||= {}).list ||= [];
    ays[s.academicYear].list.push(item);
    const aysObj = ays[s.academicYear];
    (aysObj.semesters ||= {})[s.semester] ||= [];
    aysObj.semesters[s.semester].push(item);
  }

  for (const ay of Object.keys(ays).sort().reverse()) {
    const ayNode = { academicYear: ay, sheets: ays[ay].list, semesters: [] };
    for (const sem of Object.keys(ays[ay].semesters).sort().reverse()) {
      const semSheets = ays[ay].semesters[sem];
      const strands = {};
      for (const s of semSheets) {
        const key = s.strand || "N/A";
        const label = `${key}${s.tvlStrand ? ` · ${s.tvlStrand}` : ""}${s.specialization ? ` (${s.specialization})` : ""}`;
        (strands[label] ||= []).push(s);
      }
      ayNode.semesters.push({ semester: sem, strands: Object.keys(strands).map((st) => ({ strand: st, sheets: strands[st] })) });
    }
    tree.push(ayNode);
  }

  return res.json({ tree });
});

// GET /api/grades/teacher - teacher's own submissions
router.get("/teacher", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const sheets = await GradeSheet.find({ teacherId: req.userId }).sort({ createdAt: -1 });
  return res.json({
    sheets: sheets.map((s) => ({
      sheetId: s._id,
      subject: s.subject,
      semester: s.semester,
      academicYear: s.academicYear,
      gradeLevel: s.gradeLevel,
      strand: s.strand,
      tvlStrand: s.tvlStrand || "",
      specialization: s.specialization || "",
      section: s.section,
      adviserId: s.adviserId,
      adviserName: s.adviserName,
      status: s.status,
      notes: s.notes || "",
      publishedAt: s.publishedAt,
      createdAt: s.createdAt,
      studentCount: s.entries.length,
      boys: s.entries.filter((e) => e.gender === "Male").length,
      girls: s.entries.filter((e) => e.gender === "Female").length,
      entries: s.entries.map((e) => ({
        studentId: e.studentId,
        firstName: e.firstName,
        middleName: e.middleName,
        lastName: e.lastName,
        gender: e.gender,
        grade: e.grade,
        incomplete: Boolean(e.incomplete),
        ww: e.ww,
        pt: e.pt,
        qa: e.qa,
        wwItems: e.wwItems,
        ptItems: e.ptItems,
        qaItems: e.qaItems,
      })),
      breakdown: s.breakdown || [],
    })),
  });
});

function classMatch(a, cls) {
  const sameBase =
    String(a.grade) === String(cls.grade) &&
    (a.strand || "") === (cls.strand || "") &&
    String(a.section || "") === String(cls.section || "") &&
    String(a.academicYear) === String(cls.academicYear);
  const sameTvl =
    (cls.strand || "") !== "TVL" ||
    ((a.tvlStrand || "") === (cls.tvlStrand || "") && (a.specialization || "") === (cls.specialization || ""));
  return sameBase && sameTvl;
}

// GET /api/grades/class?grade&strand&tvlStrand&specialization&section&ay[&semester] - roster + subject grades for one class
router.get("/class", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const cls = {
    grade: String(req.query.grade || me.grade),
    strand: req.query.strand ?? me.strand ?? "",
    tvlStrand: req.query.tvlStrand ?? me.tvlStrand ?? "",
    specialization: req.query.specialization ?? me.specialization ?? "",
    section: String(req.query.section || ""),
    academicYear: String(req.query.ay || me.academicYear),
  };
  if (!cls.section) return res.status(400).json({ error: "Please select a section/block." });

  const isAdviser = me.role === "adviser" && (classMatch(me, cls) || (me.advisories || []).some((a) => classMatch(a, cls)));
  const isTeacher = (me.teachingLoad || []).some((a) => classMatch(a, cls));
  if (!isAdviser && !isTeacher) {
    return res.status(403).json({ error: "You are not assigned to this class." });
  }

  const adviser = await User.findOne({
    role: "adviser", schoolId: me.schoolId,
    grade: cls.grade, strand: cls.strand, section: cls.section, academicYear: cls.academicYear,
    ...tvlIdentity(cls),
  });
  const students = await User.find({
    role: "student", schoolId: me.schoolId,
    grade: cls.grade, strand: cls.strand, section: cls.section, academicYear: cls.academicYear,
    ...tvlIdentity(cls),
  }).sort({ gender: -1, lastName: 1, firstName: 1, middleName: 1 });

  const sheetQuery = { gradeLevel: cls.grade, strand: cls.strand, section: cls.section, academicYear: cls.academicYear, ...tvlIdentity(cls) };
  if (req.query.semester) sheetQuery.semester = req.query.semester;
  const sheets = await GradeSheet.find(sheetQuery).sort({ semester: 1, subject: 1 });

  return res.json({
    gradeLevel: cls.grade,
    strand: cls.strand,
    tvlStrand: cls.tvlStrand,
    specialization: cls.specialization,
    section: cls.section,
    academicYear: cls.academicYear,
    adviser: adviser ? { id: adviser._id, name: fullName(adviser) } : null,
    students: students.map((s) => ({ id: s._id, firstName: s.firstName, middleName: s.middleName, lastName: s.lastName, gender: s.gender })),
    sheets: sheets.map((s) => ({
      sheetId: s._id,
      subject: s.subject,
      semester: s.semester,
      academicYear: s.academicYear,
      status: s.status,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
      adviserName: s.adviserName,
      publishedAt: s.publishedAt,
      items: s.items || { ww: 100, pt: 100, qa: 100 },
      entries: s.entries.map((e) => ({ studentId: e.studentId, grade: e.grade, incomplete: Boolean(e.incomplete), ww: e.ww, pt: e.pt, qa: e.qa, wwItems: e.wwItems, ptItems: e.ptItems, qaItems: e.qaItems })),
      breakdown: s.breakdown || [],
    })),
  });
});

function numGrade(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET /api/grades/leaderboard - top 5 teachers and advisers by average grade given
router.get("/leaderboard", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const ids = (await User.find({ schoolId: me.schoolId, role: { $in: ["teacher", "adviser"] } }).select("_id")).map((u) => u._id);
  const sheets = await GradeSheet.find({ $or: [{ teacherId: { $in: ids } }, { adviserId: { $in: ids } }] })
    .select("teacherId teacherName adviserId adviserName subject gradeLevel strand tvlStrand specialization section entries");

  const byTeacher = new Map();
  const byAdviser = new Map();
  const consider = (map, id, name, sheet) => {
    const key = String(id);
    let run = map.get(key);
    if (!run) {
      run = { id: key, name, sum: 0, n: 0, sheets: 0, best: null };
      map.set(key, run);
    }
    run.sheets += 1;
    let sheetSum = 0;
    let sheetN = 0;
    for (const e of sheet.entries) {
      const g = numGrade(e.grade);
      if (g !== null) {
        sheetSum += g;
        sheetN += 1;
      }
    }
    if (sheetN) {
      run.sum += sheetSum;
      run.n += sheetN;
      const avg = sheetSum / sheetN;
      if (!run.best || avg > run.best.avg) {
        run.best = {
          subject: sheet.subject,
          className: `Grade ${sheet.gradeLevel}${sheet.strand ? ` · ${sheet.strand}` : ""}${sheet.tvlStrand ? ` · ${sheet.tvlStrand}` : ""}${sheet.specialization ? ` (${sheet.specialization})` : ""} - ${sheet.section}`,
          avg,
        };
      }
    }
  };

  for (const s of sheets) {
    consider(byTeacher, s.teacherId, s.teacherName, s);
    consider(byAdviser, s.adviserId, s.adviserName, s);
  }

  const rank = (map) =>
    [...map.values()]
      .filter((x) => x.n > 0)
      .map((x) => ({ id: x.id, name: x.name, sheets: x.sheets, avgGrade: Math.round((x.sum / x.n) * 100) / 100, best: x.best }))
      .sort((a, b) => b.avgGrade - a.avgGrade)
      .slice(0, 5);

  return res.json({ teachers: rank(byTeacher), advisers: rank(byAdviser) });
});

// POST /api/grades/publish - adviser sends multiple routed grade lists to the student portal at once
router.post("/publish", authRequired, roleGuard("adviser"), async (req, res) => {
  const ids = (req.body.sheetIds || []).map((x) => String(x)).filter(Boolean);
  if (ids.length === 0) return res.status(400).json({ error: "Select at least one grade list to send to students." });

  const sheets = await GradeSheet.find({ _id: { $in: ids } });
  if (sheets.length !== ids.length) {
    return res.status(404).json({ error: "Some of the selected grade lists no longer exist. Refresh and try again." });
  }
  for (const s of sheets) {
    if (String(s.adviserId) !== String(req.userId)) {
      return res.status(403).json({ error: `You can only send grade lists for your own advisory (${s.subject}).` });
    }
  }

  let emailed = 0;
  let published = 0;
  let skipped = 0;
  for (const s of sheets) {
    if (s.status === "published") {
      skipped += 1;
      continue;
    }
    emailed += await publishSheet(s);
    published += 1;
  }

  recordEvent({
    type: "grades.publish",
    action: `Published ${published} grade sheet${published === 1 ? "" : "s"} to students`,
    actor: req.userId,
    actorRole: "adviser",
    target: sheets.map((s) => `${s.subject} (${s.grade}${s.strand ? " " + s.strand : ""})`).join(", ") || "—",
    meta: { published, skipped, emailed, sheetIds: ids },
    ip: getClientIp(req),
  });

  return res.json({
    message:
      published === 0
        ? "The selected grade lists were already sent to students."
        : `${published} grade list${published === 1 ? "" : "s"} sent to students (${emailed} email${emailed === 1 ? "" : "s"}).`,
    published,
    skipped,
    emailed,
  });
});

// POST /api/grades/:id/publish - adviser publishes grades to students (manual re-send)
router.post("/:id/publish", authRequired, roleGuard("adviser"), async (req, res) => {
  const sheet = await GradeSheet.findById(req.params.id);
  if (!sheet) return res.status(404).json({ error: "Grade sheet not found." });
  if (String(sheet.adviserId) !== String(req.userId)) {
    return res.status(403).json({ error: "You can only publish grades for your own advisory." });
  }

  const emailed = await publishSheet(sheet);

  return res.json({ message: `Grades for ${sheet.subject} sent to ${emailed} students.` });
});

// POST /api/grades/:id/unpublish - adviser pulls published grades back to submitted
router.post("/:id/unpublish", authRequired, roleGuard("adviser"), async (req, res) => {
  const sheet = await GradeSheet.findById(req.params.id);
  if (!sheet) return res.status(404).json({ error: "Grade sheet not found." });
  if (String(sheet.adviserId) !== String(req.userId)) {
    return res.status(403).json({ error: "You can only unpublish grades for your own advisory." });
  }
  if (sheet.status !== "published") {
    return res.json({ message: `Grades for ${sheet.subject} are not currently published.` });
  }

  sheet.status = "submitted";
  sheet.publishedAt = null;
  await sheet.save();

  return res.json({ message: `Grades for ${sheet.subject} unpublished. Students will no longer see them.` });
});

// GET /api/grades/:id/pdf - downloadable grade list (teacher or adviser of the sheet)
router.get("/:id/pdf", authRequired, roleGuard("teacher", "adviser"), async (req, res) => {
  const me = await User.findById(req.userId);
  const sheet = await GradeSheet.findById(req.params.id);
  if (!sheet) return res.status(404).json({ error: "Grade sheet not found." });
  if (String(sheet.adviserId) !== String(me._id) && String(sheet.teacherId) !== String(me._id)) {
    return res.status(403).json({ error: "You can only download grade lists for sheets you submitted or advise." });
  }

  const pdf = await buildGradeSheetPdf({
    school: me.school,
    subject: sheet.subject,
    semester: sheet.semester,
    academicYear: sheet.academicYear,
    gradeLevel: sheet.gradeLevel,
    strand: sheet.strand,
    tvlStrand: sheet.tvlStrand || "",
    specialization: sheet.specialization || "",
    section: sheet.section,
    teacherName: sheet.teacherName,
    entries: sheet.entries,
  });
  const filename = `Grade_List_${sheet.subject.replace(/\s+/g, "_")}_${sheet.gradeLevel}_${sheet.section}${sheet.tvlStrand ? `_${sheet.tvlStrand.replace(/\s+/g, "_")}` : ""}${sheet.specialization ? `_${sheet.specialization.replace(/\s+/g, "_")}` : ""}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(pdf);
});


// GET /api/grades/student - current student's published grades
router.get("/student", authRequired, roleGuard("student"), async (req, res) => {
  const sheets = await GradeSheet.find({
    status: "published",
    "entries.studentId": req.userId,
  }).sort({ publishedAt: -1 });

  const grades = sheets.map((s) => {
    const mine = s.entries.find((e) => String(e.studentId) === String(req.userId));
    return {
      subject: s.subject,
      semester: s.semester,
      academicYear: s.academicYear,
      gradeLevel: s.gradeLevel,
      strand: s.strand,
      section: s.section,
      teacherName: s.teacherName,
      adviserName: s.adviserName,
      grade: mine?.grade ?? "",
      incomplete: mine?.incomplete ?? false,
      ww: mine?.ww ?? null,
      pt: mine?.pt ?? null,
      qa: mine?.qa ?? null,
      wwItems: mine?.wwItems ?? null,
      ptItems: mine?.ptItems ?? null,
      qaItems: mine?.qaItems ?? null,
      publishedAt: s.publishedAt,
      // Only this student's own row of each WW / PT / QA component, for grade transparency.
      breakdown: (s.breakdown || []).map((c) => {
        const sc = (c.scores || []).find((x) => String(x.studentId) === String(req.userId));
        return {
          type: c.type,
          label: c.label,
          item: c.item || 0,
          score: sc?.score ?? null,
          studentItem: sc?.item ?? null,
        };
      }),
    };
  });

  const byAy = {};
  for (const g of grades) (byAy[g.academicYear] ||= []).push(g);
  const years = Object.keys(byAy).sort().reverse().map((ay) => ({ academicYear: ay, grades: byAy[ay] }));

  const me = await User.findById(req.userId).select("grade strand tvlStrand specialization section academicYear schoolId firstName lastName gender").lean();
  const adviser = await findStudentAdviser(me);

  return res.json({ grades, byYear: years, adviser: adviser ? { id: adviser._id, name: fullName(adviser) } : null });
});

// Finds the adviser whose advisory covers the given student's class. For TVL classes the adviser must
// also match the student's TVL track + specialization, since blocks are per-specialization and shared
// block numbers across specializations must never resolve to the wrong adviser.
async function findStudentAdviser(me) {
  if (!me || !me.grade || me.grade === "N/A") return null;
  const isTvl = (me.strand || "") === "TVL";
  const base = { role: "adviser", schoolId: me.schoolId, grade: me.grade, strand: me.strand || "", section: me.section, academicYear: me.academicYear, ...tvlIdentity(me) };

  if (isTvl) {
    const direct = await User.findOne(base);
    if (direct) return direct;
    const extra = await User.findOne({
      role: "adviser",
      schoolId: me.schoolId,
      academicYear: me.academicYear,
      advisories: {
        $elemMatch: {
          grade: me.grade,
          strand: me.strand || "",
          section: me.section,
          ...tvlIdentity(me),
        },
      },
    });
    return extra || null;
  }

  let direct = me.specialization ? await User.findOne({ ...base, specialization: me.specialization }) : null;
  if (!direct) direct = await User.findOne(base);
  if (direct) return direct;

  const extra = await User.findOne({
    role: "adviser",
    schoolId: me.schoolId,
    academicYear: me.academicYear,
    advisories: {
      $elemMatch: {
        grade: me.grade,
        strand: me.strand || "",
        section: me.section,
        ...(me.specialization ? { specialization: me.specialization } : {}),
      },
    },
  });
  return extra || null;
}

export default router;
