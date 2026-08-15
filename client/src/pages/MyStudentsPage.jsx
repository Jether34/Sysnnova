import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import Spinner from "../components/Spinner.jsx";
import EncodeTable from "../components/EncodeTable.jsx";
import Modal from "../components/Modal.jsx";
import AnswerKeyModal from "../components/AnswerKeyModal.jsx";
import AnswerSheetTemplate from "../components/AnswerSheetTemplate.jsx";

import { SEMESTERS, academicYearOptions } from "../utils/constants.js";

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

const STORE_KEY = "agrimind:myStudents";

function readSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const SEMESTER_SHORT = {
  "1st Semester, 1st Quarter": "Sem 1 · Qtr 1",
  "1st Semester, 2nd Quarter": "Sem 1 · Qtr 2",
  "2nd Semester, 3rd Quarter": "Sem 2 · Qtr 3",
  "2nd Semester, 4th Quarter": "Sem 2 · Qtr 4",
};

const COMP_TYPES = {
  ww: { label: "Written Work", dot: "bg-sky-500", icon: "edit_note" },
  pt: { label: "Performance Task", dot: "bg-amber-500", icon: "task_alt" },
  qa: { label: "Quarterly Assessment", dot: "bg-emerald-500", icon: "fact_check" },
};

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function classLabel(c) {
  let l = `Grade ${c.grade}${c.strand && c.strand !== "N/A" ? ` · ${c.strand}` : ""} - Block ${c.section}`;
  if (c.tvlStrand) l += ` · ${c.tvlStrand}`;
  if (c.specialization) l += ` (${c.specialization})`;
  return l;
}

function assignmentLabel(a) {
  let l = `${a.subject} · Grade ${a.grade}${a.strand && a.strand !== "N/A" ? ` · ${a.strand}` : ""} - Block ${a.section}`;
  if (a.tvlStrand) l += ` · ${a.tvlStrand}`;
  if (a.specialization) l += ` (${a.specialization})`;
  l += ` · ${SEMESTER_SHORT[a.semester] || a.semester} · S.Y. ${a.academicYear}`;
  return l;
}

function matchesClass(a, b) {
  if (!a || !b) return false;
  return (
    String(a.grade) === String(b.grade) &&
    (a.strand || "") === (b.strand || "") &&
    String(a.section || "") === String(b.section || "") &&
    String(a.academicYear) === String(b.academicYear)
  );
}

function ClassChip({ label, sub, active, onClick, selected, onToggleSelect, showCheck }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border py-2 pl-3 pr-2 transition ${
        active ? "border-primary-400 bg-primary-50" : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      {showCheck && (
        <input
          type="checkbox"
          className="accent-primary-600 shrink-0"
          checked={Boolean(selected)}
          onChange={onToggleSelect}
          title={selected ? "Remove from bulk selection" : "Select for bulk submit"}
        />
      )}
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-800">
          <span className="truncate">{label}</span>
          {active && (
            <span className="material-symbols-outlined shrink-0 text-base text-primary-600" aria-hidden="true">check_circle</span>
          )}
        </div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </button>
    </div>
  );
}

