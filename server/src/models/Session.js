import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    refreshTokenHash: { type: String, required: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ refreshTokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 });

export default mongoose.model("Session", sessionSchema);