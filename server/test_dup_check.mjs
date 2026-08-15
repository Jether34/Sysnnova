import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './src/models/User.js';

await mongoose.connect(process.env.MONGO_URI);

const b = {
  role: "teacher",
  firstName: "Test",
  lastName: "User",
  email: "signup-test2@test.com",
  password: "test123",
  grade: "11",
  strand: "STEM",
  section: "1",
  academicYear: "2025-2026",
  subject: "General Mathematics",
  semester: "1st Semester, 1st Quarter",
  school: { name: "STI College", province: "Pampanga", city: "City of San Fernando", barangay: "Dolores" }
};

const schoolName = String(b.school?.name || "").trim();
const province = String(b.school?.province || "").trim();
const city = String(b.school?.city || "").trim();
const barangay = String(b.school?.barangay || "").trim();
const school = await School.findOne({ name: schoolName, province: province, city: city, barangay: barangay });

console.log('Testing buildDuplicateError...');
const dup = await buildDuplicateError({ ...b, schoolId: school._id });
console.log('Duplicate check result:', dup);

await mongoose.disconnect();

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

function classLabel(g, strand, tvlStrand, specialization, section) {
  let label = `Grade ${g}${strand ? " - " + strand : ""}`;
  if (tvlStrand) label += ` (${tvlStrand})`;
  if (specialization) label += ` - ${specialization}`;
  if (section) label += ` - ${section}`;
  return label;
}

function fullName(u) {
  return `${u.firstName} ${u.lastName}`;
}

async function advisoryTaken(schoolId, academicYear, cls) {
  const strand = cls.strand || "";
  const primary = await User.findOne(slotQuery(
    { role: "adviser", schoolId, academicYear, grade: String(cls.grade), strand, section: String(cls.section) },
    cls
  ));
  if (primary) return true;
  const extra = await User.findOne({
    role: "adviser", schoolId,
    advisories: { $elemMatch: slotElemMatch({ academicYear, grade: String(cls.grade), strand, section: String(cls.section) }, cls) },
  });
  return Boolean(extra);
}

async function assignmentTaken(schoolId, a) {
  const strand = a.strand || "";
  const tvlStrand = a.tvlStrand || "";
  const specialization = a.specialization || "";
  const section = String(a.section || "").trim();
  const extra = await User.findOne({
    role: { $in: ["teacher", "adviser"] }, schoolId,
    teachingLoad: {
      $elemMatch: {
        grade: String(a.grade), strand, tvlStrand, specialization, section,
        academicYear: a.academicYear, subject: a.subject, semester: a.semester,
      },
    },
  });
  return Boolean(extra);
}

async function teacherSlotTaken(schoolId, { grade, strand, section, academicYear, tvlStrand, specialization }) {
  const s = String(strand || "").trim();
  const sec = String(section || "").trim();
  const g = String(grade);
  const ay = String(academicYear);
  const cls = { grade, strand, tvlStrand, specialization };

  const primary = await User.findOne(slotQuery(
    { role: "teacher", schoolId, grade: g, strand: s, section: sec, academicYear: ay },
    cls
  ));
  if (primary) return { taken: true, teacher: primary };

  const viaLoad = await User.findOne({
    role: { $in: ["teacher", "adviser"] }, schoolId,
    teachingLoad: { $elemMatch: slotElemMatch({ grade: g, strand: s, section: sec, academicYear: ay }, cls) },
  });
  if (viaLoad) return { taken: true, teacher: viaLoad };

  return { taken: false };
}

async function adviserSlotTaken(schoolId, { grade, strand, section, academicYear, tvlStrand, specialization }) {
  const s = String(strand || "").trim();
  const sec = String(section || "").trim();
  const g = String(grade);
  const ay = String(academicYear);
  const cls = { grade, strand, tvlStrand, specialization };

  const primary = await User.findOne(slotQuery(
    { role: "adviser", schoolId, grade: g, strand: s, section: sec, academicYear: ay },
    cls
  ));
  if (primary) return { taken: true, adviser: primary };

  const viaAdvisories = await User.findOne({
    role: "adviser", schoolId,
    advisories: { $elemMatch: slotElemMatch({ grade: g, strand: s, section: sec, academicYear: ay }, cls) },
  });
  if (viaAdvisories) return { taken: true, adviser: viaAdvisories };

  return { taken: false };
}

function slotQuery(base, cls, extra = {}) {
  const q = { ...base, ...extra };
  if ((cls.strand || "") === "TVL") {
    if (cls.tvlStrand) q.tvlStrand = cls.tvlStrand;
    if (cls.specialization) q.specialization = cls.specialization;
  }
  return q;
}

function slotElemMatch(elem, cls, extra = {}) {
  const m = { ...elem, ...extra };
  if ((cls.strand || "") === "TVL") {
    if (cls.tvlStrand) m.tvlStrand = cls.tvlStrand;
    if (cls.specialization) m.specialization = cls.specialization;
  }
  return m;
}

function fullName(u) {
  return `${u.firstName} ${u.lastName}`;
}

import School from './src/models/School.js';
const b = {
  role: "teacher",
  firstName: "Test",
  lastName: "User",
  email: "signup-test3@test.com",
  password: "test123",
  grade: "11",
  strand: "STEM",
  section: "1",
  academicYear: "2025-2026",
  subject: "General Mathematics",
  semester: "1st Semester, 1st Quarter",
  school: { name: "STI College", province: "Pampanga", city: "City of San Fernando", barangay: "Dolores" }
};

const schoolName = String(b.school?.name || "").trim();
const province = String(b.school?.province || "").trim();
const city = String(b.school?.city || "").trim();
const barangay = String(b.school?.barangay || "").trim();
const school = await School.findOne({ name: schoolName, province, city, barangay });

console.log('Testing buildDuplicateError...');
const dup = await buildDuplicateError({ ...b, schoolId: school._id });
console.log('Duplicate check result:', dup);

await mongoose.disconnect();