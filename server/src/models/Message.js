import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
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
    // End-to-end encrypted payload (hybrid AES-GCM + RSA-OAEP)
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    wrappedKey: { type: String, required: true },
    // Self-copy encrypted to the sender's own key so they can view their sent messages
    selfCiphertext: { type: String, default: "" },
    selfIv: { type: String, default: "" },
    selfWrappedKey: { type: String, default: "" },
    // File attachments (not encrypted, stored as plain URLs)
    attachments: { type: [attachmentSchema], default: [] },
    read: { type: Boolean, default: false },
    // Client-generated operation id so offline sends are idempotent on sync replay
    clientOpId: { type: String, default: "" },
  },
  { timestamps: true }
);

messageSchema.index({ senderId: 1, recipientId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, read: 1 });
messageSchema.index({ senderId: 1, clientOpId: 1 }, { unique: true, sparse: true });

export default mongoose.model("Message", messageSchema);
