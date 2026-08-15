import bcrypt from "bcryptjs";
import { connectDb } from "../src/config/db.js";
import User from "../src/models/User.js";
import School from "../src/models/School.js";

const ADVISER_EMAIL = process.env.ADVISER_EMAIL || "jethergarque8@gmail.com";
const ADVISER_PASSWORD = process.env.ADVISER_PASSWORD || "secret123";
const STUDENT_PASSWORD = process.env.STUDENT_PASSWORD || "secret123";
const TARGET = 40;

// Recreates the full demo setup after the e2e suite wipes the database.
const SCHOOL = {
  name: process.env.SCHOOL_NAME || "PALAWAN NATIONAL SCHOOL",
  province: process.env.SCHOOL_PROVINCE || "Palawan",
  city: process.env.SCHOOL_CITY || "City of Puerto Princesa",
  barangay: process.env.SCHOOL_BARANGAY || "MANGGAHAN (POB.)",
};
const ADVISER = {
  firstName: "Jether",
  middleName: "",
  lastName: "Garque",
  gender: "Male",
  grade: "11",
  strand: "TVL",
  section: "3",
  academicYear: "2026-27",
};

// 40 Filipino demo students (20 male, 20 female) for one advisory class.
const STUDENTS = [
  // male
  { firstName: "Jose Gabriel", lastName: "Santos" },
  { firstName: "Miguel Angelo", lastName: "Reyes" },
  { firstName: "Carlo Miguel", lastName: "Bautista" },
  { firstName: "Rafael Antonio", lastName: "Garcia" },
  { firstName: "Andres Bonifacio", lastName: "Dela Cruz" },
  { firstName: "Juan Miguel", lastName: "Aquino" },
  { firstName: "Paolo Lorenzo", lastName: "Mendoza" },
  { firstName: "Gabriel", lastName: "Cruz" },
  { firstName: "Marco Antonio", lastName: "Villanueva" },
  { firstName: "Nathaniel", lastName: "Ramos" },
  { firstName: "Ezekiel", lastName: "Torres" },
  { firstName: "Lorenzo", lastName: "Salvador" },
  { firstName: "Nathaniel", lastName: "Domingo" },
  { firstName: "Kristoffer", lastName: "Gatchalian" },
  { firstName: "Emmanuel", lastName: "Navarro" },
  { firstName: "Dominic", lastName: "Salazar" },
  { firstName: "Angelo", lastName: "Mercado" },
  { firstName: "Diego", lastName: "Gutierrez" },
  { firstName: "Francis", lastName: "Enriquez" },
  { firstName: "Jericho", lastName: "Manalo" },
  // female
  { firstName: "Maria Sophia", lastName: "Villanueva" },
  { firstName: "Angelica Marie", lastName: "Ramos" },
  { firstName: "Kyla Beatrice", lastName: "Santos" },
  { firstName: "Samantha Nicole", lastName: "Garcia" },
  { firstName: "Danielle Mae", lastName: "Cruz" },
  { firstName: "Patricia Anne", lastName: "Reyes" },
  { firstName: "Andrea Louise", lastName: "Bautista" },
  { firstName: "Bianca Marie", lastName: "Dela Cruz" },
  { firstName: "Camille Anne", lastName: "Aquino" },
  { firstName: "Denise Nicole", lastName: "Mendoza" },
  { firstName: "Elyse Marie", lastName: "Torres" },
  { firstName: "Francesca May", lastName: "Navarro" },
  { firstName: "Gabrielle Anne", lastName: "Salazar" },
  { firstName: "Hannah Grace", lastName: "Domingo" },
  { firstName: "Isabel Marie", lastName: "Gatchalian" },
  { firstName: "Jasmine Rae", lastName: "Mercado" },
  { firstName: "Katrina Mae", lastName: "Gutierrez" },
  { firstName: "Loraine Ann", lastName: "Enriquez" },
  { firstName: "Micah Joy", lastName: "Manalo" },
  { firstName: "Nicole Anne", lastName: "Salvador" },
].map((s, i) => ({ ...s, gender: i < 20 ? "Male" : "Female", order: i + 1 }));

