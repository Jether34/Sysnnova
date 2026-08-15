import bcrypt from "bcryptjs";
import { connectDb } from "../src/config/db.js";
import User from "../src/models/User.js";

const ADVISER_EMAIL = process.env.ADVISER_EMAIL || "jethergarque8@gmail.com";
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || "secret123";
const SEMESTER = process.env.SEMESTER || "1st Semester, 1st Quarter";

// Subjects deliberately exclude the adviser's own load (General Mathematics primary,
// General Biology teaching assignment) to keep each subject/class owned by exactly one teacher.
const SUBJECTS = [
  "Statistics and Probability",
  "Oral Communication in Context",
  "Reading and Writing Skills",
  "Physical Science",
  "Earth and Life Science",
  "Empowerment Technologies",
  "Personal Development",
  "General Physics",
  "General Chemistry",
  "English for Academic and Professional Purposes",
];

const TEACHERS = [
  { firstName: "Alvin", lastName: "Soriano", gender: "Male" },
  { firstName: "Leila", lastName: "Villar", gender: "Female" },
  { firstName: "Rodrigo", lastName: "Mallari", gender: "Male" },
  { firstName: "Cynthia", lastName: "Dayrit", gender: "Female" },
  { firstName: "Eduardo", lastName: "Santiago", gender: "Male" },
  { firstName: "Marilou", lastName: "Gonzales", gender: "Female" },
  { firstName: "Fernando", lastName: "Bautista", gender: "Male" },
  { firstName: "Grace", lastName: "Ferrer", gender: "Female" },
  { firstName: "Ramon", lastName: "Villanueva", gender: "Male" },
  { firstName: "Aileen", lastName: "Romualdez", gender: "Female" },
].map((t, i) => ({ ...t, subject: SUBJECTS[i], order: i + 1 }));

async function main() {
  await connectDb();

  const adviser = await User.findOne({ email: ADVISER_EMAIL });
  if (!adviser || adviser.role !== "adviser") {
    console.error(`[seed] adviser not found for ${ADVISER_EMAIL} — run npm run seed:students first.`);
    process.exit(1);
  }

  const grade = String(adviser.grade);
  const strand = adviser.strand || "";
  const section = String(adviser.section || "");
  const academicYear = String(adviser.academicYear);
  const schoolId = adviser.schoolId;
  const school = adviser.school || {};

  console.log(`[seed] adviser=${ADVISER_EMAIL} advisory=Grade ${grade}${strand ? ` · ${strand}` : ""} - Block ${section} (S.Y. ${academicYear}) school=${school.name}`);
  const existing = await User.countDocuments({ role: "teacher", schoolId, grade, strand, section, academicYear });
  console.log(`[seed] existing teachers already assigned to this advisory: ${existing}`);

  const hash = await bcrypt.hash(TEACHER_PASSWORD, 10);
  const created = [];
  const skipped = [];

  for (const t of TEACHERS) {
    const email = `${t.firstName.replace(/[^A-Za-z]/g, "").toLowerCase()}.${t.lastName.replace(/[^A-Za-z]/g, "").toLowerCase()}@teacher.edu.ph`;
    const assignment = { grade, strand, section, academicYear, subject: t.subject, semester: SEMESTER };

    let teacher = await User.findOne({ email });
    if (!teacher) {
      teacher = await User.create({
        role: "teacher",
        email,
        password: hash,
        firstName: t.firstName,
        middleName: "",
        lastName: t.lastName,
        gender: t.gender,
        grade,
        strand,
        section: "",
        subject: t.subject,
        semester: SEMESTER,
        academicYear,
        schoolId,
        school: { id: String(schoolId), name: school.name, province: school.province, city: school.city, barangay: school.barangay },
        advisories: [],
        teachingLoad: [assignment],
        publicKey: "",
        privateKey: "",
        verifiedIps: [],
      });
      created.push(email);
      continue;
    }

    const hasAssignment = (teacher.teachingLoad || []).some(
      (a) => a.grade === grade && (a.strand || "") === strand && String(a.section) === section &&
        a.academicYear === academicYear && a.subject === t.subject && a.semester === SEMESTER
    );
    if (!hasAssignment) {
      teacher.teachingLoad.push(assignment);
      await teacher.save();
    }
    skipped.push(email);
  }

  console.log(`[seed] created ${created.length} teachers, ${skipped.length} already present.`);
  if (created.length) console.log(`[seed] sample email: ${created[0]} password: ${TEACHER_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
