import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import Spinner from "../components/Spinner.jsx";
import MyClassesCard from "../components/MyClassesCard.jsx";

const SEMESTER_SHORT = {
  "1st Semester, 1st Quarter": "Sem 1 · Qtr 1",
  "1st Semester, 2nd Quarter": "Sem 1 · Qtr 2",
  "2nd Semester, 3rd Quarter": "Sem 2 · Qtr 3",
  "2nd Semester, 4th Quarter": "Sem 2 · Qtr 4",
};

function classTag(c) {
  let l = `Grade ${c.grade}${c.strand && c.strand !== "N/A" ? ` · ${c.strand}` : ""} - Block ${c.section}`;
  if (c.tvlStrand) l += ` · ${c.tvlStrand}`;
  if (c.specialization) l += ` (${c.specialization})`;
  return l;
}

function rowClass(c) {
  let l = `Grade ${c.grade}`;
  if (c.strand && c.strand !== "N/A") l += ` · ${c.strand}`;
  if (c.tvlStrand) l += ` · ${c.tvlStrand}`;
  if (c.specialization) l += ` (${c.specialization})`;
  l += ` · Block ${c.section}`;
  return l;
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function StatCard({ icon, label, value }) {
  return (
    <div className="card-pad !p-3 sm:!p-4 flex items-center gap-2.5 sm:gap-3">
      <span className="grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        <span className="material-symbols-outlined text-lg sm:text-xl" aria-hidden="true">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-xl sm:text-2xl font-bold leading-none text-slate-900">{value}</div>
        <div className="mt-1 truncate text-[11px] sm:text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { show } = useUI();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/users/school-structure"), api.get("/grades/teacher"), api.get("/users/me/classes")])
      .then(([s, g, c]) => {
        setData({ structure: s.data, sheets: g.data.sheets || [], classes: c.data });
      })
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    if (!data) return null;
    const advisories = groupBy(data.structure.advisories || [], (a) => `${a.grade}|${a.academicYear}`);
    const loads = groupBy(data.structure.loads || [], (l) => `${l.grade}|${l.strand}|${l.section}|${l.academicYear}|${l.specialization}|${l.tvlStrand}`);
    return { advisories, loads };
  }, [data]);

  if (loading) return <Spinner />;

  const sheets = data.sheets;
  const awaiting = sheets.filter((s) => s.status !== "published").length;
  const structure = data.structure;

  const stats = [
    { icon: "class", label: "Classes I Teach", value: data.classes.teachingLoad.length },
    { icon: "group", label: "Advisories", value: (structure.advisories || []).length },
    { icon: "co_present", label: "Teaching Loads", value: (structure.loads || []).length },
    { icon: "inventory_2", label: "Awaiting publish", value: awaiting },
  ];

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-5rem)]">
      <div className="lg:shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Teacher Workspace</h1>
            <p className="mt-1 truncate text-sm text-slate-500">
              {user.role === "adviser"
                ? <>Advisory · <strong className="text-slate-700">{classTag(user)}</strong> · S.Y. {user.academicYear}</>
                : <><strong className="text-slate-700">{user.subject}</strong> · {user.semester} · {classTag(user)} · S.Y. {user.academicYear}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/my-students" className="btn-ghost">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">groups</span>
              My Students
            </Link>
            <Link to="/grades" className="btn-primary">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">table_view</span>
              <span className="hidden sm:inline">Submitted Grades</span>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <MyClassesCard className="min-h-[20rem] lg:min-h-0" />

        {/* All advisories */}
        <div className="card flex flex-col overflow-hidden min-h-[20rem] lg:min-h-0">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="font-semibold text-slate-900">Class Advisories</h2>
            <p className="text-xs text-slate-500 mt-0.5">Every advisory by grade, strand, block, specialization &amp; S.Y.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {[...grouped.advisories.entries()].length === 0 && (
              <p className="p-6 text-sm text-slate-500">No advisories registered yet.</p>
            )}
            {[...grouped.advisories.entries()].map(([key, list]) => {
              const [grade, ay] = key.split("|");
              return (
                <div key={key} className="border-b border-slate-100 last:border-0">
                  <div className="sticky top-0 bg-slate-50/95 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Grade {grade} <span className="text-slate-400">· S.Y. {ay}</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {list.map((a) => (
                      <div key={`${a.adviserId}|${a.grade}|${a.section}|${a.specialization}|${a.academicYear}`} className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {rowClass(a)}
                          </div>
                          <div className="truncate text-xs text-slate-500">Adviser: {a.adviserName}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500">
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">group</span>
                          {a.total}
                          <span className="text-slate-400">({a.boys}M / {a.girls}F)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All subject-teacher loads */}
        <div className="card flex flex-col overflow-hidden min-h-[20rem] lg:min-h-0">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="font-semibold text-slate-900">Subject Teachers by Class</h2>
            <p className="text-xs text-slate-500 mt-0.5">Every teaching load by grade, strand, block, specialization, subject &amp; S.Y.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {grouped.loads.size === 0 && (
              <p className="p-6 text-sm text-slate-500">No subject-teacher loads registered yet.</p>
            )}
            {[...grouped.loads.entries()].map(([key, list]) => {
              const [grade, strand, section, ay, spec, tvl] = key.split("|");
              return (
                <div key={key} className="border-b border-slate-100 last:border-0">
                  <div className="sticky top-0 bg-slate-50/95 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Grade {grade}{strand ? ` · ${strand}` : ""} - Block {section}{tvl ? ` · ${tvl}` : ""}{spec ? ` (${spec})` : ""} <span className="text-slate-400">· S.Y. {ay}</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {list.map((l, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 hover:bg-slate-50">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{l.subject}</div>
                          <div className="truncate text-xs text-slate-500">{l.teacherName}</div>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500">{SEMESTER_SHORT[l.semester] || l.semester}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
