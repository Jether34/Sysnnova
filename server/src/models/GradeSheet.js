import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    firstName: { type: String, required: true },
    middleName: { type: String, default: "" },
    lastName: { type: String, required: true },
    gender: { type: String, default: "" },
    // numeric 60-100 when the student has every component filled; null + incomplete=true
    // when the student was absent / has missing scores, so the adviser still sees them.
    grade: { type: mongoose.Schema.Types.Mixed, default: null },
    incomplete: { type: Boolean, default: false },
    ww: { type: Number, default: null },
    pt: { type: Number, default: null },
    qa: { type: Number, default: null },
    wwItems: { type: Number, default: null },
    ptItems: { type: Number, default: null },
    qaItems: { type: Number, default: null },
  },
  { _id: false }
);

const breakdownScoreSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    score: { type: Number, default: null },
    item: { type: Number, default: null },
  },
  { _id: false }
);

const breakdownSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["ww", "pt", "qa"], required: true },
    label: { type: String, default: "" },
    item: { type: Number, default: 0 },
    scores: [breakdownScoreSchema],
  },
  { _id: false }
);

const gradeSheetSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    teacherName: { type: String, default: "" },
    adviserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adviserName: { type: String, default: "" },

    subject: { type: String, required: true },
    semester: { type: String, required: true },
    academicYear: { type: String, required: true },

    gradeLevel: { type: String, required: true },
    strand: { type: String, default: "" },
    section: { type: String, required: true },
    specialization: { type: String, default: "" },
    tvlStrand: { type: String, default: "" },

    entries: [entrySchema],
    // Snapshot of every WW / PT / QA component and each student's raw score on it, so the
    // adviser and students can see exactly how a grade was computed (transparency).
    breakdown: [breakdownSchema],
    // Item totals the raw scores were scored out of (defaults 100). Lets teachers
    // allocate e.g. 150-item performance tasks for a more accessible computation.
    items: { type: { ww: Number, pt: Number, qa: Number }, default: { ww: 100, pt: 100, qa: 100 } },
    status: { type: String, enum: ["submitted", "published"], default: "submitted" },
    notes: { type: String, default: "" },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

gradeSheetSchema.index(
  {
    teacherId: 1,
    subject: 1,
    semester: 1,
    academicYear: 1,
    gradeLevel: 1,
    strand: 1,
    tvlStrand: 1,
    specialization: 1,
    section: 1,
  },
  { unique: true }
);
gradeSheetSchema.index({ adviserId: 1 });
gradeSheetSchema.index({ status: 1 });
gradeSheetSchema.index({ "entries.studentId": 1 });

export default mongoose.model("GradeSheet", gradeSheetSchema);
