import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './src/models/User.js';
import School from './src/models/School.js';

await mongoose.connect(process.env.MONGO_URI);

const b = {
  role: "teacher",
  firstName: "Test",
  lastName: "User",
  email: "signup-test4@test.com",
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

console.log('Testing teacherSlotTaken...');
const slot = await teacherSlotTaken(school._id, { 
  grade: b.grade, 
  strand: b.strand, 
  section: b.section || "", 
  academicYear: b.academicYear, 
  tvlStrand: b.tvlStrand, 
  specialization: b.specialization 
});
console.log('Teacher slot:', slot);

console.log('Testing assignmentTaken...');
const assignment = await assignmentTaken(school._id, {
  grade: b.grade, 
  strand: b.strand || "", 
  tvlStrand: b.tvlStrand || "", 
  specialization: b.specialization || "", 
  section: b.section || "", 
  academicYear: b.academicYear, 
  subject: b.subject, 
  semester: b.semester
});
console.log('Assignment taken:', assignment);

await mongoose.disconnect();

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