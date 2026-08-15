import mongoose from "mongoose";

const assessmentScoreSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    firstName: { type: String, required: true },
    middleName: { type: String, default: "" },
    lastName: { type: String, required: true },
    gender: { type: String, default: "" },
    score: { type: Number, default: null },
    // Per-student item total; falls back to the record-level `item` when null.
    item: { type: Number, default: null },
  },
  { _id: false }
);

const assessmentSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    teacherName: { type: String, default: "" },
    adviserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    subject: { type: String, required: true },
    semester: { type: String, required: true },
    academicYear: { type: String, required: true },

    gradeLevel: { type: String, required: true },
    strand: { type: String, default: "" },
    section: { type: String, required: true },
    specialization: { type: String, default: "" },
    tvlStrand: { type: String, default: "" },

    type: { type: String, enum: ["ww", "pt", "qa"], required: true },
    label: { type: String, required: true },
    title: { type: String, default: "" },
    item: { type: Number, required: true },

    // OMR answer key: array of correct answers, e.g. ["A","B","C","D",...] — index 0 = item 1
    answerKey: { type: [String], default: [] },

    scores: [assessmentScoreSchema],
  },
  { timestamps: true }
);

assessmentSchema.index({ teacherId: 1, subject: 1, semester: 1, academicYear: 1, gradeLevel: 1, strand: 1, section: 1 });
assessmentSchema.index({ adviserId: 1 });

export default mongoose.model("Assessment", assessmentSchema);
