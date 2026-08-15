// In-memory ring buffer that captures server console output and HTTP request
// activity so the system administrator can inspect recent logs from the UI.

const MAX_LOGS = 2000;
const logs = [];

const LEVELS = ["error", "warn", "info", "http", "debug"];

function push(entry) {
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
}

export function logMessage(level, message, meta = {}) {
  if (!LEVELS.includes(level)) level = "info";
  push({ ts: Date.now(), level, message, meta, source: "console" });
}

export function logHttp({ method, path, status, ms, user }) {
  push({
    ts: Date.now(),
    level: "http",
    source: "http",
    message: `${method} ${path} ${status} ${ms}ms`,
    meta: { method, path, status, ms, user: user || "" },
  });
}

function toLine(level, args) {
  return args.map((a) => (typeof a === "string" ? a : safeStringify(a))).join(" ");
}

function safeStringify(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function installConsoleCapture() {
  const orig = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args) => {
    logMessage("info", toLine("info", args));
    orig.log(...args);
  };
  console.info = (...args) => {
    logMessage("info", toLine("info", args));
    orig.info(...args);
  };
  console.warn = (...args) => {
    logMessage("warn", toLine("warn", args));
    orig.warn(...args);
  };
  console.error = (...args) => {
    logMessage("error", toLine("error", args));
    orig.error(...args);
  };

  return orig;
}

export function getLogs({ level, q, source, limit = 200 } = {}) {
  let out = logs;
  if (level && LEVELS.includes(level)) out = out.filter((l) => l.level === level);
  if (source) out = out.filter((l) => l.source === source);
  if (q) {
    const needle = String(q).toLowerCase();
    out = out.filter((l) => l.message.toLowerCase().includes(needle));
  }
  const count = Math.min(Number(limit) || 200, MAX_LOGS);
  return out.slice(-count).reverse();
}
