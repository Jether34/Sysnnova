import { useEffect, useMemo, useState } from "react";
import api, { downloadFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "./ui.jsx";
import Spinner from "./Spinner.jsx";
import Modal from "./Modal.jsx";
import { fmtDate } from "../utils/constants.js";

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function frac(score, item) {
  const s = num(score);
  if (s === null) return "—";
  const it = num(item);
  return it > 0 ? `${s}/${it}` : String(s);
}

function GradeCell({ entry }) {
  if (entry.incomplete) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
        title="Missing components (absent) — no grade computed"
      >
        <span className="material-symbols-outlined text-xs" aria-hidden="true">schedule</span>
        Incomplete
      </span>
    );
  }
  return <span className="font-bold text-slate-800">{entry.grade ?? "—"}</span>;
}

function toSheet(s) {
  return {
    sheetId: s.sheetId,
    subject: s.subject,
    semester: s.semester,
    academicYear: s.academicYear,
    gradeLevel: s.gradeLevel,
    strand: s.strand || "",
    tvlStrand: s.tvlStrand || "",
    specialization: s.specialization || "",
    section: s.section,
    teacherName: s.teacherName || "",
    status: s.status,
    notes: s.notes || "",
    publishedAt: s.publishedAt,
    entries: s.entries || [],
    breakdown: s.breakdown || [],
  };
}

const classKey = (s) => `${s.gradeLevel}|${s.strand || ""}|${s.tvlStrand || ""}|${s.specialization || ""}|${s.section}|${s.academicYear}`;
const classLabel = (s) =>
  `Grade ${s.gradeLevel}${s.strand && s.strand !== "N/A" ? ` · ${s.strand}` : ""}${s.tvlStrand ? ` · ${s.tvlStrand}` : ""}${s.specialization ? ` (${s.specialization})` : ""} - Block ${s.section}`;

function genderRank(g) {
  const v = String(g || "").toLowerCase();
  return v === "male" ? 0 : v === "female" ? 1 : 2;
}

function compareStudents(a, b) {
  return (
    genderRank(a.gender) - genderRank(b.gender) ||
    String(a.lastName || "").localeCompare(String(b.lastName || ""), undefined, { numeric: true, sensitivity: "base" }) ||
    String(a.firstName || "").localeCompare(String(b.firstName || ""), undefined, { numeric: true, sensitivity: "base" }) ||
    String(a.middleName || "").localeCompare(String(b.middleName || ""), undefined, { numeric: true, sensitivity: "base" })
  );
}

const TYPE_LABELS = { ww: "Written Work", pt: "Performance Task", qa: "Quarterly Assessment" };
const TYPE_HEAD = { ww: "bg-sky-50 text-sky-800", pt: "bg-amber-50 text-amber-800", qa: "bg-emerald-50 text-emerald-800" };

