import mongoose from "mongoose";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    barangay: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

schoolSchema.index({ name: 1, province: 1, city: 1, barangay: 1 }, { unique: true });

export default mongoose.model("School", schoolSchema);
