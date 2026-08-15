import mongoose from "mongoose";

const userDeviceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    deviceName: { type: String, default: "" },
    platform: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userDeviceSchema.index({ userId: 1, isActive: 1 });
userDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export default mongoose.model("UserDevice", userDeviceSchema);