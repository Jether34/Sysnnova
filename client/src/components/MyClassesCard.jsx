import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "./ui.jsx";
import Modal from "./Modal.jsx";
import { GRADE_LEVELS, STRANDS, SEMESTERS, BLOCKS, isShsGrade, subjectsFor, academicYearOptions, TVL_STRANDS, specializationsFor } from "../utils/constants.js";

function SelectorRow({ cls, setCls, includeAdvisory, ays, compact = false }) {
  const shs = isShsGrade(cls.grade);
  const isTVL = cls.strand === "TVL";
  const subjectOptions = subjectsFor(cls.grade);
  const tvlSpecs = isTVL ? specializationsFor(cls.tvlStrand || "") : [];
  const set = (patch) => setCls({ ...cls, ...patch });
  const grid = `grid gap-3 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`;

  const [blockOptions, setBlockOptions] = useState(isTVL ? [] : null);
  const filterKey = isTVL ? `${cls.grade}|${cls.tvlStrand || ""}|${cls.specialization || ""}|${cls.academicYear || ""}` : "";
  useEffect(() => {
    let active = true;
    if (!isTVL) { setBlockOptions(null); return; }
    setBlockOptions(null);
    api
      .get("/users/class-blocks", { params: { grade: cls.grade, strand: cls.strand, tvlStrand: cls.tvlStrand, specialization: cls.specialization, ay: cls.academicYear } })
      .then(({ data }) => {
        if (!active) return;
        setBlockOptions(data.blocks);
        if (cls.section && data.blocks.length && !data.blocks.includes(cls.section)) set({ section: "" });
      })
      .catch(() => { if (active) setBlockOptions(null); });
    return () => { active = false; };
  }, [filterKey, cls.grade, cls.strand, isTVL]);
  const blockList = blockOptions && blockOptions.length ? blockOptions : BLOCKS;

  return (
    <div className="space-y-3">
      <div className={grid}>
        <div>
          <label className="label">Grade level</label>
          <select className="input" value={cls.grade}
            onChange={(e) => {
              const g = e.target.value;
              const list = subjectsFor(g);
              set({ grade: g, strand: isShsGrade(g) ? cls.strand : "", section: "", tvlStrand: "", specialization: "" });
              if (!list.includes(cls.subject)) set({ subject: list[0] });
            }}>
            {GRADE_LEVELS.map((g) => <option key={g} value={g}>{`Grade ${g}`}</option>)}
          </select>
        </div>
        {shs ? (
          <div>
            <label className="label">Strand (SHS)</label>
            <select className="input" value={cls.strand} onChange={(e) => set({ strand: e.target.value, section: "", tvlStrand: "", specialization: "" })}>
              {STRANDS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        ) : (
          !compact && <div className="hidden sm:block" />
        )}
      </div>

      {isTVL && (
        <div className={grid}>
          <div>
            <label className="label">TVL Track</label>
            <select className="input" value={cls.tvlStrand || ""} onChange={(e) => set({ tvlStrand: e.target.value, specialization: "" })}>
              <option value="">Select TVL track...</option>
              {TVL_STRANDS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(cls.tvlStrand || "") && tvlSpecs.length > 0 && (
            <div>
              <label className="label">Specialization</label>
              <select className="input" value={cls.specialization || ""} onChange={(e) => set({ specialization: e.target.value })}>
                <option value="">Select specialization...</option>
                {tvlSpecs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <div className={grid}>
        <div>
          <label className="label">Section / Block</label>
          <select className="input" value={cls.section} onChange={(e) => set({ section: e.target.value })}>
            <option value="">Select section/block...</option>
            {blockList.map((b) => <option key={b} value={b}>{`Block ${b}`}</option>)}
          </select>
          {isTVL && blockOptions && blockOptions.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              Blocks with students in this {cls.specialization ? "specialization" : "TVL track"} only.
            </p>
          )}
        </div>
        <div>
          <label className="label">Academic year</label>
          <select className="input" value={cls.academicYear} onChange={(e) => set({ academicYear: e.target.value })}>
            {ays.map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>
      {includeAdvisory && (
        <div className={grid}>
          <div>
            <label className="label">Subject</label>
            <select className="input" value={cls.subject} onChange={(e) => set({ subject: e.target.value })}>
              {subjectOptions.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select className="input" value={cls.semester} onChange={(e) => set({ semester: e.target.value })}>
              {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function ClassChip({ label, sub, onRemove, canRemove, onClick }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {onClick ? (
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left" title="Open in My Students">
          <div className="flex items-center gap-1 truncate text-sm font-semibold text-slate-800 hover:text-primary-600">
            <span className="truncate">{label}</span>
            <span className="material-symbols-outlined shrink-0 text-base text-slate-400" aria-hidden="true">arrow_forward</span>
          </div>
          {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
        </button>
      ) : (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800">{label}</div>
          {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
        </div>
      )}
      {canRemove && (
        <button className="text-slate-400 hover:text-red-600 shrink-0" onClick={onRemove} title="Remove">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
        </button>
      )}
    </div>
  );
}

export default function MyClassesCard({ compact = false, className = "" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show, confirm } = useUI();
  const ays = academicYearOptions();
  const chipGrid = `grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`;

  const [data, setData] = useState({ advisories: [], teachingLoad: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(null);
  const [classForm, setClassForm] = useState({
    grade: user.grade, strand: isShsGrade(user.grade) ? user.strand : "", section: "",
    academicYear: user.academicYear, subject: subjectsFor(user.grade).includes(user.subject) ? user.subject : subjectsFor(user.grade)[0],
    semester: user.semester || SEMESTERS[0], tvlStrand: "", specialization: "",
  });
  const [advisoryForm, setAdvisoryForm] = useState({
    grade: user.grade, strand: isShsGrade(user.grade) ? user.strand : "", section: "", academicYear: user.academicYear, tvlStrand: "", specialization: "",
  });

  const load = () =>
    api.get("/users/me/classes")
      .then(({ data }) => setData(data))
      .catch((err) => show(err.message, "error"))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const addClass = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/users/me/classes", classForm);
      show(data.message);
      setClassForm((f) => ({ ...f, section: "", tvlStrand: "", specialization: "" }));
      setAdding(null);
      await load();
    } catch (err) { show(err.message, "error"); } finally { setBusy(false); }
  };

  const addAdvisory = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/users/me/advisories", advisoryForm);
      show(data.message);
      setAdvisoryForm((f) => ({ ...f, section: "", tvlStrand: "", specialization: "" }));
      setAdding(null);
      await load();
    } catch (err) { show(err.message, "error"); } finally { setBusy(false); }
  };

  const removeClass = async (a) => {
    const ok = await confirm({ title: "Remove teaching assignment?", message: `Stop teaching ${a.subject} in Grade ${a.grade}${a.strand ? " - " + a.strand : ""}${a.tvlStrand ? " (" + a.tvlStrand + (a.specialization ? " - " + a.specialization : "") + ")" : ""} - ${a.section}? Your already-submitted grades stay as-is.`, confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/users/me/classes/${a.id}`);
      show(data.message);
      await load();
    } catch (err) { show(err.message, "error"); } finally { setBusy(false); }
  };

  const removeAdvisory = async (a) => {
    const ok = await confirm({ title: "Remove advisory class?", message: `Stop advising Grade ${a.grade}${a.strand ? " - " + a.strand : ""} - ${a.section}?`, confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await api.delete(`/users/me/advisories/${a.id}`);
      show(data.message);
      await load();
    } catch (err) { show(err.message, "error"); } finally { setBusy(false); }
  };

  const label = (a) => {
    let l = `Grade ${a.grade}${a.strand && a.strand !== "N/A" ? ` · ${a.strand}` : ""} - Block ${a.section}`;
    if (a.tvlStrand) l += ` · ${a.tvlStrand}`;
    if (a.specialization) l += ` (${a.specialization})`;
    return l;
  };

  return (
    <div className={`card flex flex-col overflow-hidden ${className}`}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold text-slate-900">My Classes</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Advisories you handle and classes you teach as a subject teacher — across any grade or strand.
        </p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
        {user.role === "adviser" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Advisory Classes</h3>
              {adding !== "advisory" && (
                <button className="text-primary-600 text-xs font-medium inline-flex items-center gap-1 hover:text-primary-700" onClick={() => setAdding("advisory")}>
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span> Add advisory
                </button>
              )}
            </div>
            <div className={chipGrid}>
              {(data.advisories || []).map((a) => (
                <ClassChip key={a.id} label={label(a)} sub={a.primary ? "Primary advisory" : `S.Y. ${a.academicYear}`} canRemove={!a.primary} onRemove={() => removeAdvisory(a)} />
              ))}
            </div>
            {adding === "advisory" && (
              <Modal open title="Add advisory class" onClose={() => setAdding(null)}>
                <SelectorRow cls={advisoryForm} setCls={setAdvisoryForm} includeAdvisory={false} ays={ays} compact={compact} />
                <div className="mt-5 flex justify-end gap-2">
                  <button className="btn-outline" disabled={busy} onClick={() => setAdding(null)}>Cancel</button>
                  <button className="btn-primary" disabled={busy || !advisoryForm.section} onClick={addAdvisory}>
                    {busy ? "Adding..." : "Add advisory"}
                  </button>
                </div>
              </Modal>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classes I Teach</h3>
            {adding !== "class" && (
              <button className="text-primary-600 text-xs font-medium inline-flex items-center gap-1 hover:text-primary-700" onClick={() => setAdding("class")}>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">add</span> Add teaching assignment
              </button>
            )}
          </div>
          <div className={chipGrid}>
            {(data.teachingLoad || []).map((a) => (
              <ClassChip
                key={a.id}
                label={`${a.subject} · ${label(a)}`}
                sub={`${a.semester} · S.Y. ${a.academicYear}${a.adviserName ? ` → ${a.adviserName}` : ""}`}
                canRemove
                onRemove={() => removeClass(a)}
                onClick={() => navigate(`/my-students?load=${a.id}`)}
              />
            ))}
            {!loading && (data.teachingLoad || []).length === 0 && (
              <p className="text-sm text-slate-400">No teaching assignments yet — add one to encode grades for any grade or strand.</p>
            )}
          </div>
          {adding === "class" && (
            <Modal open title="Add teaching assignment" onClose={() => setAdding(null)}>
              <SelectorRow cls={classForm} setCls={setClassForm} includeAdvisory ays={ays} compact={compact} />
              {classForm.strand === "TVL" && (
                <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  For TVL classes, please select the TVL Track and Specialization to ensure the correct assignment matching.
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">
                The adviser of this class will receive the grades you generate from My Students.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button className="btn-outline" disabled={busy} onClick={() => setAdding(null)}>Cancel</button>
                <button className="btn-primary" disabled={busy || !classForm.section} onClick={addClass}>
                  {busy ? "Adding..." : "Add teaching assignment"}
                </button>
              </div>
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
}
