import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { downloadFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import Spinner from "../components/Spinner.jsx";
import { SEMESTERS } from "../utils/constants.js";
import MyClassesCard from "../components/MyClassesCard.jsx";

export default function AdviserDashboard() {
  const { user } = useAuth();
  const { show } = useUI();
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState({ grouped: {} });
  const [loading, setLoading] = useState(true);
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [dlBusy, setDlBusy] = useState(false);
  const [advisories, setAdvisories] = useState([]);
  const [rcAdvisory, setRcAdvisory] = useState(null);

  useEffect(() => {
    Promise.all([api.get("/users/students"), api.get("/users/teachers"), api.get("/users/me/classes")])
      .then(([s, t, c]) => {
        setStudents(s.data.students);
        setTeachers(t.data);
        setAdvisories(c.data.advisories);
        if (!rcAdvisory && c.data.advisories.length) {
          const primary = c.data.advisories.find((a) => a.primary) || c.data.advisories[0];
          setRcAdvisory({ grade: primary.grade, strand: primary.strand, section: primary.section });
        }
      })
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const downloadReportCards = async () => {
    setDlBusy(true);
    try {
      await downloadFile(
        "/grades/report-cards",
        { semester, ay: user.academicYear, grade: rcAdvisory?.grade, strand: rcAdvisory?.strand ?? "", section: rcAdvisory?.section },
        `Report_Cards_G${rcAdvisory?.grade || user.grade}${rcAdvisory?.strand ? "_" + rcAdvisory.strand : ""}_Block${rcAdvisory?.section || user.section}_${semester.replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`
      );
      show(`${semester} report cards downloaded.`);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setDlBusy(false);
    }
  };

  if (loading) return <Spinner />;

  const stats = [
    { label: "Students in advisory", value: students.length, icon: "group", tone: "text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400" },
    { label: "Subject teachers", value: Object.keys(teachers.grouped).length, icon: "co_present", tone: "text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400" },
  ];

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-5rem)]">
      <div className="lg:shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Adviser Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              {advisories.length > 1 ? (
                <>Advisories: <strong className="text-slate-700">{advisories.map((a) => `Grade ${a.grade}${a.strand && a.strand !== "N/A" ? ` · ${a.strand}` : ""} - ${a.section}`).join(", ")}</strong> · S.Y. {user.academicYear}</>
              ) : (
                <>Advisory: <strong className="text-slate-700">Grade {user.grade}{user.strand ? ` · ${user.strand}` : ""} · {user.section}</strong> · S.Y. {user.academicYear}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {advisories.length > 0 && (
              <select
                className="input !w-auto"
                value={`${rcAdvisory?.grade}|${rcAdvisory?.strand || ""}|${rcAdvisory?.section}`}
                onChange={(e) => {
                  const [grade, strand, section] = e.target.value.split("|");
                  setRcAdvisory({ grade, strand, section });
                }}
                aria-label="Advisory class"
              >
                {advisories.map((a) => (
                  <option key={a.id} value={`${a.grade}|${a.strand || ""}|${a.section}`}>
                    Grade {a.grade}{a.strand && a.strand !== "N/A" ? ` · ${a.strand}` : ""} - {a.section}
                  </option>
                ))}
              </select>
            )}
            <select className="input !w-auto" value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semester">
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn-primary" disabled={dlBusy} onClick={downloadReportCards}>
              <span className="material-symbols-outlined text-lg" aria-hidden="true">download</span>
              {dlBusy ? "Preparing report cards..." : "Download Report Cards"}
            </button>
            <Link to="/grades" className="btn-ghost">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">table_view</span>
              Submitted Grades
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {stats.map((s) => (
            <div key={s.label} className="card-pad !p-4 flex items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${s.tone}`}>
                <span className="material-symbols-outlined text-xl" aria-hidden="true">{s.icon}</span>
              </span>
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-none text-slate-900">{s.value}</div>
                <div className="mt-1 truncate text-xs font-medium text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 card p-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="material-symbols-outlined text-lg text-primary-600" aria-hidden="true">groups</span>
            <h2 className="font-semibold text-slate-900">My Advisory</h2>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Full name</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{user.fullName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Grade level</dt>
              <dd className="mt-0.5 font-medium text-slate-900">Grade {user.grade}</dd>
            </div>
            {user.strand && user.strand !== "N/A" && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Strand</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{user.strand}</dd>
              </div>
            )}
            {user.strand === "TVL" && user.tvlStrand && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">TVL track</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{user.tvlStrand}</dd>
              </div>
            )}
            {user.strand === "TVL" && user.specialization && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Specialization</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{user.specialization}</dd>
              </div>
            )}
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Block / Section</dt>
              <dd className="mt-0.5 font-medium text-slate-900">Block {user.section}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">School Year</dt>
              <dd className="mt-0.5 font-medium text-slate-900">S.Y. {user.academicYear}</dd>
            </div>
            {advisories.length > 1 && (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Extra advisories</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {advisories
                    .filter((a) => !a.primary)
                    .map((a) => `G${a.grade}${a.strand && a.strand !== "N/A" ? ` · ${a.strand}` : ""} - ${a.section}${a.specialization ? ` (${a.specialization})` : ""}`)
                    .join(", ")}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <MyClassesCard />

        <div className="card flex flex-col overflow-hidden min-h-[20rem] lg:min-h-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Subject Teachers by Subject</h2>
            <p className="text-xs text-slate-500 mt-0.5">Message them to coordinate submissions.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {Object.keys(teachers.grouped).length === 0 && <p className="text-sm text-slate-500">No subject teachers registered yet.</p>}
            {Object.entries(teachers.grouped).map(([subject, list]) => (
              <div key={subject} className="rounded-lg border border-slate-200 p-3">
                <div className="font-semibold text-primary-700 text-sm">{subject}</div>
                {list.map((t) => (
                  <div key={t.id} className="mt-1.5 flex items-center justify-between text-sm text-slate-600">
                    <span className="truncate">{t.fullName}</span>
                    <Link to={`/messages?to=${t.id}`} className="ml-2 inline-flex items-center gap-1 text-primary-600 text-xs font-medium hover:text-primary-700 shrink-0">
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">chat</span>
                      Message
                    </Link>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
