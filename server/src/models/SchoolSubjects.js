import mongoose from "mongoose";

const schoolSubjectsSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    semester: { type: String, required: true, trim: true },
    jhs: { type: [String], default: [] },
    shs: { type: [String], default: [] },
  },
  { timestamps: true }
);

schoolSubjectsSchema.index({ schoolId: 1, semester: 1 }, { unique: true });

export default mongoose.model("SchoolSubjects", schoolSubjectsSchema);
