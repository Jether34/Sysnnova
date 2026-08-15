import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client.js";
import { useUI } from "../components/ui.jsx";
import Select from "../components/Select.jsx";
import Spinner from "../components/Spinner.jsx";

const TABS = [
  { key: "overview", label: "Overview", icon: "database" },
  { key: "collections", label: "Collections", icon: "table_view" },
  { key: "events", label: "Events", icon: "event_note" },
  { key: "logs", label: "Server logs", icon: "terminal" },
  { key: "users", label: "Users", icon: "group" },
];

const ROLE_META = {
  adviser: { label: "Adviser", badge: "badge-warning" },
  teacher: { label: "Teacher", badge: "badge-success" },
  student: { label: "Student", badge: "badge-neutral" },
  admin: { label: "Admin", badge: "badge-danger" },
};

const LOG_LEVEL_BADGE = {
  error: "badge-danger",
  warn: "badge-warning",
  info: "badge-neutral",
  http: "badge-success",
  debug: "badge-neutral",
};

const LOG_LEVEL_LABEL = { error: "Error", warn: "Warn", info: "Info", http: "HTTP", debug: "Debug" };

const LOG_LEVELS = ["", "error", "warn", "info", "http"];

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-PH")} ${d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtBytes(kb) {
  if (!kb) return "0 KB";
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(2)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`;
  return `${kb.toFixed(1)} KB`;
}

function shorten(v, max = 240) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s && s.length > max ? `${s.slice(0, max)}…` : s;
}

function CellValue({ v }) {
  if (v === null || v === undefined) return <span className="text-slate-400">null</span>;
  if (v === true || v === false) return <span className="text-primary-600">{String(v)}</span>;
  if (typeof v === "number") return <span className="font-mono text-xs">{v}</span>;
  if (typeof v === "object") return <span className="block max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-slate-500">{shorten(v, 160)}</span>;
  return <span className="block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap">{shorten(v, 140)}</span>;
}

function Pagination({ page, pages, total, onChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
      <span>{total.toLocaleString()} result{total === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2">
        <button className="btn-outline !px-2.5 !py-1 text-xs" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
        <span>Page {page} of {pages}</span>
        <button className="btn-outline !px-2.5 !py-1 text-xs" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}

function Overview({ stats }) {
  const cards = [
    { label: "Collections", value: stats?.totalCollections ?? 0, icon: "storage" },
    { label: "Documents", value: (stats?.totalDocs ?? 0).toLocaleString(), icon: "description" },
    { label: "Data size", value: fmtBytes(stats?.dataSizeKb ?? 0), icon: "data_usage" },
    { label: "Index size", value: fmtBytes(stats?.indexSizeKb ?? 0), icon: "schema" },
  ];
  const max = Math.max(1, ...(stats?.collections || []).map((c) => c.count || 0));
  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Database connection</h2>
            <p className="text-xs text-slate-500 mt-0.5">MongoDB · {stats?.host || "—"}</p>
          </div>
          <span className="badge-success">
            <span className="material-symbols-outlined !text-sm" aria-hidden="true">check_circle</span>
            Connected · {stats?.dbName || "—"}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="material-symbols-outlined !text-lg" aria-hidden="true">{c.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-wider">{c.label}</span>
              </div>
              <div className="mt-2 text-2xl font-bold leading-none text-slate-900 dark:text-slate-100">{c.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Collections</h2>
          <span className="badge-neutral">{stats?.collections?.length ?? 0} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Collection</th><th className="w-1/3">Documents</th><th className="text-right">Share</th></tr>
            </thead>
            <tbody>
              {(stats?.collections || []).map((c) => (
                <tr key={c.name}>
                  <td><span className="font-mono text-xs">{c.name}</span></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${((c.count || 0) / max) * 100}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{c.count?.toLocaleString() ?? "—"}</span>
                    </div>
                  </td>
                  <td className="text-right text-xs text-slate-400">{((c.count || 0) / Math.max(1, stats?.totalDocs || 1) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {(stats?.collections || []).length === 0 && (
                <tr><td colSpan={3} className="text-center py-10 text-sm text-slate-400">No collections found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CollectionsBrowser() {
  const { show } = useUI();
  const [collections, setCollections] = useState([]);
  const [name, setName] = useState("");
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(25);
  const searchTimer = useRef(null);

  useEffect(() => {
    api.get("/admin/db/collections")
      .then(({ data: d }) => setCollections(d.collections || []))
      .catch((err) => show(err.message, "error"));
  }, []);

  const load = useCallback(async (col, p, query, lim) => {
    if (!col) return;
    setBusy(true);
    try {
      const params = { page: p, limit: lim };
      if (query) params.q = query;
      const { data: d } = await api.get(`/admin/db/collections/${encodeURIComponent(col)}`, { params });
      setData(d);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!name) return;
    searchTimer.current && clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(name, 1, q, limit);
    }, q ? 350 : 0);
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [name, q, limit]);

  const pick = (col) => {
    setName(col);
    setQ("");
    setPage(1);
    load(col, 1, "", limit);
  };

  const columns = data?.docs?.[0] ? Object.keys(data.docs[0]) : [];
  const rows = data?.docs || [];
  const rowsTitle = columns.length ? columns.map((c) => (c === "_id" ? "id" : c)).join(" · ") : "";

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <label className="label">Collection</label>
        <Select value={name} onChange={(e) => pick(e.target.value)} placeholder="Select a collection…">
          <option value="">Select a collection…</option>
          {collections.map((c) => (
            <option key={c.name} value={c.name}>{c.name} ({c.count?.toLocaleString() ?? "—"})</option>
          ))}
        </Select>
        {name && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              className="input flex-1 min-w-48"
              placeholder={`Search ${name}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select value={String(limit)} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
              <option value="25">25 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </Select>
          </div>
        )}
      </div>

      {busy && <Spinner full />}
      {!busy && data && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{name}</h2>
              <p className="text-[11px] text-slate-400 truncate">{rowsTitle}</p>
            </div>
            <span className="badge-neutral shrink-0">{data.total?.toLocaleString()} docs</span>
          </div>
          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <p className="text-center py-12 text-sm text-slate-400">No documents match.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c === "_id" ? "id" : c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((doc, i) => (
                    <tr key={i}>
                      {columns.map((c) => (
                        <td key={c}><CellValue v={doc[c]} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {data.total > 0 && (
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => { setPage(p); load(name, p, q, limit); }} />
          )}
        </div>
      )}
    </div>
  );
}

function EventsPanel() {
  const { show } = useUI();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(50);
  const timer = useRef(null);

  const load = useCallback(async (p, t, query, lim) => {
    try {
      const params = { page: p, limit: lim };
      if (t) params.type = t;
      if (query) params.q = query;
      const { data: d } = await api.get("/admin/events", { params });
      setData(d);
    } catch (err) {
      show(err.message, "error");
    }
  }, []);

  useEffect(() => {
    load(1, type, q, limit);
  }, [type, limit]);

  useEffect(() => {
    timer.current && clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPage(1);
      load(1, type, q, limit);
    }, q ? 350 : 0);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  const events = data?.events || [];

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="min-w-0">
            <label className="label">Event type</label>
            <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All events</option>
              {(data?.types || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="min-w-0">
            <label className="label">Search</label>
            <input className="input" placeholder="Search action, email, target…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label className="label">Per page</label>
            <Select value={String(limit)} onChange={(e) => setLimit(parseInt(e.target.value, 10))}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
        </div>
      </div>

      {!data && <Spinner full />}
      {data && (
        <div className="card">
          <div className="overflow-x-auto">
            {events.length === 0 ? (
              <p className="text-center py-12 text-sm text-slate-400">No events found.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>When</th><th>Action</th><th>Type</th><th>Actor</th><th>Target</th><th>IP</th></tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={String(e.id)}>
                      <td><span className="whitespace-nowrap text-xs">{fmtDate(e.createdAt)}</span></td>
                      <td>
                        <div className="max-w-[280px]">
                          <span className="block truncate font-medium text-slate-800 dark:text-slate-200">{e.action}</span>
                          {Object.keys(e.meta || {}).length > 0 && (
                            <span className="block max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-400 font-mono">{JSON.stringify(e.meta)}</span>
                          )}
                        </div>
                      </td>
                      <td><span className="font-mono text-[11px] text-slate-500">{e.type}</span></td>
                      <td>
                        <span className="block max-w-[200px] truncate text-xs">
                          {e.actorEmail ? e.actorEmail : "—"}
                          {e.actorRole ? <span className="text-slate-400"> ({e.actorRole})</span> : ""}
                        </span>
                      </td>
                      <td><span className="block max-w-[180px] truncate text-xs">{e.target || "—"}</span></td>
                      <td><span className="font-mono text-[11px] text-slate-400">{e.ip || "—"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {data.total > 0 && (
            <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(p) => { setPage(p); load(p, type, q, limit); }} />
          )}
        </div>
      )}
    </div>
  );
}

function LogsPanel() {
  const { show } = useUI();
  const [logs, setLogs] = useState([]);
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  const [paused, setPaused] = useState(false);
  const [live, setLive] = useState(true);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const params = { limit: 200 };
      if (level) params.level = level;
      if (q) params.q = q;
      const { data } = await api.get("/admin/logs", { params });
      setLogs(data.logs || []);
    } catch (err) {
      show(err.message, "error");
    }
  }, [level, q]);

  useEffect(() => {
    if (paused) return;
    load();
    timer.current = setInterval(load, 4000);
    return () => timer.current && clearInterval(timer.current);
  }, [load, paused]);

  const lastLog = logs[0];
  const liveMs = lastLog ? Math.max(0, Date.now() - lastLog.ts) : null;

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40">
            <label className="label">Level</label>
            <Select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LOG_LEVELS.map((l) => <option key={l} value={l}>{l ? LOG_LEVEL_LABEL[l] : "All levels"}</option>)}
            </Select>
          </div>
          <div className="min-w-48 flex-1">
            <label className="label">Search</label>
            <input className="input" placeholder="Search log messages…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className={`btn ${live ? "btn-primary" : "btn-outline"}`} onClick={() => { setLive(true); setPaused(false); }}>
            <span className="material-symbols-outlined !text-base" aria-hidden="true">refresh</span>
            Live
          </button>
          <button className={`btn ${paused ? "btn-primary" : "btn-outline"}`} onClick={() => setPaused((p) => !p)}>
            <span className="material-symbols-outlined !text-base" aria-hidden="true">pause</span>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
          {liveMs !== null && liveMs < 15000 ? (
            <span className="badge-success"><span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" /></span>Logging live</span>
          ) : (
            <span className="badge-neutral">Logging paused</span>
          )}
          <span>{logs.length} entries · refreshes every 4s</span>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">Recent server activity</h2>
          <span className="badge-neutral">{logs.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          {logs.length === 0 ? (
            <p className="text-center py-12 text-sm text-slate-400">No log entries yet.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Time</th><th>Level</th><th>Message</th><th>Source</th></tr></thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={`${l.ts}-${i}`}>
                    <td><span className="whitespace-nowrap font-mono text-[11px] text-slate-400">{fmtTime(l.ts)}</span></td>
                    <td><span className={LOG_LEVEL_BADGE[l.level] || "badge-neutral"}>{LOG_LEVEL_LABEL[l.level] || l.level}</span></td>
                    <td>
                      <span className="block max-w-[560px] truncate font-mono text-xs">
                        {l.message}
                      </span>
                      {l.meta?.user && <span className="text-[11px] text-slate-400">user: {String(l.meta.user).slice(-6)}</span>}
                    </td>
                    <td><span className="font-mono text-[11px] text-slate-400">{l.source || "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function UsersPanel() {
  const { show } = useUI();
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/admin/users")
      .then(({ data }) => setUsers(data.users || []))
      .catch((err) => show(err.message, "error"));
  }, []);

  const filtered = users.filter((u) => {
    if (role && u.role !== role) return false;
    if (q) {
      const needle = q.toLowerCase();
      const hay = `${u.fullName} ${u.email} ${u.grade} ${u.strand || ""} ${u.section} ${u.subject} ${u.school?.name || ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="label">Role</label>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="adviser">Adviser</option>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div className="min-w-0">
            <label className="label">Search</label>
            <input className="input" placeholder="Search name, email, grade, school…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">User accounts</h2>
          <span className="badge-neutral">{filtered.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Class</th><th>School</th><th>Created</th></tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="leading-tight">
                      <div className="font-medium text-slate-900 truncate dark:text-slate-100">{u.fullName}</div>
                      <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    </div>
                  </td>
                  <td><span className={ROLE_META[u.role]?.badge}>{ROLE_META[u.role]?.label}</span></td>
                  <td>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {u.role === "admin" ? "System" : `Grade ${u.grade}${u.strand ? " · " + u.strand : ""}${u.tvlStrand ? " · " + u.tvlStrand : ""}${u.specialization ? " · " + u.specialization : ""} · Block ${u.section || "—"}${u.subject ? " · " + u.subject : ""}`}
                    </span>
                  </td>
                  <td><span className="block max-w-[200px] truncate text-xs text-slate-500">{u.school?.name || "—"}</span></td>
                  <td><span className="whitespace-nowrap text-xs">{u.createdAt ? fmtDate(u.createdAt) : "—"}</span></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="text-center py-10 text-sm text-slate-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DatabaseMonitor() {
  const { show } = useUI();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/db/stats")
      .then(({ data }) => setStats(data))
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Database Monitor</h1>
        <p className="mt-1 text-sm text-slate-500">Visually inspect the database, audit events, and live server logs. Read-only and admin-only.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
              tab === t.key
                ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-primary-600 dark:border-primary-500 dark:bg-white dark:text-black"
                : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900"
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading && tab === "overview" && <Spinner full />}
      {tab === "overview" && !loading && <Overview stats={stats} />}
      {tab === "collections" && <CollectionsBrowser />}
      {tab === "events" && <EventsPanel />}
      {tab === "logs" && <LogsPanel />}
      {tab === "users" && <UsersPanel />}
    </div>
  );
}
