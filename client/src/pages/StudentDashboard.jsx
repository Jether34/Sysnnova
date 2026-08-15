import { useEffect, useState } from "react";
import api, { downloadFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import Spinner from "../components/Spinner.jsx";
import Modal from "../components/Modal.jsx";
import { fmtDate } from "../utils/constants.js";

const TYPE_LABELS = { ww: "Written Work", pt: "Performance Task", qa: "Quarterly Assessment" };
const TYPE_HEAD = { ww: "bg-sky-50 text-sky-800", pt: "bg-amber-50 text-amber-800", qa: "bg-emerald-50 text-emerald-800" };

function frac(score, item) {
  if (score === null || score === undefined || score === "") return "—";
  const it = Number(item);
  return it > 0 ? `${score}/${it}` : String(score);
}

function GradeDetail({ detail, onClose }) {
  if (!detail) return null;
  const breakdown = detail.breakdown || [];
  return (
    <Modal open wide title={detail.subject} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p><strong className="text-slate-900">Class:</strong> Grade {detail.gradeLevel}{detail.strand ? ` · ${detail.strand}` : ""} - {detail.section}</p>
          <p className="mt-0.5"><strong className="text-slate-900">Quarter:</strong> {detail.semester} · S.Y. {detail.academicYear}</p>
          <p className="mt-0.5"><strong className="text-slate-900">Teacher:</strong> {detail.teacherName}</p>
          {detail.publishedAt && <p className="mt-0.5"><strong className="text-slate-900">Published:</strong> {fmtDate(detail.publishedAt)}</p>}
          <p className="mt-2"><strong className="text-slate-900">Final grade:</strong> <span className="inline-flex min-w-[44px] items-center justify-center rounded-md bg-primary-50 px-2.5 py-1 font-bold text-primary-700">{detail.grade}</span></p>
        </div>
        {breakdown.length === 0 ? (
          <p className="rounded-lg border border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            No component breakdown was recorded for this subject. Your teacher encoded it directly as a final grade.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="table w-full min-w-[680px]">
              <thead>
                <tr>
                  <th rowSpan={2} className="text-left">Component</th>
                  <th rowSpan={2} className="text-center">Type</th>
                  <th rowSpan={2} className="text-center">Score</th>
                  <th rowSpan={2} className="text-center">Items</th>
                  <th rowSpan={2} className="text-center">Percent</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((c) => {
                  const pct = c.item > 0 && c.score !== null ? Math.min(100, Math.round((c.score / c.item) * 1000) / 10) : null;
                  return (
                    <tr key={`${c.type}-${c.label}`} className="hover:bg-slate-50">
                      <td className="font-semibold text-slate-900 whitespace-nowrap">{c.label}</td>
                      <td className="text-center">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${TYPE_HEAD[c.type]}`}>
                          {TYPE_LABELS[c.type]}
                        </span>
                      </td>
                      <td className="text-center">{c.score === null || c.score === undefined ? "—" : c.score}</td>
                      <td className="text-center">{c.item > 0 ? c.item : "—"}</td>
                      <td className="text-center font-semibold text-slate-700">{pct !== null ? `${pct}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const { show } = useUI();
  const [byYear, setByYear] = useState([]);
  const [currentYear, setCurrentYear] = useState(user.academicYear);
  const [loading, setLoading] = useState(true);
  const [dlBusy, setDlBusy] = useState(false);
  const [detail, setDetail] = useState(null);
  const [adviser, setAdviser] = useState(null);

  useEffect(() => {
    api
      .get("/grades/student")
      .then(({ data }) => {
        setByYear(data.byYear);
        setAdviser(data.adviser || null);
        if (data.byYear.length) setCurrentYear(user.academicYear);
      })
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const active = byYear.find((y) => y.academicYear === currentYear) || byYear[0];
  const stats = byYear.reduce((acc, y) => acc + y.grades.length, 0);

  const downloadReportCard = async () => {
    setDlBusy(true);
    try {
      await downloadFile("/grades/student/report-card", {}, `Report_Card_${user.lastName}_${user.firstName}.xlsx`);
      show("Your report card was downloaded.");
    } catch (err) {
      show(err.message, "error");
    } finally {
      setDlBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">My Grades</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.fullName} · Grade {user.grade}{user.strand ? ` · ${user.strand}` : ""} - {user.section} · S.Y. {user.academicYear}
          </p>
        </div>
        {byYear.length > 1 && (
          <select className="input !w-auto" value={currentYear} onChange={(e) => setCurrentYear(e.target.value)}>
            {byYear.map((y) => <option key={y.academicYear} value={y.academicYear}>S.Y. {y.academicYear}</option>)}
          </select>
        )}
        <button className="btn-primary" disabled={dlBusy || stats === 0} onClick={downloadReportCard}>
          <span className="material-symbols-outlined text-lg" aria-hidden="true">download</span>
          {dlBusy ? "Preparing..." : "Download Report Card"}
        </button>
      </div>

      <div className="card p-5 flex items-center gap-4">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <span className="material-symbols-outlined text-2xl" aria-hidden="true">grade</span>
        </span>
        <div>
          <div className="font-display text-2xl font-bold text-slate-900">{stats}</div>
          <div className="text-sm text-slate-500">Published grades</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="material-symbols-outlined text-lg text-primary-600" aria-hidden="true">badge</span>
          <h2 className="font-semibold text-slate-900">My Class Info</h2>
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
          {user.strand && (
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
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Class Adviser</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{adviser ? adviser.name : "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">School Year</dt>
            <dd className="mt-0.5 font-medium text-slate-900">S.Y. {user.academicYear}</dd>
          </div>
        </dl>
      </div>

      {!active && (
        <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">inbox</span>
          <p className="text-sm text-slate-500 max-w-md">
            No published grades yet. Your adviser will publish your grades here as soon as they are available — no need to ask your teachers manually.
          </p>
        </div>
      )}

      {active && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">S.Y. {active.academicYear}</h2>
            <p className="text-xs text-slate-400">These are the grades you personally received. Other students' grades are never visible to you.</p>
          </div>
          {active.grades.map((g, i) => {
            const wwPct = g.wwItems > 0 && g.ww !== null ? Math.round((g.ww / g.wwItems) * 1000) / 10 : null;
            const ptPct = g.ptItems > 0 && g.pt !== null ? Math.round((g.pt / g.ptItems) * 1000) / 10 : null;
            const qaPct = g.qaItems > 0 && g.qa !== null ? Math.round((g.qa / g.qaItems) * 1000) / 10 : null;
            return (
              <div key={i} className="card overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{g.subject}</h3>
                      <p className="text-xs text-slate-500">{g.teacherName} · {g.semester} · Grade {g.gradeLevel}{g.strand ? ` · ${g.strand}` : ""} - {g.section}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {g.publishedAt && <span className="text-xs text-slate-400">Published {fmtDate(g.publishedAt)}</span>}
                      <button className="btn-outline !px-2.5 !py-1.5 text-xs" onClick={() => setDetail(g)}>
                        <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">fact_check</span>
                        Breakdown
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Written Work</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-slate-900">{g.ww ?? "—"}</span>
                        <span className="text-xs text-slate-500">/ {g.wwItems ?? "—"}</span>
                      </div>
                      {wwPct !== null && <div className="text-xs text-slate-500">{wwPct}%</div>}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Performance Task</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-slate-900">{g.pt ?? "—"}</span>
                        <span className="text-xs text-slate-500">/ {g.ptItems ?? "—"}</span>
                      </div>
                      {ptPct !== null && <div className="text-xs text-slate-500">{ptPct}%</div>}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quarterly Assessment</span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-slate-900">{g.qa ?? "—"}</span>
                        <span className="text-xs text-slate-500">/ {g.qaItems ?? "—"}</span>
                      </div>
                      {qaPct !== null && <div className="text-xs text-slate-500">{qaPct}%</div>}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                    <span className="text-sm font-medium text-slate-500">Transmuted Grade</span>
                    <span className={`inline-flex min-w-[44px] items-center justify-center rounded-md px-2.5 py-1 font-bold ${g.grade !== null && g.grade >= 75 ? "bg-primary-50 text-primary-700" : "bg-red-50 text-red-700"}`}>
                      {g.grade ?? "Incomplete"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {detail && <GradeDetail detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
