import { createHash, randomInt } from "crypto";

export function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) code += randomInt(0, 10);
  return code;
}

export function hashCode(code) {
  return createHash("sha256").update(String(code)).digest("hex");
}

export function codeMatches(stored, code) {
  if (!stored || !stored.codeHash || !stored.expiresAt) return false;
  if (new Date(stored.expiresAt).getTime() <= Date.now()) return false;
  return stored.codeHash === hashCode(code);
}

export function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    const first = String(fwd).split(",")[0].trim();
    if (first) return first;
  }
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "";
}

export function maskEmail(email) {
  if (!email || !email.includes("@")) return email || "";
  const [user, domain] = email.split("@");
  const keep = Math.max(1, Math.min(3, user.length - 1));
  return `${user.slice(0, keep)}${"*".repeat(Math.max(2, user.length - keep))}@${domain}`;
}
