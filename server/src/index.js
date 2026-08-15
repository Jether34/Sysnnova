import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import { connectDb } from "./config/db.js";
import { env } from "./config/index.js";
import { verifySmtp } from "./services/mailer.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import schoolRoutes from "./routes/schools.js";
import gradeRoutes from "./routes/grades.js";
import assessmentRoutes from "./routes/assessments.js";
import messageRoutes from "./routes/messages.js";
import adminRoutes from "./routes/admin.js";
import dbMonitorRoutes from "./routes/dbmonitor.js";
import { recordRequest } from "./services/traffic.js";
import { installConsoleCapture, logHttp } from "./services/logs.js";
import { seedAdmin } from "./services/seed-admin.js";

installConsoleCapture();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
const ALLOWED_ORIGINS = new Set([
  env.clientOrigin,
  "http://localhost:5173",
  "http://localhost",
  "http://localhost:8080",
  "capacitor://localhost",
  "ionic://localhost",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isLocal = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin === "null" || isLocal)) {
    res.setHeader("Access-Control-Allow-Origin", origin === "null" ? "null" : origin);
  } else if (origin) {
    res.setHeader("Access-Control-Allow-Origin", env.clientOrigin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Refresh-Token, X-Device-Id, X-Device-Name, X-Platform");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", async (req, res) => {
  const smtp = await verifySmtp();
  res.json({ ok: true, uptime: process.uptime(), smtp });
});

app.use("/api", (req, _res, next) => {
  recordRequest(req.path);
  next();
});

app.use("/api", (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    logHttp({
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      ms: Date.now() - started,
      user: req.userId || "",
    });
  });
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin", dbMonitorRoutes);

app.use((err, req, res, next) => {
  console.error("[error]", err.message);
  res.status(500).json({ error: err.message || "Server error" });
});

const start = async () => {
  await connectDb();
  try {
    const seed = await seedAdmin();
    console.log(`[seed] admin ${seed.created ? "created" : "verified"}: ${seed.email}`);
  } catch (err) {
    console.error("[seed] admin seed failed:", err.message);
  }
  app.listen(env.port, () => console.log(`[server] listening on http://localhost:${env.port}`));
};

process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

start();