function ViewDialog({ sheet, onClose }) {
  if (!sheet) return null;
  const roster = [...(sheet.entries || [])].sort(compareStudents);
  const breakdown = sheet.breakdown || [];
  const byType = (t) => breakdown.filter((c) => c.type === t);
  return (
    <Modal open xwide hideScroll title={sheet.subject} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p><strong className="text-slate-900">Class:</strong> {classLabel(sheet)} · S.Y. {sheet.academicYear}</p>
          <p className="mt-0.5"><strong className="text-slate-900">Quarter:</strong> {sheet.semester}</p>
          <p className="mt-0.5"><strong className="text-slate-900">Submitted by:</strong> {sheet.teacherName}</p>
          {sheet.notes && <p className="mt-0.5"><strong className="text-slate-900">Notes:</strong> {sheet.notes}</p>}
          {sheet.status === "published" && sheet.publishedAt && (
            <p className="mt-0.5"><strong className="text-slate-900">Sent to students:</strong> {fmtDate(sheet.publishedAt)}</p>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="table w-full min-w-0">
            <thead>
              <tr>
                <th className="w-8 text-center">#</th>
                <th className="text-left">Student</th>
                <th className="text-center">WW</th>
                <th className="text-center">PT</th>
                <th className="text-center">QA</th>
                <th className="text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((e, i) => (
                <tr key={String(e.studentId) || i} className="hover:bg-slate-50">
                  <td className="text-center text-slate-400">{i + 1}</td>
                  <td className="font-semibold text-slate-900 whitespace-nowrap">
                    {e.lastName}, {e.firstName}{e.middleName ? ` ${e.middleName.charAt(0)}.` : ""}
                  </td>
                  <td className="text-center">{frac(e.ww, e.wwItems)}</td>
                  <td className="text-center">{frac(e.pt, e.ptItems)}</td>
                  <td className="text-center">{frac(e.qa, e.qaItems)}</td>
                  <td className="text-center"><GradeCell entry={e} /></td>
                </tr>
              ))}
              {roster.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No students in this sheet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {breakdown.length > 0 && (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">WW · PT · QA Breakdown</h4>
              <span className="text-xs text-slate-400">{breakdown.length} component{breakdown.length === 1 ? "" : "s"} · every raw score that produced these grades</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="table w-full min-w-0">
                <thead>
                  <tr>
                    <th rowSpan={2} className="text-left">Student</th>
                    {["ww", "pt", "qa"].map((t) => {
                      const list = byType(t);
                      if (list.length === 0) return null;
                      return (
                        <th key={t} colSpan={list.length} className={`text-center ${TYPE_HEAD[t]}`}>
                          {TYPE_LABELS[t]}
                        </th>
                      );
                    })}
                    <th rowSpan={2} className="text-center">Grade</th>
                  </tr>
                  <tr>
                    {breakdown.map((c) => (
                      <th key={`${c.type}-${c.label}`} className="text-center font-medium text-slate-500">
                        <div className="whitespace-nowrap">{c.label}</div>
                        <div className="text-[10px] font-normal text-slate-400">{c.item} items</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((e, i) => (
                    <tr key={String(e.studentId) || i} className="hover:bg-slate-50">
                      <td className="font-semibold text-slate-900 whitespace-nowrap">
                        {e.lastName}, {e.firstName}{e.middleName ? ` ${e.middleName.charAt(0)}.` : ""}
                      </td>
                      {breakdown.map((c) => {
                        const sc = (c.scores || []).find((x) => String(x.studentId) === String(e.studentId));
                        const score = sc ? sc.score : null;
                        const item = sc && sc.item > 0 ? sc.item : c.item;
                        return <td key={`${c.type}-${c.label}-${i}`} className="text-center">{frac(score, item)}</td>;
                      })}
                      <td className="text-center font-bold text-slate-800"><GradeCell entry={e} /></td>
                    </tr>
                  ))}
                  {roster.length === 0 && (
                    <tr><td colSpan={breakdown.length + 2} className="px-4 py-6 text-center text-slate-400">No students in this sheet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function GradeSubmissions() {
  const { user } = useAuth();
  const { show, confirm } = useUI();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const isAdviser = user.role === "adviser";

  const load = async () => {
    if (isAdviser) {
      const { data } = await api.get("/grades/adviser");
      const flat = [];
      for (const ay of data.tree || []) for (const s of ay.sheets || []) flat.push(s);
      return flat.map(toSheet);
    }
    const { data } = await api.get("/grades/teacher");
    return (data.sheets || []).map(toSheet);
  };

  const reload = async () => {
    const list = await load();
    setSheets(list);
    setSelected(new Set());
  };

  useEffect(() => {
    load()
      .then((list) => {
        setSheets(list);
        setSelected(new Set());
      })
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const classes = useMemo(() => {
    const map = new Map();
    for (const s of sheets) {
      const k = classKey(s);
      if (!map.has(k)) {
        map.set(k, { gradeLevel: s.gradeLevel, strand: s.strand, tvlStrand: s.tvlStrand, specialization: s.specialization, section: s.section, academicYear: s.academicYear, sheets: [] });
      }
      map.get(k).sheets.push(s);
    }
    return [...map.values()].sort(
      (a, b) => b.academicYear.localeCompare(a.academicYear) || classLabel(a).localeCompare(classLabel(b))
    );
  }, [sheets]);

  const downloadPdf = async (sheet) => {
    setBusy(true);
    try {
      const name = `Grade_List_${sheet.subject.replace(/\s+/g, "_")}_${sheet.gradeLevel}_${sheet.section}.pdf`;
      await downloadFile(`/grades/${sheet.sheetId}/pdf`, {}, name);
      show("Grade list downloaded.");
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIds = sheets.map((s) => s.sheetId);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const sendSelected = async () => {
    if (selected.size === 0) return;
    const count = selected.size;
    const ok = await confirm({
      title: `Send ${count} grade list${count === 1 ? "" : "s"} to students?`,
      message: "Students will see their grades on the student portal right away. This cannot be undone from their side until you unsend.",
      confirmLabel: "Send to students",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.post("/grades/publish", { sheetIds: [...selected] });
      show(data.message);
      await reload();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleSheetPublish = async (s) => {
    const willSend = s.status !== "published";
    const ok = await confirm({
      title: willSend ? "Send grades to students?" : "Unsend grades from students?",
      message: willSend
        ? `Publish ${s.subject} (${classLabel(s)}) to the student portal? Students will see their grades right away.`
        : `Pull ${s.subject} (${classLabel(s)}) back? Students will no longer see it until you send it again.`,
      confirmLabel: willSend ? "Send to students" : "Unsend",
      tone: willSend ? "primary" : "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/grades/${s.sheetId}/${willSend ? "publish" : "unpublish"}`);
      show(data.message);
      await reload();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">
          {isAdviser ? "Grades Routed to You" : "My Submitted Grades"}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {isAdviser
            ? "Every grade list your subject teachers submit is routed here for your review. Nothing reaches students until you select lists and send them to the student portal."
            : "Your submitted grade lists are routed to your adviser for review. Students only see grades after your adviser sends them from the Submitted Grades page."}
        </p>
      </div>

      {isAdviser && sheets.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="accent-primary-600" checked={allSelected} onChange={toggleSelectAll} />
            Select all ({sheets.length})
          </label>
          <button className="btn-primary !px-4 !py-2 text-sm" disabled={selected.size === 0 || busy} onClick={sendSelected}>
            <span className="material-symbols-outlined text-base leading-none" aria-hidden="true">send</span>
            Send to students ({selected.size})
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 space-y-5 overflow-y-auto p-5">
        {classes.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">inbox</span>
            <p className="text-sm text-slate-500 max-w-md">
              {isAdviser
                ? "No grade submissions routed to you yet. Subject teachers see your advisory when they download the format, and their submissions will land here for you to review and send to students."
                : "You haven't submitted any grades yet. Submit a grade list and it will be routed to your adviser for review."}
            </p>
          </div>
        )}
        {classes.map((g) => (
          <div key={classKey(g)}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{classLabel(g)}</h3>
              <span className="text-xs text-slate-400">S.Y. {g.academicYear}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {g.sheets.map((s) => (
                <div key={s.sheetId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isAdviser && (
                        <input
                          type="checkbox"
                          className="accent-primary-600 shrink-0"
                          checked={selected.has(s.sheetId)}
                          onChange={() => toggleSelect(s.sheetId)}
                          title="Select to send to students"
                        />
                      )}
                      <span className="truncate text-sm font-semibold text-slate-800">{s.subject}</span>
                      {s.status === "published" ? (
                        <span className="badge-success">Sent to students</span>
                      ) : (
                        <span className="badge-warning">Awaiting review</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-slate-500">{s.teacherName} · {s.semester}</div>
                    {s.notes && <div className="truncate text-xs text-slate-400 mt-0.5 italic">"{s.notes}"</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button className="btn-outline !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => setView(s)}>
                      <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">visibility</span> View
                    </button>
                    <button className="btn-outline !px-2.5 !py-1.5 text-xs" disabled={busy} onClick={() => downloadPdf(s)}>
                      <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">picture_as_pdf</span> PDF
                    </button>
                    {isAdviser && (
                      <button
                        className={s.status === "published" ? "btn-outline !px-2.5 !py-1.5 text-xs" : "btn-primary !px-2.5 !py-1.5 text-xs"}
                        disabled={busy}
                        onClick={() => toggleSheetPublish(s)}
                      >
                        <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">{s.status === "published" ? "undo" : "send"}</span>
                        {s.status === "published" ? "Unsend" : "Send"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {view && <ViewDialog sheet={view} onClose={() => setView(null)} />}
    </div>
  );
}
