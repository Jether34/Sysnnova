import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import User from './src/models/User.js';
import School from './src/models/School.js';
import bcrypt from 'bcryptjs';

await mongoose.connect(process.env.MONGO_URI);

const b = {
  role: "teacher",
  firstName: "Test",
  lastName: "User",
  email: "signup-test@test.com",
  password: "test123",
  grade: "11",
  strand: "STEM",
  section: "1",
  academicYear: "2025-2026",
  subject: "General Mathematics",
  semester: "1st Semester, 1st Quarter",
  school: { name: "STI College", province: "Pampanga", city: "City of San Fernando", barangay: "Dolores" }
};

console.log('Step 1: Find school');
const schoolName = String(b.school?.name || "").trim();
const province = String(b.school?.province || "").trim();
const city = String(b.school?.city || "").trim();
const barangay = String(b.school?.barangay || "").trim();
const school = await School.findOne({ name: schoolName, province, city, barangay });
console.log('School found:', school ? 'YES' : 'NO');

console.log('Step 2: Hash password');
const hash = await bcrypt.hash(b.password, 10);
console.log('Password hashed');

console.log('Step 3: Check duplicate email');
const existingUser = await User.findOne({ email: b.email.toLowerCase().trim() });
console.log('Duplicate email check:', existingUser ? 'EXISTS' : 'OK');

console.log('Step 4: Create user');
const keys = b.role === "student" ? {} : { publicKey: "test", privateKey: "test" };
const user = await User.create({
  role: b.role,
  email: b.email.toLowerCase().trim(),
  password: hash,
  firstName: b.firstName,
  middleName: b.middleName || "",
  lastName: b.lastName,
  gender: b.gender || "",
  grade: String(b.grade),
  strand: b.strand || "",
  tvlStrand: b.tvlStrand || "",
  specialization: b.specialization || "",
  section: b.section || "",
  schoolId: school._id,
  school: { id: school._id, name: school.name, province: school.province, city: school.city, barangay: school.barangay },
  subject: b.subject || "",
  semester: b.semester || "",
  academicYear: b.academicYear,
  advisories: [],
  teachingLoad: [],
  publicKey: keys.publicKey || "",
  privateKey: keys.privateKey || "",
  verifiedIps: [],
  deviceId: "",
});
console.log('User created:', user.email);

await mongoose.disconnect();
console.log('All steps completed successfully!');