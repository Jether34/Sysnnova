import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { env } from "../config/index.js";
import { trackActiveUser } from "../services/traffic.js";
import Session from "../models/Session.js";

export const ACCESS_DAYS = 7;
export const REFRESH_DAYS = 180;

export function signToken(user, deviceId = "") {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, type: "access", deviceId },
    env.jwtSecret,
    { expiresIn: `${ACCESS_DAYS}d` }
  );
}

export function signRefreshToken(user, deviceId = "", sessionId = "", refreshTokenString = "") {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, type: "refresh", deviceId, sessionId, token: refreshTokenString },
    env.jwtSecret,
    { expiresIn: `${REFRESH_DAYS}d` }
  );
}

export function hashRefreshToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshTokenString() {
  return randomBytes(32).toString("hex");
}

export async function createSession(user, { deviceId, deviceName, platform, tokenString, ip, userAgent }) {
  const tokenHash = tokenString ? hashRefreshToken(tokenString) : null;
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    userId: user._id,
    deviceId,
    refreshTokenHash: tokenHash,
    ipAddress: ip,
    userAgent,
    expiresAt,
  });
  return session;
}

export async function revokeSession(sessionId) {
  await Session.updateOne({ _id: sessionId }, { revokedAt: new Date() });
}

export async function revokeAllSessionsForUser(userId, exceptSessionId = null) {
  const filter = { userId, revokedAt: null };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  await Session.updateMany(filter, { revokedAt: new Date() });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: REFRESH_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function clearAuthCookies(res) {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  res.clearCookie("refresh", { httpOnly: true, sameSite: "lax" });
}

export function extractToken(req) {
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return req.headers.authorization.slice(7).trim();
  }
  return req.cookies?.token || null;
}

export function extractRefreshToken(req) {
  return req.headers["x-refresh-token"] || req.headers["x-refresh-token".toLowerCase()] || req.cookies?.refresh || null;
}

export async function authRequired(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.type !== "access") {
      return res.status(401).json({ error: "Invalid token type." });
    }

    if (payload.sessionId) {
      const Session = (await import("../models/Session.js")).default;
      const session = await Session.findById(payload.sessionId).exec();
      if (!session || session.revokedAt || new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Session expired, please login again" });
      }
      if (payload.deviceId && session.deviceId && payload.deviceId !== session.deviceId) {
        return res.status(401).json({ error: "Session expired, please login again" });
      }
      session.lastUsedAt = new Date();
      session.save().catch(() => {});
    }

    req.userId = payload.id;
    req.userRole = payload.role;
    req.userEmail = payload.email || "";
    req.userDeviceId = payload.deviceId || "";
    req.userSessionId = payload.sessionId || null;
    trackActiveUser(payload.id);
    return next();
  } catch {
    return res.status(401).json({ error: "Session expired, please login again" });
  }
}

export async function sessionGuard(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.userId = payload.id;
    req.userRole = payload.role;
    req.userEmail = payload.email || "";
    req.userDeviceId = payload.deviceId || "";
    const session = await Session.findById(payload.sessionId || payload.id).exec();
    if (!session) return res.status(401).json({ error: "Session expired, please login again" });
    if (session.revokedAt) return res.status(401).json({ error: "Session expired, please login again" });
    if (new Date(session.expiresAt) < new Date()) return res.status(401).json({ error: "Session expired, please login again" });
    if (session.deviceId && payload.deviceId && session.deviceId !== payload.deviceId) {
      return res.status(401).json({ error: "Session expired, please login again" });
    }
    session.lastUsedAt = new Date();
    session.save().catch(() => {});
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please login again" });
  }
}

export function roleGuard(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: "You are not allowed to do this action" });
    }
    return next();
  };
}
