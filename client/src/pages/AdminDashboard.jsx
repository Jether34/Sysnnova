import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import { useUI } from "../components/ui.jsx";
import Select from "../components/Select.jsx";
import TrafficChart from "../components/TrafficChart.jsx";
import UserFormModal from "../components/UserFormModal.jsx";
import SchoolSubjectsManager from "../components/SchoolSubjectsManager.jsx";
import Spinner from "../components/Spinner.jsx";

const ROLE_META = {
  adviser: { label: "Adviser", badge: "badge-warning" },
  teacher: { label: "Teacher", badge: "badge-success" },
  student: { label: "Student", badge: "badge-neutral" },
  admin: { label: "Admin", badge: "badge-danger" },
};

const ROLE_FILTERS = [
  { key: "", label: "All roles" },
  { key: "adviser", label: "Adviser" },
  { key: "teacher", label: "Teacher" },
  { key: "student", label: "Student" },
  { key: "admin", label: "Admin" },
];

function initials(u) {
  return `${u.firstName?.[0] || ""}${u.lastName?.[0] || ""}`.toUpperCase() || "?";
}

function roleClassLine(u) {
  if (u.role === "admin") return "System";
  if (u.role === "teacher") return `Grade ${u.grade} · ${u.subject || "—"} · ${u.semester || ""}`;
  if (u.role === "adviser") return `Grade ${u.grade}${u.strand ? " · " + u.strand : ""} · Block ${u.section || "—"}`;
  return `Grade ${u.grade}${u.strand ? " · " + u.strand : ""} · Block ${u.section || "—"}`;
}

function fmtUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function AdminDashboard() {
  const { show, confirm } = useUI();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [traffic, setTraffic] = useState(null);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data.users || []);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    const t = setInterval(async () => {
      try {
        const { data } = await api.get("/admin/traffic");
        setTraffic(data);
      } catch {
        /* transient network hiccup */
      }
    }, 2000);
    return () => clearInterval(t);
  }, [loadUsers]);

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${u.fullName} ${u.email} ${u.grade} ${u.section} ${u.subject}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const onDelete = async (u) => {
    const ok = await confirm({
      title: "Delete user",
      message: `Delete ${u.fullName} (${u.email})? This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      show("User deleted.", "success");
      loadUsers();
    } catch (err) {
      show(err.message, "error");
    }
  };

  if (loading) return <Spinner full />;

  const stats = [
    { label: "Total users", value: traffic?.totalUsers ?? users.length, icon: "group", sub: "registered accounts" },
    { label: "Active now", value: traffic?.activeUsers ?? 0, icon: "online_prediction", sub: "last 2 minutes" },
    { label: "Requests / sec", value: traffic?.rpsNow ?? 0, icon: "speed", sub: "current rate" },
    { label: "Requests (1 min)", value: traffic?.lastMin ?? 0, icon: "monitoring", sub: "last 60 seconds" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">System Administrator</h1>
        <p className="mt-1 text-sm text-slate-500">Manage user accounts and monitor live system traffic.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 grid place-items-center shrink-0">
                <span className="material-symbols-outlined" aria-hidden="true">{s.icon}</span>
              </span>
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-none text-slate-900">{s.value}</div>
                <div className="mt-1 text-xs font-medium text-slate-500">{s.label}</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <h2 className="font-display text-base font-bold text-slate-900">Live traffic</h2>
            <span className="badge-neutral">last 2 minutes</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Uptime <strong className="text-slate-700">{traffic ? fmtUptime(traffic.uptime) : "—"}</strong></span>
            <span>Refreshes every 2s</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TrafficChart data={traffic?.series || []} />
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Top endpoints</h3>
            {traffic?.topEndpoints?.length ? (
              <ul className="space-y-2">
                {traffic.topEndpoints.map((e) => {
                  const max = traffic.topEndpoints[0]?.count || 1;
                  return (
                    <li key={e.path}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-mono text-xs text-slate-600">{e.path}</span>
                        <span className="ml-2 text-xs font-semibold text-slate-500">{e.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${(e.count / max) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No traffic yet.</p>
            )}
          </div>
        </div>
      </div>

      <SchoolSubjectsManager onChanged={loadUsers} />

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-bold text-slate-900">User accounts</h2>
          <button className="btn-primary" onClick={() => setModal({ mode: "create", user: null })}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">person_add</span>
            Add user
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100">
          <div className="w-48">
            <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {ROLE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
          </div>
          <div className="relative flex-1 min-w-48">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400" aria-hidden="true">search</span>
            <input className="input !pl-9" placeholder="Search name, email, grade, section…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Class</th>
                <th>School</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 grid place-items-center text-xs font-bold">{initials(u)}</span>
                      <div className="min-w-0 leading-tight">
                        <div className="font-medium text-slate-900 truncate">{u.fullName}</div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={ROLE_META[u.role]?.badge}>{ROLE_META[u.role]?.label}</span></td>
                  <td><span className="text-xs text-slate-600">{roleClassLine(u)}</span></td>
                  <td><span className="text-xs text-slate-500 max-w-[220px] block truncate">{u.school?.name || "—"}</span></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button className="btn-ghost !px-2.5" aria-label={`Edit ${u.fullName}`} onClick={() => setModal({ mode: "edit", user: u })}>
                        <span className="material-symbols-outlined text-base" aria-hidden="true">edit</span>
                      </button>
                      <button className="btn-ghost !px-2.5 hover:!text-red-600 hover:!bg-red-50" aria-label={`Delete ${u.fullName}`} onClick={() => onDelete(u)}>
                        <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-sm text-slate-400">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <UserFormModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={loadUsers}
        />
      )}
    </div>
  );
}
