import axios from "axios";
import { idb } from "./idb.js";
import { apiBaseURL } from "../utils/platform.js";

const BASE_URL = apiBaseURL();

const PING_INTERVAL = 20000;
const CACHE_CAP = 300;

let online = typeof navigator !== "undefined" ? navigator.onLine : true;
let syncing = false;
let needsAuth = false;
let pendingCount = 0;
let lastError = "";
let user = null;
let timer = null;
let probing = false;
let initialProbeResolved = false;
let initialProbePromise = null;
const listeners = new Set();

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}

export const uuid = uid;

export function objectId() {
  const t = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  let r = "";
  for (let i = 0; i < 16; i++) r += Math.floor(Math.random() * 16).toString(16);
  return t + r;
}

function userKey() {
  return user && user.id ? String(user.id) + "::" : "anon::";
}

function serializeParams(params) {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? "?" + s : "";
}

function cacheKey(config) {
  return userKey() + (config.method || "get").toUpperCase() + " " + (config.url || "") + serializeParams(config.params);
}

function groupForUrl(url) {
  if (url.startsWith("/assessments")) return ["/assessments"];
  if (url.startsWith("/grades")) return ["/grades"];
  if (url.startsWith("/messages")) return ["/messages"];
  if (url.startsWith("/users/me/classes") || url.startsWith("/users/me/advisories")) return ["/users/me/classes", "/users/me/advisories"];
  if (url.startsWith("/users/me")) return ["/users/me"];
  if (url.startsWith("/auth/me")) return ["/auth/me", "/users/me"];
  if (url.startsWith("/admin")) return ["/admin"];
  return [];
}

