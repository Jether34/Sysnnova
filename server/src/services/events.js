import EventLog from "../models/EventLog.js";

export async function recordEvent({ type, action, actor = null, actorEmail = "", actorRole = "", target = "", meta = {}, ip = "" }) {
  try {
    await EventLog.create({ type, action, actor, actorEmail, actorRole, target, meta, ip });
  } catch (err) {
    console.error("[event] failed to record", type, err.message);
  }
}
