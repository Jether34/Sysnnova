import User from "../models/User.js";
import { isShsGrade, GRADE_LEVELS, STRANDS, SEMESTERS, BLOCKS, subjectsFor, TVL_STRANDS, TVL_SPECIALIZATIONS } from "../config/index.js";

export function validateClassEntry(g, { requireSection = true } = {}) {
  const errors = [];
  if (!GRADE_LEVELS.includes(String(g.grade))) errors.push("Grade level is required.");
  if (isShsGrade(g.grade) && !STRANDS.includes(g.strand)) {
    errors.push(`A valid strand is required for SHS Grade ${g.grade}: ${STRANDS.join(", ")}.`);
  }
  if (!isShsGrade(g.grade)) g.strand = "";
  if (g.strand === "TVL") {
    if (!g.tvlStrand) errors.push("TVL Track is required for TVL classes.");
    else if (!TVL_STRANDS.includes(g.tvlStrand)) {
      errors.push(`Invalid TVL track: ${g.tvlStrand}. Choose from: ${TVL_STRANDS.join(", ")}.`);
    }
    if (!g.specialization) errors.push("Specialization is required for TVL classes.");
    else if (g.tvlStrand && TVL_SPECIALIZATIONS[g.tvlStrand] && !TVL_SPECIALIZATIONS[g.tvlStrand].includes(g.specialization)) {
      errors.push(`Invalid specialization for ${g.tvlStrand}: ${g.specialization}.`);
    }
  }
  if (requireSection && !BLOCKS.includes(String(g.section))) errors.push("Section/Block (1-20) is required.");
  if (!g.academicYear) errors.push("Academic year is required.");
  return errors;
}

export function validateTeachingEntry(a) {
  const errors = validateClassEntry(a, { requireSection: true });
  if (!subjectsFor(a.grade).includes(a.subject)) {
    errors.push(`Subject is not valid for Grade ${a.grade}. Choose from: ${subjectsFor(a.grade).join(", ")}.`);
  }
  if (!SEMESTERS.includes(a.semester)) errors.push(`Semester must be one of: ${SEMESTERS.join(", ")}.`);
  return errors;
}

// A class is identified by grade/strand/section/academicYear. For TVL classes the identity also
// includes the TVL track and specialization, so each specialization owns its own blocks 1-20 and has
// its OWN adviser slot and subject-teacher slot. Duplicate adviser or duplicate subject-teacher
// accounts for the same class (including same specialization) are prohibited.
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

export async function advisoryTaken(schoolId, academicYear, cls) {
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

export async function assignmentTaken(schoolId, a) {
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

export async function teacherSlotTaken(schoolId, { grade, strand, section, academicYear, tvlStrand, specialization }) {
  const s = String(strand || "").trim();
  const sec = String(section || "").trim();
  const g = String(grade);
  const ay = String(academicYear);
  const cls = { grade, strand, tvlStrand, specialization };

  // Check primary teacher fields (if they store grade/strand/section directly)
  const primary = await User.findOne(slotQuery(
    { role: "teacher", schoolId, grade: g, strand: s, section: sec, academicYear: ay },
    cls
  ));
  if (primary) return { taken: true, teacher: primary };

  // Check teachingLoad array
  const viaLoad = await User.findOne({
    role: { $in: ["teacher", "adviser"] }, schoolId,
    teachingLoad: { $elemMatch: slotElemMatch({ grade: g, strand: s, section: sec, academicYear: ay }, cls) },
  });
  if (viaLoad) return { taken: true, teacher: viaLoad };

  return { taken: false };
}

export async function adviserSlotTaken(schoolId, { grade, strand, section, academicYear, tvlStrand, specialization }) {
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

export function normalizeClassEntry(a) {
  return {
    grade: String(a.grade),
    strand: (a.strand || "").trim(),
    tvlStrand: (a.tvlStrand || "").trim(),
    specialization: (a.specialization || "").trim(),
    section: String(a.section || "").trim(),
    academicYear: String(a.academicYear).trim(),
  };
}
