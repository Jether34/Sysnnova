import mongoose from "mongoose";

const messageArchiveSchema = new mongoose.Schema(
  {
    originalMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    wrappedKey: { type: String, required: true },
    selfCiphertext: { type: String, default: "" },
    selfIv: { type: String, default: "" },
    selfWrappedKey: { type: String, default: "" },
    attachments: { type: [], default: [] },
    read: { type: Boolean, default: false },
    originalCreatedAt: { type: Date, required: true },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

messageArchiveSchema.index({ archivedBy: 1, createdAt: -1 });
messageArchiveSchema.index({ senderId: 1, recipientId: 1 });

export default mongoose.model("MessageArchive", messageArchiveSchema);