function CardHeader({ title, meta, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3">
      <div className="min-w-0">
        <h2 className="truncate font-semibold text-slate-900">{title}</h2>
        {meta && <p className="mt-0.5 truncate text-xs text-slate-500">{meta}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

function EmptyState({ icon, title, msg }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <span className="material-symbols-outlined text-3xl text-slate-300" aria-hidden="true">{icon}</span>
      <p className="text-sm text-slate-500">{title}</p>
      {msg && <p className="text-xs text-slate-400">{msg}</p>}
    </div>
  );
}

function AddComponentModal({ open, onClose, type, onSubmit, busy, assignments, defaultAssignId, defaultSem }) {
  const [assignId, setAssignId] = useState("");
  const [label, setLabel] = useState("");
  const [item, setItem] = useState("20");
  const [qaSem, setQaSem] = useState("");

  const isQa = type === "qa";

  useEffect(() => {
    if (open) {
      setAssignId(defaultAssignId || assignments[0]?._id || assignments[0]?.id || "");
      setLabel("");
      setItem("20");
      setQaSem(isQa ? defaultSem || "" : "");
    }
  }, [open]);

  const chosen = assignments.find((a) => String(a._id || a.id) === String(assignId)) || null;
  const effectiveQaSem = qaSem || defaultSem || chosen?.semester || SEMESTERS[0];
  const semester = isQa ? effectiveQaSem : chosen?.semester || SEMESTERS[0];
  const ready = label.trim() && num(item) > 0 && Boolean(chosen);

  return (
    <Modal open={open} title={`Add ${COMP_TYPES[type]?.label || "Assessment"}`} onClose={busy ? undefined : onClose}>
      <div className="space-y-3">
        <div>
          <label className="label">Teaching assignment</label>
          <select className="input" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
            {assignments.map((a) => <option key={a._id || a.id} value={a._id || a.id}>{assignmentLabel(a)}</option>)}
          </select>
        </div>
        {chosen && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p><strong className="text-slate-900">Subject:</strong> {chosen.subject}</p>
            <p className="mt-0.5"><strong className="text-slate-900">Class:</strong> Grade {chosen.grade}{chosen.strand && chosen.strand !== "N/A" ? ` · ${chosen.strand}` : ""} - Block {chosen.section}</p>
            <p className="mt-0.5"><strong className="text-slate-900">S.Y.:</strong> {chosen.academicYear}</p>
          </div>
        )}
        {isQa ? (
          <div>
            <label className="label">Quarter / semester</label>
            <select className="input" value={effectiveQaSem} onChange={(e) => setQaSem(e.target.value)}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{SEMESTER_SHORT[s] || s}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Quarterly exams are recorded per quarter — pick the quarter the exam belongs to, which can be different from your assignment's own quarter.
            </p>
          </div>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Recorded under <strong className="text-slate-900">{chosen?.subject || "your chosen assignment"}</strong> · {SEMESTER_SHORT[chosen?.semester] || chosen?.semester || "your assignment's quarter"} — written works and performance tasks belong to the quarter of the teaching assignment.
          </p>
        )}
        <div>
          <label className="label">Label</label>
          <input className="input" placeholder={`e.g. ${type === "ww" ? "Quiz 1" : type === "pt" ? "Performance Task 2" : "Quarterly Exam"}`} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="label">Total items</label>
          <input className="input" type="number" min={1} max={50} step="any" value={item} onChange={(e) => setItem(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" disabled={busy} onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          disabled={busy || !ready}
          onClick={() => onSubmit({ assignment: chosen, label: label.trim(), item: num(item), type, semester })}
        >
          {busy ? "Adding..." : "Add component"}
        </button>
      </div>
    </Modal>
  );
}

export default function MyStudentsPage() {
  const { user } = useAuth();
  const { show, confirm } = useUI();
  const ays = academicYearOptions();

  const [classes, setClasses] = useState({ advisories: [], teachingLoad: [] });
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [railMode, setRailMode] = useState("classes");

  // Classes tab context
  const [classSelKind, setClassSelKind] = useState("");
  const [classSelId, setClassSelId] = useState("");
  const [classSem, setClassSem] = useState(SEMESTERS[0]);
  const [classAy, setClassAy] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLoads, setSelectedLoads] = useState(() => new Set());
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [submitNotes, setSubmitNotes] = useState("");

  // Components tab context
  const [focusAssignId, setFocusAssignId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [activeCompId, setActiveCompId] = useState(null);
  const [compLabel, setCompLabel] = useState("");
  const [compItem, setCompItem] = useState(20);
  const [compScores, setCompScores] = useState({});
  const [compBusy, setCompBusy] = useState(false);
  const [addCompType, setAddCompType] = useState(null);
  const [addCompSem, setAddCompSem] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // OMR / Scan-to-Check state
  const [showAnswerKey, setShowAnswerKey] = useState(false);


  const tl = classes.teachingLoad || [];

  const focusAssign = focusAssignId ? tl.find((a) => String(a._id || a.id) === String(focusAssignId)) || null : null;

  const classSel =
    classSelKind === "teaching"
      ? (() => {
          const a = tl.find((x) => String(x._id || x.id) === String(classSelId));
          return a ? { kind: "teaching", ...a } : null;
        })()
      : null;

  const load = (opts = {}) => {
    const { initial = false } = opts;
    api
      .get("/users/me/classes")
      .then(({ data }) => {
        setClasses(data);
        const t = data.teachingLoad || [];
        const saved = readSaved();

        const params = new URLSearchParams(window.location.search);
        const loadId = params.get("load");
        const linked = loadId ? t.find((x) => String(x._id || x.id) === String(loadId)) || null : null;

        if (!initial) {
          setHydrated(true);
          setLoading(false);
          return;
        }

        let selKind = "";
        let selId = "";
        let subject = "";
        if (linked) {
          selKind = "teaching";
          selId = String(linked._id || linked.id);
          subject = linked.subject;
        }
        if (!selId && saved && saved.kind === "teaching") {
          const m = t.find((x) =>
            matchesClass(x, { grade: saved.grade, strand: saved.strand || "", section: saved.section, academicYear: saved.clsAy || x.academicYear })
          );
          if (m) { selKind = "teaching"; selId = String(m._id || m.id); subject = m.subject; }
        }
        if (!selId && t.length) {
          selKind = "teaching";
          selId = String(t[0]._id || t[0].id);
          subject = t[0].subject;
        }
        setClassSelKind(selKind);
        setClassSelId(selId);
        setClassSubject(subject);

        let fa = linked;
        if (!fa && saved && saved.kind === "teaching") {
          fa =
            t.find(
              (x) =>
                matchesClass(x, { grade: saved.grade, strand: saved.strand || "", section: saved.section, academicYear: saved.clsAy || x.academicYear }) &&
                (!saved.subject || x.subject === saved.subject)
            ) || null;
        }
        if (!fa) fa = t[0] || null;
        setFocusAssignId(fa ? String(fa._id || fa.id) : "");

        if (linked) {
          setClassSem(linked.semester);
          setClassAy(linked.academicYear);
          setRailMode("classes");
          window.history.replaceState({}, "", window.location.href.split("?")[0]);
        } else {
          if (saved?.kind !== "teaching" && saved?.subject) setClassSubject(saved.subject);
          setClassSem(saved && SEMESTERS.includes(saved.sem) ? saved.sem : SEMESTERS[0]);
          const ay = saved?.ay && ays.includes(saved.ay) ? saved.ay : t[0]?.academicYear || ays[0];
          setClassAy(ay);
          setRailMode(saved?.railMode === "components" ? "components" : "classes");
        }

        setHydrated(true);
      })
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load({ initial: true }); }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load({ initial: false });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const inClasses = railMode === "classes";
    const ctx = inClasses ? classSel : focusAssign ? { kind: "teaching", ...focusAssign } : null;
    if (!ctx) return;
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        kind: inClasses ? classSelKind : "teaching",
        grade: ctx.grade,
        strand: ctx.strand || "",
        section: ctx.section,
        clsAy: ctx.academicYear,
        ay: inClasses ? classAy : ctx.academicYear,
        subject: inClasses ? classSubject : focusAssign?.subject || "",
        sem: inClasses ? classSem : focusAssign?.semester || "",
        railMode,
      })
    );
  }, [hydrated, railMode, classSelKind, classSelId, classSem, classAy, classSubject, focusAssignId]);

  // Class tally for the Classes tab — only this teacher's own recorded components on the assignment.
  useEffect(() => {
    if (!classSel || !classSubject || !classSem || !classAy) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setSummaryLoading(true);
    api
      .get("/assessments/summary", {
        params: {
          grade: classSel.grade,
          strand: classSel.strand || "",
          section: classSel.section,
          ay: classAy,
          subject: classSubject,
          semester: classSem,
          scope: "mine",
          specialization: classSel.specialization || "",
          tvlStrand: classSel.tvlStrand || "",
        },
      })
      .then(({ data }) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (!cancelled) show(err.message, "error");
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classSelKind, classSelId, classSubject, classSem, classAy, refreshKey]);

  // The teacher's own components for the focused teaching assignment.
  useEffect(() => {
    if (!focusAssign) {
      setAssessments([]);
      setActiveCompId(null);
      return;
    }
    let cancelled = false;
    setAssessmentsLoading(true);
    api
      .get("/assessments", {
        params: {
          grade: focusAssign.grade,
          strand: focusAssign.strand || "",
          section: focusAssign.section,
          ay: focusAssign.academicYear,
          subject: focusAssign.subject,
          specialization: focusAssign.specialization || "",
          tvlStrand: focusAssign.tvlStrand || "",
        },
      })
      .then(({ data }) => {
        if (!cancelled) setAssessments(data?.assessments || []);
      })
      .catch((err) => {
        if (!cancelled) show(err.message, "error");
      })
      .finally(() => {
        if (!cancelled) setAssessmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [focusAssignId, classes.teachingLoad]);

  const activeComp = assessments.find((a) => String(a._id) === String(activeCompId)) || null;

  const liveTotals = (() => {
    const t = {
      ww: { count: 0, items: 0, scored: 0, total: 0 },
      pt: { count: 0, items: 0, scored: 0, total: 0 },
      qa: { count: 0, items: 0, scored: 0, total: 0 },
    };
    for (const rec of assessments) {
      const bucket = t[rec.type];
      if (!bucket) continue;
      const isActive = activeComp && String(activeComp._id) === String(rec._id);
      const base = isActive && num(compItem) > 0 ? num(compItem) : num(rec.item) > 0 ? num(rec.item) : 0;
      bucket.count += 1;
      bucket.items += base;
      for (const sc of rec.scores || []) {
        const score = isActive ? num(compScores[String(sc.studentId)]) : num(sc.score);
        if (score !== null) {
          bucket.scored += 1;
          bucket.total += score;
        }
      }
    }
    return t;
  })();

  const renderLiveTotals = () => (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-200 px-5 py-3">
      {["ww", "pt", "qa"].map((k) => {
        const c = liveTotals[k];
        const openOfType = activeComp && activeComp.type === k;
        return (
          <div key={k} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${COMP_TYPES[k].dot}`} />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{COMP_TYPES[k].label}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{c.items}</span>
              <span className="text-xs text-slate-500">items · {c.count} comp{c.count === 1 ? "" : "s"}</span>
            </div>
            {openOfType && (
              <div className="truncate text-[11px] font-medium text-primary-600" title={compLabel}>
                Open: {compLabel} · {num(compItem) > 0 ? num(compItem) : activeComp.item} items
              </div>
            )}
            <div className="text-xs text-slate-500">
              {c.scored} score{c.scored === 1 ? "" : "s"} · {c.total.toLocaleString()} pts entered
            </div>
          </div>
        );
      })}
    </div>
  );

  const goClasses = () => {
    setRailMode("classes");
    setActiveCompId(null);
    const current = tl.find((x) => String(x._id || x.id) === String(classSelId));
    const target = current || tl[0];
    if (target) {
      setClassSelKind("teaching");
      setClassSelId(String(target._id || target.id));
      setClassAy(target.academicYear);
      setClassSem(target.semester);
      setClassSubject(target.subject);
    }
  };

  const goComponents = () => {
    setRailMode("components");
    setActiveCompId(null);
    if (!focusAssignId && tl.length) setFocusAssignId(String(tl[0]._id || tl[0].id));
  };

  const selectClassChip = (cls) => {
    setClassSelKind(cls.kind);
    setClassSelId(String(cls._id || cls.id));
    setClassAy(cls.academicYear);
    setClassSem(cls.semester);
    setClassSubject(cls.subject);
    setActiveCompId(null);
  };

  const toggleLoad = (id) => {
    setSelectedLoads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSubmit = async () => {
    const loads = tl.filter((a) => selectedLoads.has(String(a._id || a.id)));
    if (loads.length === 0) return;
    const ok = await confirm({
      title: `Generate grades for ${loads.length} teaching load${loads.length === 1 ? "" : "s"}?`,
      message: `Compute every student's grade from your recorded WW / PT / QA components and route each list to its class adviser. Students missing components (absences) are included and flagged incomplete.`,
      confirmLabel: `Generate & submit all (${loads.length})`,
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const { data } = await api.post("/assessments/submit-bulk", {
        assignments: loads.map((a) => ({
          grade: a.grade,
          strand: a.strand || "",
          section: a.section,
          academicYear: a.academicYear,
          subject: a.subject,
          semester: a.semester,
          specialization: a.specialization || "",
          tvlStrand: a.tvlStrand || "",
          notes: submitNotes,
        })),
      });
      const fails = data.results.filter((r) => !r.ok);
      const oks = data.results.filter((r) => r.ok);
      if (oks.length) show(`${data.message} ${oks.length} routed to their advisers.`);
      if (fails.length) {
        show(`Could not submit ${fails.length}: ${fails.map((f) => `${f.label} — ${f.error}`).join(" ")}`, "error");
      }
      setSelectedLoads(new Set());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    const loads = tl.filter((a) => selectedLoads.has(String(a._id || a.id)));
    if (loads.length === 0) return;
    const ok = await confirm({
      title: `Remove ${loads.length} teaching assignment${loads.length === 1 ? "" : "s"}?`,
      message: `Stop teaching ${loads.map((a) => a.subject).join(", ")} in these classes? Your already-submitted grades stay as-is.`,
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const { data } = await api.delete("/users/me/classes", {
        data: { ids: loads.map((a) => String(a._id || a.id)) },
      });
      show(data.message);
      const res = await api.get("/users/me/classes");
      setClasses(res.data);
      const t = res.data.teachingLoad || [];
      const still = classSelId && t.find((x) => String(x._id || x.id) === String(classSelId));
      if (t.length === 0) {
        setClassSelKind("");
        setClassSelId("");
        setClassSubject("");
        setFocusAssignId("");
      } else if (!still) {
        const a = t[0];
        setClassSelKind("teaching");
        setClassSelId(String(a._id || a.id));
        setClassAy(a.academicYear);
        setClassSem(a.semester);
        setClassSubject(a.subject);
        setFocusAssignId(String(a._id || a.id));
      }
      setSelectedLoads(new Set());
      setRefreshKey((k) => k + 1);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const changeFocusAssign = (id) => {
    setFocusAssignId(id);
    setActiveCompId(null);
  };

  const moveMatrixScore = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const idx = Number(e.currentTarget.dataset.idx);
    const next = [...document.querySelectorAll("input[data-matrix-score]")]
      .filter((el) => Number(el.dataset.idx) > idx)
      .sort((a, b) => Number(a.dataset.idx) - Number(b.dataset.idx))[0];
    if (next) {
      next.focus();
      next.select();
    }
  };

  const openComponent = (rec) => {
    setActiveCompId(String(rec._id));
    setCompItem(rec.item || 20);
    setCompLabel(rec.label);
    const m = {};
    for (const sc of rec.scores || []) m[String(sc.studentId)] = sc.score ?? "";
    setCompScores(m);
  };

  const saveComponent = async () => {
    if (!activeComp) return;
    const itemsTotal = num(compItem) > 0 ? num(compItem) : activeComp.item;
    const bad = (activeComp.scores || []).find((sc) => {
      const item = num(sc.item) > 0 ? num(sc.item) : itemsTotal;
      const score = num(compScores[String(sc.studentId)]);
      return score !== null && item > 0 && score > item;
    });
    if (bad) {
      show(`${bad.lastName}, ${bad.firstName}: score cannot exceed ${num(bad.item) > 0 ? num(bad.item) : itemsTotal} items.`, "error");
      return;
    }
    setCompBusy(true);
    try {
      const payload = (activeComp.scores || []).map((sc) => ({
        studentId: sc.studentId,
        score: compScores[String(sc.studentId)] ?? null,
        item: null,
      }));
      const { data } = await api.put(`/assessments/${activeComp._id}`, {
        label: compLabel,
        title: activeComp.subject,
        item: num(compItem) > 0 ? num(compItem) : activeComp.item,
        scores: payload,
      });
      show(data.message);
      const updated = assessments.map((a) => (String(a._id) === String(activeComp._id) ? data.assessment : a));
      setAssessments(updated);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setCompBusy(false);
    }
  };

  const deleteComponent = async (rec) => {
    const ok = await confirm({
      title: "Delete assessment component?",
      message: `Delete ${rec.label}? Its scores will no longer count toward the class tally for ${rec.subject}.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const { data } = await api.delete(`/assessments/${rec._id}`);
      show(data.message);
      if (String(activeCompId) === String(rec._id))       setActiveCompId(null);
      setAssessments((prev) => prev.filter((a) => String(a._id) !== String(rec._id)));
      setRefreshKey((k) => k + 1);
    } catch (err) {
      show(err.message, "error");
    }
  };

  const addComponent = async ({ assignment, label, item, type, semester }) => {
    if (!assignment) return;
    setAddBusy(true);
    try {
      const { data } = await api.post("/assessments", {
        grade: assignment.grade,
        strand: assignment.strand || "",
        section: assignment.section,
        academicYear: assignment.academicYear,
        subject: assignment.subject,
        semester: semester || assignment.semester,
        specialization: assignment.specialization || "",
        tvlStrand: assignment.tvlStrand || "",
        type,
        label,
        item,
      });
      show(data.message);
      setAddCompType(null);
      setFocusAssignId(String(assignment._id || assignment.id));
      setRailMode("components");
      openComponent(data.assessment);
      setAssessments((prev) => {
        const without = prev.filter((a) => String(a._id) !== String(data.assessment._id));
        return [...without, data.assessment].sort((a, b) => (a.semester || "").localeCompare(b.semester || "") || String(a.type || "").localeCompare(String(b.type || "")) || String(a.label || "").localeCompare(String(b.label || "")));
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      show(err.message, "error");
    } finally {
      setAddBusy(false);
    }
  };

  const buildTally = (summaryData) => {
    const scores = {};
    const items = { ww: 0, pt: 0, qa: 0 };
    for (const st of summaryData?.students || []) {
      scores[String(st.id)] = {
        ww: st.ww,
        wwItems: st.wwItems,
        pt: st.pt,
        ptItems: st.ptItems,
        qa: st.qa,
        qaItems: st.qaItems,
      };
    }
    if (summaryData?.totals) {
      items.ww = summaryData.totals.wwItems || 0;
      items.pt = summaryData.totals.ptItems || 0;
      items.qa = summaryData.totals.qaItems || 0;
    }
    return { scores, items };
  };

  const renderTally = (summaryData, loadingFlag, emptyNode) => {
    if (loadingFlag) return <div className="flex flex-1 items-center justify-center py-10"><Spinner /></div>;
    const students = summaryData?.students || [];
    const totals = summaryData?.totals || {};
    const hasItems = (totals.wwItems || 0) + (totals.ptItems || 0) + (totals.qaItems || 0) > 0;
    if (students.length === 0) return emptyNode;
    const { scores, items } = buildTally(summaryData);
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">
          <EncodeTable
            compact
            fill
            readOnly
            showItems
            roster={students}
            scores={scores}
            setScore={() => {}}
            items={items}
          />
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <span className="material-symbols-outlined text-base" aria-hidden="true">summarize</span>
          <span>
            WW / PT / QA columns are the running totals summed from every recorded component — items grow as more quizzes are added and scores grow as they are entered. The transmuted grade is computed from the summed score against the summed items (WW 30% + PT 50% + QA 20%).
          </span>
        </p>
      </>
    );
  };

  const renderClassSelectors = () => {
    if (!classSel) return null;
    return (
      <div className="space-y-2">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Search teaching loads</label>
          <div className="relative mt-0.5">
            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base text-slate-400" aria-hidden="true">search</span>
            <input
              className="input !py-1.5 !pl-8 !pr-3 text-sm"
              placeholder="Subject, grade, block, S.Y…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quarter</label>
            <select
              className="input mt-0.5 !py-1.5 text-sm"
              value={classSem}
              onChange={(e) => setClassSem(e.target.value)}
            >
              {SEMESTERS.map((s) => <option key={s} value={s}>{SEMESTER_SHORT[s] || s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">S.Y.</label>
            <select
              className="input mt-0.5 !py-1.5 text-sm"
              value={classAy}
              onChange={(e) => setClassAy(e.target.value)}
            >
              {ays.map((y) => <option key={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderClassesRail = () => {
    if (tl.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center">
          <span className="material-symbols-outlined text-3xl text-slate-300" aria-hidden="true">groups</span>
          <p className="text-xs text-slate-400">No teaching assignments yet — classes are shown per teaching assignment.</p>
        </div>
      );
    }
    const q = search.trim().toLowerCase();
    const filtered = tl.filter((a) => {
      if (!q) return true;
      const hay = [a.subject, a.grade, a.strand, a.section, a.semester, a.academicYear].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Teaching load{selectedLoads.size > 0 ? ` · ${selectedLoads.size} selected` : ""}
          </p>
        </div>
        {selectedLoads.size > 0 && (
          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Notes for adviser (optional)</label>
              <textarea
                className="input mt-0.5 !py-1.5 text-sm resize-none"
                rows={2}
                placeholder="Add any notes for your adviser about these submissions..."
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                className="btn-primary !px-2.5 !py-1.5 text-xs"
                disabled={bulkBusy}
                onClick={bulkSubmit}
                title="Generate grades for the selected loads and route them to their advisers"
              >
                <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">auto_awesome</span>
                {bulkBusy ? "Submitting..." : `Submit (${selectedLoads.size})`}
              </button>
              <button
                type="button"
                className="btn-danger !px-2.5 !py-1.5 text-xs"
                disabled={bulkBusy}
                onClick={bulkDelete}
                title="Remove the selected teaching assignments"
              >
                <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">delete</span>
                Delete
              </button>
              <button
                type="button"
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => { setSelectedLoads(new Set()); setSubmitNotes(""); }}
              >
                Clear
              </button>
            </div>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-400">
            No teaching loads match "{search}".
          </p>
        ) : (
          filtered.map((a) => {
            const cls = { kind: "teaching", ...a };
            const id = String(a._id || a.id);
            const active = classSelKind === "teaching" && String(classSelId) === id;
            return (
              <ClassChip
                key={id}
                label={`${a.subject} · ${classLabel(a)}`}
                sub={`${SEMESTER_SHORT[a.semester] || a.semester} · S.Y. ${a.academicYear}${active ? " · viewing" : ""}`}
                active={active}
                onClick={() => selectClassChip(cls)}
                showCheck
                selected={selectedLoads.has(id)}
                onToggleSelect={() => toggleLoad(id)}
              />
            );
          })
        )}
      </div>
    );
  };

  const buildSemGroups = () => {
    const map = new Map();
    for (const a of assessments) {
      const k = a.semester || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(a);
    }
    const focusSem = focusAssign?.semester || "";
    if (focusSem && !map.has(focusSem)) map.set(focusSem, []);
    const keys = [...map.keys()].sort((x, y) => {
      if (x === focusSem) return -1;
      if (y === focusSem) return 1;
      return SEMESTERS.indexOf(x) - SEMESTERS.indexOf(y);
    });
    return keys.map((k) => ({
      semester: k,
      list: map.get(k).slice().sort((a, b) => String(a.type || "").localeCompare(String(b.type || "")) || String(a.label || "").localeCompare(String(b.label || ""))),
    }));
  };

  const renderComponentsRail = () => {
    if (tl.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center">
          <span className="material-symbols-outlined text-3xl text-slate-300" aria-hidden="true">edit_off</span>
          <p className="text-xs text-slate-400">No teaching assignments yet — components are recorded per teaching assignment.</p>
        </div>
      );
    }
    const groups = buildSemGroups();
    return (
      <div className="space-y-3">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Teaching assignment</label>
          <select className="input mt-0.5 !py-1.5 text-sm" value={focusAssignId} onChange={(e) => changeFocusAssign(e.target.value)}>
            {tl.map((a) => <option key={a._id || a.id} value={a._id || a.id}>{assignmentLabel(a)}</option>)}
          </select>
        </div>
        {assessmentsLoading ? (
          <div className="py-6"><Spinner /></div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-300" aria-hidden="true">edit_note</span>
            <p className="text-xs text-slate-400">No components yet — add a written work, performance task or quarterly assessment to start recording scores.</p>
          </div>
        ) : (
          groups.map((g) => {
            const isOwn = g.semester === focusAssign.semester;
            const types = isOwn ? ["ww", "pt", "qa"] : ["qa"];
            return (
              <div key={g.semester || "none"} className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {SEMESTER_SHORT[g.semester] || g.semester}
                  {isOwn && <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium normal-case text-primary-700">assignment quarter</span>}
                </p>
                {types.map((type) => {
                  const list = g.list.filter((a) => a.type === type);
                  const filled = list.filter((a) => a.scores?.some((s) => num(s.score) !== null)).length;
                  return (
                    <div key={type}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <span className={`h-2 w-2 rounded-full ${COMP_TYPES[type].dot}`} />
                          {COMP_TYPES[type].label}
                          <span className="normal-case text-slate-400">({filled}/{list.length})</span>
                        </p>
                        <button
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 hover:text-primary-700"
                          onClick={() => { setAddCompSem(g.semester); setAddCompType(type); }}
                          title={`Add ${COMP_TYPES[type].label}`}
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span>
                        </button>
                      </div>
                      {list.length === 0 && <p className="mb-2 text-xs text-slate-400">None yet — add one to record scores.</p>}
                      <div className="space-y-1.5">
                        {list.map((rec) => {
                          const active = String(activeCompId) === String(rec._id);
                          return (
                            <div
                              key={rec._id}
                              className={`group cursor-pointer rounded-lg border px-3 py-2 transition ${
                                active ? "border-primary-400 bg-primary-50" : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                              onClick={() => openComponent(rec)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-800">{rec.subject}</div>
                                  <div className="truncate text-xs text-slate-500">{rec.label}</div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <span className="text-xs font-bold text-slate-500" title="Total items">{rec.item} item{rec.item === 1 ? "" : "s"}</span>
                                  <button
                                    className="text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                                    onClick={(e) => { e.stopPropagation(); deleteComponent(rec); }}
                                    title="Delete"
                                  >
                                    <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {!isOwn && (
                  <p className="text-[11px] leading-snug text-slate-400">Only quarterly assessments can be recorded outside your assignment's own quarter.</p>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderComponentMatrix = () => {
    if (!activeComp) return null;
    const roster = [...(activeComp.scores || [])].sort(compareStudents);
    const itemsTotal = num(compItem) > 0 ? num(compItem) : activeComp.item;
    return (
      <>
        <div className="min-h-0 flex-1 overflow-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="table w-full min-w-0 [&_th]:!px-2 [&_th]:!py-1 [&_td]:!px-2 [&_td]:!py-0.5">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900">Student</th>
                  <th className="text-center">Score</th>
                  <th className="text-center">Items</th>
                  <th className="text-center">%</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((sc, i) => {
                  const key = String(sc.studentId);
                  const item = num(sc.item) > 0 ? num(sc.item) : itemsTotal;
                  const score = num(compScores[key]);
                  const pct = item > 0 && score !== null ? Math.min(100, Math.round((score / item) * 1000) / 10) : null;
                  return (
                    <tr key={key}>
                      <td className="sticky left-0 whitespace-nowrap bg-white font-semibold text-slate-900 dark:bg-slate-950">{sc.lastName}, {sc.firstName}</td>
                      <td>
                        <input
                          type="number" min={0} max={item} step="any" placeholder="0"
                          data-matrix-score
                          data-idx={i}
                          onKeyDown={moveMatrixScore}
                          className="w-full min-w-14 appearance-none rounded-md border-0 bg-transparent px-1.5 py-1 text-center text-sm text-slate-900 outline-none transition hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={compScores[key] ?? ""}
                          title={`Max ${item} items`}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = num(v);
                            if (v !== "" && n === null) return;
                            if (n !== null && item > 0 && n > item) return;
                            setCompScores((m) => ({ ...m, [key]: v }));
                          }}
                        />
                      </td>
                      <td className="text-center font-medium text-slate-500">{item > 0 ? item : "—"}</td>
                      <td className="text-center font-semibold text-slate-700">{pct !== null ? `${pct}%` : "—"}</td>
                    </tr>
                  );
                })}
                {roster.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No students in this class.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span className="text-xs text-slate-400">
            Items auto-fill from the component total ({itemsTotal}) · only scores need typing · {activeComp.subject} · {SEMESTER_SHORT[activeComp.semester] || activeComp.semester} · S.Y. {activeComp.academicYear}
          </span>
          <button className="btn-outline !py-2" onClick={() => setActiveCompId(null)}>Close</button>
          <button className="btn-primary !py-2" disabled={compBusy} onClick={saveComponent}>
            {compBusy ? "Saving..." : "Save component"}
          </button>
        </div>
      </>
    );
  };

  const renderClassesPanel = () => {
    if (!classSel) {
      return <EmptyState icon="groups" title="Select a teaching load" msg="Choose one of your teaching loads from the list to see its tally and computed grades." />;
    }
    return (
      <>
        <CardHeader
          title="Class Tally"
          meta={`Now viewing: ${classLabel(classSel)} · ${classSubject} · ${SEMESTER_SHORT[classSem] || classSem} · S.Y. ${classAy}`}
        >
          {summary?.components && (
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(COMP_TYPES).map((type) => (
                <span key={type} className="badge-neutral" title={`${COMP_TYPES[type].label} components`}>
                  <span className={`inline-block h-2 w-2 rounded-full ${COMP_TYPES[type].dot}`} />
                  {COMP_TYPES[type].label}: {summary.components[type]}
                </span>
              ))}
            </div>
          )}
        </CardHeader>
        <div className="flex min-h-0 flex-1 flex-col p-4">
          {renderTally(
            summary,
            summaryLoading,
            <EmptyState icon="quiz" title="No grades recorded yet" msg="Once components are added and scores are entered, the tally and transmuted grade appear here." />
          )}
        </div>
      </>
    );
  };

  const renderComponentsPanel = () => {
    if (activeComp) {
      return (
        <>
          <CardHeader
            title={`${activeComp.subject} · ${classLabel({ grade: activeComp.gradeLevel, strand: activeComp.strand || "", section: activeComp.section })}`}
            meta={`${COMP_TYPES[activeComp.type]?.label || "Assessment"} — ${compLabel} · ${SEMESTER_SHORT[activeComp.semester] || activeComp.semester} · S.Y. ${activeComp.academicYear}`}
          >
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Total items
              <input
                className="input !w-20 !py-1.5 text-sm text-center"
                type="number" min={1} step="any"
                value={compItem}
                onChange={(e) => setCompItem(e.target.value)}
              />
            </label>
          </CardHeader>
          {renderLiveTotals()}
          {renderComponentMatrix()}
          {activeComp.type === "qa" && (
            <div className="border-t border-slate-200 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-outline text-xs" onClick={() => setShowAnswerKey(true)}>
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">key</span>
                  {activeComp.answerKey?.length ? "Edit Answer Key" : "Set Answer Key"}
                </button>
                {activeComp.answerKey?.length > 0 && (
                  <AnswerSheetTemplate assessment={activeComp} />
                )}
              </div>
            </div>
          )}
        </>
      );
    }
    if (!focusAssign) {
      return <EmptyState icon="edit_off" title="No teaching assignment" msg="You have no teaching assignments yet to record assessment components." />;
    }
    return (
      <>
        <CardHeader
          title={focusAssign.subject}
          meta={`${classLabel(focusAssign)} · ${SEMESTER_SHORT[focusAssign.semester] || focusAssign.semester} · S.Y. ${focusAssign.academicYear}`}
        />
        {renderLiveTotals()}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <EmptyState
            icon="edit_note"
            title="Select a component to enter scores"
            msg="Pick a written work, performance task or quarterly assessment from the left. Component titles are the subject and the label is shown as its subtitle."
          />
        </div>
      </>
    );
  };

  if (loading) return <Spinner />;

  const hasAny = tl.length > 0;

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:h-[calc(100vh-5rem)] lg:overflow-hidden">
      <div className="shrink-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 lg:text-2xl">My Students</h1>
        <p className="mt-0.5 text-xs text-slate-500 lg:text-sm">
          Classes shows the tally and computed grade for each of your teaching loads — search, select one, or check several to generate and route grades to their advisers in one go. Components is where you record quizzes, performance tasks and quarterly exams per teaching assignment. Grade review and publishing happen on the Submitted Grades page.
        </p>
      </div>

      {!hasAny ? (
        <div className="card flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300" aria-hidden="true">groups</span>
          <p className="max-w-md text-sm text-slate-500">
            You don't have any teaching assignments yet. Add one from your dashboard to see your students here.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:grid-rows-1">
          <div className="card flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-slate-200 p-3">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  onClick={goClasses}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                    railMode === "classes" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Classes
                </button>
                <button
                  onClick={goComponents}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                    railMode === "components" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Components
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {railMode === "classes" ? (
                <>
                  {renderClassSelectors()}
                  {renderClassesRail()}
                </>
              ) : (
                renderComponentsRail()
              )}
            </div>
          </div>

          <div className="card flex min-h-0 flex-col overflow-hidden">
            {railMode === "classes" ? renderClassesPanel() : renderComponentsPanel()}
          </div>
        </div>
      )}

      {addCompType && (
        <AddComponentModal
          open
          type={addCompType}
          onClose={() => setAddCompType(null)}
          onSubmit={addComponent}
          busy={addBusy}
          assignments={tl}
          defaultAssignId={focusAssignId}
          defaultSem={addCompSem}
        />
      )}

      {showAnswerKey && activeComp && (
        <AnswerKeyModal
          open
          assessment={activeComp}
          onClose={() => setShowAnswerKey(false)}
          onSaved={(updated) => {
            setAssessments((prev) => prev.map((a) => (String(a._id) === String(updated._id) ? updated : a)));
            setRefreshKey((k) => k + 1);
          }}
        />
      )}


    </div>
  );
}
