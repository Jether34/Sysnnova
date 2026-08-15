import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "jsgarque@fit.edu.ph";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345678";

// Upsert the system admin account so a fresh database always has an administrator.
export async function seedAdmin() {
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== "admin") existing.role = "admin";
    if (!existing.password || !(await bcrypt.compare(ADMIN_PASSWORD, existing.password))) {
      existing.password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    }
    await existing.save();
    return { created: false, email: ADMIN_EMAIL };
  }

  await User.create({
    role: "admin",
    email: ADMIN_EMAIL,
    password: await bcrypt.hash(ADMIN_PASSWORD, 10),
    firstName: "System",
    middleName: "",
    lastName: "Administrator",
    gender: "",
    grade: "N/A",
    strand: "",
    section: "",
    schoolId: null,
    school: null,
    subject: "",
    semester: "",
    academicYear: "N/A",
  });

  return { created: true, email: ADMIN_EMAIL };
}
