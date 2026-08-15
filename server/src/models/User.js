import mongoose from "mongoose";

const advisorySchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true },
    strand: { type: String, default: "", trim: true },
    tvlStrand: { type: String, default: "", trim: true },
    specialization: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    academicYear: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const assignmentSchema = new mongoose.Schema(
  {
    grade: { type: String, required: true, trim: true },
    strand: { type: String, default: "", trim: true },
    tvlStrand: { type: String, default: "", trim: true },
    specialization: { type: String, default: "", trim: true },
    section: { type: String, default: "", trim: true },
    academicYear: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    semester: { type: String, required: true, trim: true },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["adviser", "teacher", "student", "admin"], required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, default: "", trim: true },
    lastName: { type: String, required: true, trim: true },
    gender: { type: String, enum: ["Male", "Female", ""], default: "" },

    grade: { type: String, required: true },
    strand: { type: String, default: "" },
    tvlStrand: { type: String, default: "" },
    specialization: { type: String, default: "" },
    section: { type: String, default: "" },

    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", default: null },
    school: {
      type: {
        id: String,
        name: String,
        province: String,
        city: String,
        barangay: String,
      },
      default: null,
    },

    subject: { type: String, default: "" },
    semester: { type: String, default: "" },
    academicYear: { type: String, required: true },

    // Additional advisory classes (role: adviser) and subject-teaching classes (adviser/teacher)
    advisories: { type: [advisorySchema], default: [] },
    teachingLoad: { type: [assignmentSchema], default: [] },

    // E2E messaging keys (server-generated RSA-OAEP 4096)
    publicKey: { type: String, default: "" },
    privateKey: { type: String, default: "" },

    // Login security: IPs the account has signed in from (first = registered IP)
    verifiedIps: { type: [String], default: [] },
    // Persistent device identifier (set on first login)
    deviceId: { type: String, default: "" },

    // One-time email verification code (login approval / password reset)
    emailCode: {
      type: {
        codeHash: String,
        expiresAt: Date,
        purpose: { type: String, enum: ["login", "reset"] },
      },
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ schoolId: 1, role: 1, grade: 1, strand: 1, tvlStrand: 1, specialization: 1, section: 1, academicYear: 1 });

export default mongoose.model("User", userSchema);