async function ensureSchool() {
  let school = await School.findOne(SCHOOL);
  if (!school) {
    school = await School.create(SCHOOL);
    console.log(`[seed] created school: ${school.name}`);
  }
  return school;
}

async function ensureAdviser() {
  let adviser = await User.findOne({ email: ADVISER_EMAIL });
  if (adviser && adviser.role !== "adviser") {
    console.error(`[seed] account exists but role=${adviser.role}, expected adviser`);
    process.exit(1);
  }
  // Existing account: use its own advisory/school as-is (only backfill a missing school reference).
  if (adviser) {
    if (!adviser.schoolId || !adviser.school) {
      const school = await ensureSchool();
      adviser.schoolId = school._id;
      adviser.school = { id: String(school._id), name: school.name, province: school.province, city: school.city, barangay: school.barangay };
      await adviser.save();
    }
    return adviser;
  }
  const school = await ensureSchool();
  const hash = await bcrypt.hash(ADVISER_PASSWORD, 10);
  const advisory = { grade: ADVISER.grade, strand: ADVISER.strand, section: ADVISER.section, academicYear: ADVISER.academicYear };
  adviser = await User.create({
    role: "adviser",
    email: ADVISER_EMAIL,
    password: hash,
    firstName: ADVISER.firstName,
    middleName: ADVISER.middleName,
    lastName: ADVISER.lastName,
    gender: ADVISER.gender,
    grade: ADVISER.grade,
    strand: ADVISER.strand,
    section: ADVISER.section,
    academicYear: ADVISER.academicYear,
    subject: "",
    semester: "",
    schoolId: school._id,
    school: { id: String(school._id), name: school.name, province: school.province, city: school.city, barangay: school.barangay },
    advisories: [advisory],
    teachingLoad: [],
    publicKey: "",
    privateKey: "",
    verifiedIps: [],
  });
  console.log(`[seed] created adviser: ${ADVISER.firstName} ${ADVISER.lastName} <${ADVISER_EMAIL}>`);
  return adviser;
}

async function main() {
  await connectDb();

  const adviser = await ensureAdviser();
  const school = adviser.school || {};

  const grade = String(adviser.grade);
  const strand = adviser.strand || "";
  const section = String(adviser.section || "");
  const academicYear = String(adviser.academicYear);
  const schoolId = adviser.schoolId;

  const match = { role: "student", schoolId, grade, strand, section, academicYear };
  const existing = await User.countDocuments(match);
  console.log(`[seed] adviser=${ADVISER_EMAIL} advisory=Grade ${grade}${strand ? ` · ${strand}` : ""} - Block ${section} (S.Y. ${academicYear}) school=${school.name}`);
  console.log(`[seed] existing students in advisory: ${existing}`);

  if (existing >= TARGET) {
    console.log(`[seed] already ${existing} students, nothing to do.`);
    process.exit(0);
  }

  const toCreate = STUDENTS.slice(0, TARGET - existing);
  const hash = await bcrypt.hash(STUDENT_PASSWORD, 10);
  const taken = new Set((await User.find({ email: /student\.edu\.ph$/ }, { email: 1 })).map((u) => u.email));

  const docs = toCreate.map((s) => {
    let email = `${s.firstName.replace(/[^A-Za-z]/g, "").toLowerCase()}.${s.lastName.replace(/[^A-Za-z]/g, "").toLowerCase()}@student.edu.ph`;
    if (taken.has(email)) email = `${s.order}.${email}`;
    taken.add(email);
    return {
      role: "student",
      email,
      password: hash,
      firstName: s.firstName,
      middleName: "",
      lastName: s.lastName,
      gender: s.gender,
      grade,
      strand,
      section,
      schoolId,
      school: { id: String(schoolId), name: school.name, province: school.province, city: school.city, barangay: school.barangay },
      subject: "",
      semester: "",
      academicYear,
      advisories: [],
      teachingLoad: [],
      publicKey: "",
      privateKey: "",
      verifiedIps: [],
    };
  });

  await User.insertMany(docs);
  const total = await User.countDocuments(match);
  console.log(`[seed] created ${docs.length} students. total in advisory now: ${total}`);
  console.log(`[seed] sample email: ${docs[0].email} password: ${STUDENT_PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
