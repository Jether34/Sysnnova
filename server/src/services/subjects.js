import SchoolSubjects from "../models/SchoolSubjects.js";
import { isShsGrade, JHS_SUBJECTS, SHS_SUBJECTS, subjectsFor } from "../config/index.js";

// Resolve the enabled subject list for a school + semester + grade band.
// If the admin has configured subjects for that school/semester, use them;
// otherwise fall back to the static default lists.
export async function enabledSubjectsFor({ schoolId, semester, grade }) {
  let config = null;
  if (schoolId && semester) {
    config = await SchoolSubjects.findOne({ schoolId, semester });
  }
  if (!config || !config.shs.length && !config.jhs.length) {
    return subjectsFor(grade);
  }
  return isShsGrade(grade) ? config.shs : config.jhs;
}

// Validate that a subject is allowed for the given school/semester/grade.
export async function subjectAllowedFor({ schoolId, semester, grade, subject }) {
  const enabled = await enabledSubjectsFor({ schoolId, semester, grade });
  return enabled.includes(String(subject || "").trim());
}

export { JHS_SUBJECTS, SHS_SUBJECTS };
