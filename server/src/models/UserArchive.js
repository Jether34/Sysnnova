import mongoose from "mongoose";

const userArchiveSchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    role: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    middleName: { type: String, default: "" },
    lastName: { type: String, required: true },
    gender: { type: String, default: "" },
    grade: { type: String, default: "" },
    strand: { type: String, default: "" },
    specialization: { type: String, default: "" },
    section: { type: String, default: "" },
    schoolId: { type: mongoose.Schema.Types.ObjectId, default: null },
    school: { type: mongoose.Schema.Types.Mixed, default: null },
    subject: { type: String, default: "" },
    semester: { type: String, default: "" },
    academicYear: { type: String, default: "" },
    advisories: { type: [mongoose.Schema.Types.Mixed], default: [] },
    teachingLoad: { type: [mongoose.Schema.Types.Mixed], default: [] },
    archivedAt: { type: Date, default: Date.now },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

userArchiveSchema.index({ email: 1 });
userArchiveSchema.index({ schoolId: 1, role: 1 });

export default mongoose.model("UserArchive", userArchiveSchema);
