import mongoose from "mongoose";

const eventLogSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    action: { type: String, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    target: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

eventLogSchema.index({ createdAt: -1 });
eventLogSchema.index({ actor: 1, createdAt: -1 });

export default mongoose.model("EventLog", eventLogSchema);