export function isQueuable(config) {
  const url = config.url || "";
  if (config.skipQueue) return false;
  if (/^\/(auth|admin)\//.test(url)) return false;
  if (/\/upload/.test(url)) return false;
  return true;
}

export function getStatus() {
  return { online, syncing, pending: pendingCount, needsAuth, lastError };
}

function emit() {
  const status = getStatus();
  for (const fn of listeners) fn(status);
}

export function setOnline(v) {
  if (online === v) return;
  online = v;
  emit();
  if (v) {
    flush();
    maybePrefetch(true);
  }
}

export function isOnline() {
  return online;
}

async function probeOnce() {
  if (probing) return;
  probing = true;
  try {
    const res = await axios.get(BASE_URL + "/health", { skipQueue: true, timeout: 8000 });
    if (res.status >= 200 && res.status < 300 && !online) setOnline(true);
  } catch (err) {
    if (!err.response && online) setOnline(false);
  } finally {
    probing = false;
    initialProbeResolved = true;
    if (initialProbePromise) {
      initialProbePromise.resolve();
      initialProbePromise = null;
    }
  }
}

export function waitForInitialProbe() {
  if (initialProbeResolved) return Promise.resolve();
  if (!initialProbePromise) {
    let resolveRef;
    initialProbePromise = new Promise((resolve) => {
      resolveRef = resolve;
    });
    initialProbePromise.resolve = resolveRef;
    if (!probing) probeOnce();
  }
  return initialProbePromise;
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(getStatus());
  return () => listeners.delete(fn);
}

export function setUser(u) {
  user = u || { id: "offline-user" };
  console.log("[offline] User set:", user.id);
}

export function getUser() {
  if (!user) {
    user = { id: "offline-user" };
  }
  return user;
}

export function markNeedsAuth(v) {
  needsAuth = Boolean(v);
  emit();
  if (!v) flush();
}

// ---- request/response data helpers ----

function parseData(config) {
  let data = config.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? data : null;
}

function parseCachedData(value) {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" ? value : null;
}

function classParamsFromBody(body) {
  return {
    grade: body.grade,
    strand: body.strand,
    section: body.section,
    ay: body.academicYear,
    subject: body.subject,
    specialization: body.specialization,
    tvlStrand: body.tvlStrand,
  };
}

function matchesClass(body, params) {
  const p = params || {};
  const b = body || {};
  const eq = (a, c) => (a === undefined || a === null || a === "" || c === undefined || c === null || c === "") || String(a) === String(c);
  if (!eq(b.section, p.section) || !eq(b.subject, p.subject)) return false;
  if (!eq(b.grade, p.grade) || !eq(b.strand, p.strand)) return false;
  if (!eq(b.academicYear, p.ay)) return false;
  if (!eq(b.semester, p.semester)) return false;
  if (!eq(b.specialization, p.specialization)) return false;
  if (!eq(b.tvlStrand, p.tvlStrand)) return false;
  return true;
}

// ---- optimistic response builders ----

async function buildOptimistic(config) {
  const method = (config.method || "get").toUpperCase();
  const url = config.url || "";
  const body = parseData(config) || {};
  const now = Date.now();
  const currentUser = getUser();

  try {
    if (url === "/assessments" && method === "POST") {
      const listKey = cacheKey({ method: "get", url: "/assessments", params: classParamsFromBody(body) });
      let roster = [];
      try {
        const entry = await idb.get("cache", listKey);
        if (entry?.data?.assessments?.length) roster = entry.data.assessments[0].scores || [];
      } catch {
        /* ignore */
      }
      if (!roster.length) {
        try {
          const { subject, ...rosterParams } = classParamsFromBody(body);
          const rosterKey = cacheKey({ method: "get", url: "/grades/roster", params: rosterParams });
          const entry = await idb.get("cache", rosterKey);
          if (Array.isArray(entry?.data?.students)) {
            roster = entry.data.students.map((s) => ({
              studentId: s.id,
              firstName: s.firstName,
              middleName: s.middleName,
              lastName: s.lastName,
              gender: s.gender,
            }));
          }
        } catch {
          /* ignore */
        }
      }
      const assessment = {
        _id: body._id || uid(),
        teacherId: currentUser.id,
        subject: String(body.subject || ""),
        title: String(body.subject || ""),
        label: String(body.label || ""),
        item: Number(body.item) > 0 ? Number(body.item) : 20,
        type: ["ww", "pt", "qa"].includes(body.type) ? body.type : "ww",
        semester: body.semester || "",
        academicYear: body.academicYear || "",
        gradeLevel: body.grade || "",
        strand: body.strand || "",
        section: body.section || "",
        specialization: body.specialization || "",
        tvlStrand: body.tvlStrand || "",
        scores: (roster || []).map((s) => ({ ...s, score: null, item: null })),
        pending: true,
      };
      return { message: "Component saved offline — will sync when you're back online.", assessment };
    }

    if (url.startsWith("/assessments/") && method === "PUT") {
      const id = url.split("/")[2];
      let merged = {
        _id: id,
        label: body.label,
        title: body.title,
        item: Number(body.item) > 0 ? Number(body.item) : 20,
        type: ["ww", "pt", "qa"].includes(body.type) ? body.type : "",
        scores: (body.scores || []).map((s) => ({ studentId: s.studentId, score: s.score ?? null, item: s.item ?? null })),
        pending: true,
      };
      try {
        const all = await idb.getAll("cache");
        for (const e of all) {
          const cached = parseCachedData(e.data) || {};
          const list = cached.assessments;
          if (!Array.isArray(list)) continue;
          const found = list.find((a) => String(a._id) === String(id));
          if (found) {
            const byId = new Map((found.scores || []).map((s) => [String(s.studentId), s]));
            for (const s of body.scores || []) {
              const cur = byId.get(String(s.studentId));
              if (cur) {
                cur.score = s.score === null || s.score === undefined || s.score === "" ? null : Number(s.score);
                cur.item = s.item ?? cur.item ?? null;
              } else {
                byId.set(String(s.studentId), { studentId: s.studentId, score: s.score ?? null, item: s.item ?? null });
              }
            }
            merged = { ...found, ...merged, type: found.type || merged.type, scores: [...byId.values()] };
            break;
          }
        }
      } catch {
        /* ignore */
      }
      return { message: "Scores saved offline — will sync when you're back online.", assessment: merged };
    }

    if (url.startsWith("/assessments/") && method === "DELETE") {
      return { ok: true, message: "Component removed offline — will sync when you're back online." };
    }

    if (url === "/messages" && method === "POST") {
      const message = {
        id: "local-" + uid(),
        senderId: currentUser.id,
        recipientId: body.recipientId,
        ciphertext: body.ciphertext,
        iv: body.iv,
        wrappedKey: body.wrappedKey,
        selfCiphertext: body.selfCiphertext || "",
        selfIv: body.selfIv || "",
        selfWrappedKey: body.selfWrappedKey || "",
        attachments: Array.isArray(body.attachments) ? body.attachments : [],
        createdAt: new Date(now).toISOString(),
        pending: true,
      };
      return { message: { id: message.id, createdAt: message.createdAt }, _stub: message };
    }

    if (url === "/assessments/submit" || url === "/assessments/submit-bulk") {
      return { message: "Grades saved offline — they'll be routed to the adviser when you're back online." };
    }

    if (url === "/grades/publish" || /^\/grades\/[^/]+\/(publish|unpublish)$/.test(url)) {
      return { message: "Saved offline — students will be updated when you're back online." };
    }

    if (method === "DELETE" && url.startsWith("/messages/conversation/")) {
      return { message: "Conversation cleared offline — will sync when you're back online." };
    }

    return { message: "Saved offline — will sync when you're back online." };
  } catch (err) {
    console.error("[offline] buildOptimistic error:", err);
    return { message: "Saved offline — will sync when you're back online." };
  }
}

export function syntheticResponse(data, config) {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

// ---- cache helpers ----

export async function cacheResponse(config, data) {
  if (config.responseType === "blob") return;
  try {
    const key = cacheKey(config);
    const all = await idb.getAll("cache");
    if (all.length >= CACHE_CAP) {
      const oldest = [...all].sort((a, b) => (a.at || 0) - (b.at || 0))[0];
      if (oldest) await idb.delete("cache", oldest.key);
    }
    await idb.put("cache", { key, data: parseCachedData(data), at: Date.now() });
  } catch {
    /* ignore */
  }
}

export async function readCache(config) {
  try {
    const entry = await idb.get("cache", cacheKey(config));
    return entry ? parseCachedData(entry.data) : null;
  } catch {
    return null;
  }
}

// ---- outbox + cache application ----

async function applyToCache(op) {
  const url = op.url || "";
  const body = parseData(op) || op.data || {};
  const optimistic = op.optimistic || {};
  try {
    const all = await idb.getAll("cache");
    const prefixes = groupForUrl(url);
    const changed = [];
    for (const e of all) {
      const path = e.key.slice(e.key.indexOf(" ") + 1).split("?")[0];
      if (!prefixes.some((p) => path.startsWith(p))) continue;
      let mutated = false;
      if (url === "/assessments" || (url.startsWith("/assessments/") && op.method !== "POST")) {
        const params = keyToParams(e.key);
        if (!matchesClass(body, params)) continue;
        const cached = parseCachedData(e.data) || {};
        const list = cached.assessments;
        if (!Array.isArray(list)) continue;
        const m = optimistic.assessment;
        if (op.method === "POST") {
          if (m && !list.some((a) => String(a._id) === String(m._id))) list.push(m);
          mutated = true;
        } else if (op.method === "PUT") {
          if (m) {
            const i = list.findIndex((a) => String(a._id) === String(m._id));
            if (i !== -1) list[i] = m;
          }
          mutated = true;
        } else if (op.method === "DELETE") {
          const id = url.split("/")[2];
          const before = list.length;
          const kept = list.filter((a) => String(a._id) !== String(id));
          if (kept.length !== before) {
            cached.assessments = kept;
            mutated = true;
          }
        }
        if (mutated) e.data = cached;
      } else if (url === "/messages" && op.method === "POST" && optimistic._stub) {
        const peer = keyPeer(e.key);
        if (!peer) continue;
        const { recipientId, senderId } = optimistic._stub;
        if (peer !== String(recipientId) && peer !== String(senderId)) continue;
        const cachedMsg = parseCachedData(e.data) || {};
        const list = cachedMsg.messages;
        if (!Array.isArray(list)) continue;
        if (!list.some((m) => String(m.id) === String(optimistic._stub.id))) list.push(optimistic._stub);
        e.data = cachedMsg;
        mutated = true;
      }
      if (mutated) {
        e.at = Date.now();
        changed.push(e);
      }
    }
    if (changed.length) await idb.bulkPut("cache", changed);
  } catch {
    /* ignore */
  }
}

function keyToParams(key) {
  const q = key.split(" ").pop() || "";
  const idx = q.indexOf("?");
  if (idx === -1) return {};
  const params = {};
  for (const [k, v] of new URLSearchParams(q.slice(idx + 1))) params[k] = v;
  return params;
}

function keyPeer(key) {
  const path = (key.split(" ").pop() || "").split("?")[0];
  const m = path.match(/^\/messages\/([^/]+)$/);
  return m ? m[1] : null;
}

export async function enqueueWrite(config) {
  try {
    const id = uid();
    const op = {
      key: id,
      id,
      method: (config.method || "post").toUpperCase(),
      url: config.url,
      params: config.params,
      data: config.data,
      createdAt: Date.now(),
    };
    op.optimistic = await buildOptimistic(config);
    await idb.put("outbox", op);
    await applyToCache(op);
    pendingCount = await idb.count("outbox").catch(() => pendingCount);
    emit();
    return syntheticResponse(op.optimistic, config);
  } catch (err) {
    console.error("[offline] enqueueWrite error:", err);
    return syntheticResponse({ message: "Saved offline — will sync when you're back online." }, config);
  }
}

export async function applyWriteToCache(config) {
  try {
    const op = {
      id: uid(),
      method: (config.method || "post").toUpperCase(),
      url: config.url,
      params: config.params,
      data: config.data,
      createdAt: Date.now(),
    };
    op.optimistic = await buildOptimistic(config);
    await applyToCache(op);
  } catch (err) {
    console.error("[offline] applyWriteToCache error:", err);
  }
}

async function applyServerResponse(op, res) {
  const url = op.url || "";
  const body = parseData(op) || op.data || {};
  const data = res?.data;
  if (!data) return;
  try {
    if (url === "/assessments" && data.assessment) {
      const listKey = cacheKey({ method: "get", url: "/assessments", params: classParamsFromBody(body) });
      const entry = await idb.get("cache", listKey);
      const cached = parseCachedData(entry?.data) || {};
      if (Array.isArray(cached.assessments)) {
        const list = cached.assessments;
        const i = list.findIndex((a) => String(a._id) === String(data.assessment._id));
        if (i !== -1) list[i] = data.assessment;
        else list.push(data.assessment);
        entry.data = cached;
        entry.at = Date.now();
        await idb.put("cache", entry);
      }
    } else if (url.startsWith("/assessments/") && data.assessment) {
      const all = await idb.getAll("cache");
      for (const e of all) {
        const cached = parseCachedData(e.data) || {};
        const list = cached.assessments;
        if (!Array.isArray(list)) continue;
        const i = list.findIndex((a) => String(a._id) === String(data.assessment._id));
        if (i !== -1) {
          list[i] = data.assessment;
          e.data = cached;
          e.at = Date.now();
          await idb.put("cache", e);
        }
      }
    } else if (url === "/messages" && op.optimistic?._stub && data.message) {
      const stub = op.optimistic._stub;
      const all = await idb.getAll("cache");
      for (const e of all) {
        const cachedMsg = parseCachedData(e.data) || {};
        const list = cachedMsg.messages;
        if (!Array.isArray(list)) continue;
        const i = list.findIndex((m) => String(m.id) === String(stub.id));
        if (i !== -1) {
          list[i] = { ...stub, id: data.message.id, createdAt: data.message.createdAt, pending: false };
          e.data = cachedMsg;
          e.at = Date.now();
          await idb.put("cache", e);
        }
      }
    }
  } catch {
    /* ignore */
  }
}

// ---- flush ----

async function flushOnce() {
  if (syncing || !online) return;
  let token;
  try {
    const { tokenManager } = await import("../auth/tokenManager.js");
    token = tokenManager.getAccessToken();
    if (!token) {
      const stored = await tokenManager.init();
      token = tokenManager.getAccessToken();
    }
  } catch {
    token = null;
  }
  const ops = (await idb.getAll("outbox")).sort((a, b) => a.createdAt - b.createdAt);
  if (!ops.length) {
    emit();
    return;
  }
  syncing = true;
  emit();
  try {
    for (const op of ops) {
      if (!online) break;
      const url = op.url.startsWith("http") ? op.url : BASE_URL + op.url;
      try {
        const res = await axios.request({
          method: op.method,
          url,
          params: op.params,
          data: op.data,
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
            "Content-Type": op.data ? "application/json" : undefined,
          },
          skipQueue: true,
        });
        await applyServerResponse(op, res);
        await idb.delete("outbox", op.id);
      } catch (err) {
        const status = err.response?.status;
        if (!err.response) {
          online = false;
          break;
        }
        if (status === 401) {
          needsAuth = true;
          lastError = "Please sign in again to finish syncing your offline changes.";
          break;
        }
        if (status >= 400 && status < 500) {
          lastError = (err.response?.data?.error || err.response?.data?.message || "A queued change was rejected by the server.") + " — discarded.";
          await idb.delete("outbox", op.id);
        } else {
          break;
        }
      }
    }
  } finally {
    syncing = false;
    pendingCount = await idb.count("outbox").catch(() => pendingCount);
    if (pendingCount === 0) lastError = "";
    emit();
  }
}

export function flush() {
  flushOnce();
}

// ---- proactive pull-sync (offline-first "double sync") ----

const PREFETCH_INTERVAL = 60000;
const PREFETCH_ROUTES = {
  teacher: ["/users/school-structure", "/grades/teacher", "/users/me/classes", "/messages/contacts"],
  adviser: [
    "/users/school-structure",
    "/grades/teacher",
    "/grades/adviser",
    "/users/me/classes",
    "/users/students",
    "/users/teachers",
    "/messages/contacts",
  ],
  student: ["/grades/student"],
  admin: ["/admin/users", "/admin/traffic", "/admin/db/stats", "/admin/db/collections"],
};

let prefetching = false;
let lastPrefetchAt = 0;

async function loadApi() {
  try {
    const mod = await import("../api/client.js");
    return mod.default || mod;
  } catch {
    return null;
  }
}

export async function prefetchUserData(user) {
  const u = user || getUser();
  if (!u || !u.id || u.id === "offline-user") return;
  if (!online) return;
  const routes = PREFETCH_ROUTES[u.role];
  if (!routes || !routes.length) return;

  const api = await loadApi();
  if (!api || !online) return;

  const tasks = [];
  try {
    const classesRes = await api.get("/users/me/classes");
    const loads = classesRes?.data?.teachingLoad || [];
    for (const r of routes) tasks.push(api.get(r).catch(() => null));
    for (const l of loads) {
      const params = {
        grade: l.grade,
        strand: l.strand || "",
        section: l.section,
        ay: l.academicYear,
        subject: l.subject,
        semester: l.semester,
        specialization: l.specialization || "",
        tvlStrand: l.tvlStrand || "",
      };
      tasks.push(api.get("/assessments", { params }).catch(() => null));
      tasks.push(api.get("/assessments/summary", { params: { ...params, scope: "mine" } }).catch(() => null));
      tasks.push(api.get("/grades/roster", { params }).catch(() => null));
    }

    const contactsRes = await api.get("/messages/contacts");
    const contacts = contactsRes?.data?.contacts || [];
    const recent = contacts
      .slice()
      .sort((a, b) => String(b?.last?.createdAt || "").localeCompare(String(a?.last?.createdAt || "")))
      .slice(0, 10);
    for (const c of recent) {
      if (c?.id) tasks.push(api.get(`/messages/${c.id}`).catch(() => null));
    }
  } catch {
    /* keep whatever was already cached */
  }
  await Promise.all(tasks);
}

async function maybePrefetch(force = false) {
  if (prefetching || !online) return;
  if (!force && Date.now() - lastPrefetchAt < PREFETCH_INTERVAL) return;
  prefetching = true;
  try {
    await prefetchUserData();
    lastPrefetchAt = Date.now();
  } catch {
    /* ignore */
  } finally {
    prefetching = false;
  }
}

export async function init() {
  try {
    await idb.getAll("cache");
    pendingCount = await idb.count("outbox").catch(() => 0);
  } catch {
    return;
  }
  const onOnline = () => {
    online = true;
    emit();
    probeOnce();
    flushOnce();
    maybePrefetch(true);
  };
  const onOffline = () => {
    online = false;
    emit();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    timer = setInterval(() => {
      probeOnce();
      flushOnce();
      maybePrefetch();
    }, PING_INTERVAL);
  }
  probeOnce();
  flushOnce();
  maybePrefetch(true);
}
