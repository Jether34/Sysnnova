import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useUI } from "./ui.jsx";
import Select from "./Select.jsx";
import { JHS_SUBJECTS, SHS_SUBJECTS, SEMESTERS } from "../utils/constants.js";

const emptySchool = { province: "", city: "", barangay: "", name: "" };

export default function SchoolSubjectsManager({ onChanged }) {
  const { show } = useUI();
  const [school, setSchool] = useState(emptySchool);
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [schools, setSchools] = useState([]);
  const [jhs, setJhs] = useState([]);
  const [shs, setShs] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cascadeBusy, setCascadeBusy] = useState({ provinces: true, cities: false, barangays: false, schools: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/schools/provinces")
      .then(({ data }) => setProvinces(data.provinces || []))
      .catch((err) => show(err.message, "error"))
      .finally(() => setCascadeBusy((b) => ({ ...b, provinces: false })));
  }, []);

  useEffect(() => {
    if (!school.province) {
      setCities([]);
      setBarangays([]);
      setSchools([]);
      return;
    }
    let stale = false;
    setCascadeBusy((b) => ({ ...b, cities: true }));
    api.get("/schools/cities", { params: { province: school.province } })
      .then(({ data }) => { if (!stale) setCities(data.cities || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, cities: false })); });
    return () => { stale = true; };
  }, [school.province]);

  useEffect(() => {
    if (!school.province || !school.city) {
      setBarangays([]);
      setSchools([]);
      return;
    }
    let stale = false;
    setCascadeBusy((b) => ({ ...b, barangays: true }));
    api.get("/schools/barangays", { params: { province: school.province, city: school.city } })
      .then(({ data }) => { if (!stale) setBarangays(data.barangays || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, barangays: false })); });
    return () => { stale = true; };
  }, [school.province, school.city]);

  useEffect(() => {
    if (!school.province || !school.city || !school.barangay) {
      setSchools([]);
      return;
    }
    let stale = false;
    setCascadeBusy((b) => ({ ...b, schools: true }));
    api.get("/schools", { params: { province: school.province, city: school.city, barangay: school.barangay } })
      .then(({ data }) => { if (!stale) setSchools(data.schools || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, schools: false })); });
    return () => { stale = true; };
  }, [school.province, school.city, school.barangay]);

  const selected = schools.find((s) => s.name === school.name && s.barangay === school.barangay && s.city === school.city && s.province === school.province);

  // Load the existing config when a school + semester is selected.
  useEffect(() => {
    if (!selected?.id || !semester) {
      setJhs([]);
      setShs([]);
      setDirty(false);
      return;
    }
    let stale = false;
    setBusy(true);
    api.get("/admin/subjects", { params: { schoolId: selected.id } })
      .then(({ data }) => {
        if (stale) return;
        const cfg = (data.configs || []).find((c) => c.semester === semester);
        setJhs(cfg?.jhs?.length ? cfg.jhs : JHS_SUBJECTS);
        setShs(cfg?.shs?.length ? cfg.shs : SHS_SUBJECTS);
        setDirty(false);
      })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setBusy(false); });
    return () => { stale = true; };
  }, [selected?.id, semester]);

  const toggle = (band, subject) => {
    const set = band === "jhs" ? setJhs : setShs;
    set((cur) => (cur.includes(subject) ? cur.filter((s) => s !== subject) : [...cur, subject]));
    setDirty(true);
  };

  const save = async () => {
    if (!selected?.id) {
      show("Please select a school first.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.put("/admin/subjects", { schoolId: selected.id, semester, jhs, shs });
      show(`Subjects saved for ${selected.name} (${semester}).`, "success");
      setDirty(false);
      onChanged?.();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setJhs(JHS_SUBJECTS);
    setShs(SHS_SUBJECTS);
    setDirty(true);
  };

  const checkbox = (band, subject) => {
    const cur = band === "jhs" ? jhs : shs;
    const on = cur.includes(subject);
    return (
      <label key={subject} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer select-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <input type="checkbox" checked={on} onChange={() => toggle(band, subject)} className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
        <span className="leading-tight">{subject}</span>
      </label>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">School subjects</h2>
          <p className="mt-0.5 text-xs text-slate-500">Choose which subjects are offered for each school and semester. These show up in sign-up and user creation.</p>
        </div>
        <span className="badge-neutral">{dirty ? "Unsaved changes" : "All changes saved"}</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="min-w-0">
          <label className="label">Province</label>
          <Select value={school.province}
            onChange={(e) => setSchool({ ...emptySchool, province: e.target.value })}>
            <option value="">Select province...</option>
            {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        <div className="min-w-0">
          <label className="label">City / Municipality</label>
          <Select value={school.city} disabled={!school.province || cascadeBusy.cities}
            onChange={(e) => setSchool({ ...school, city: e.target.value, barangay: "", name: "" })}>
            <option value="">{!school.province ? "Select province first" : cascadeBusy.cities ? "Loading cities..." : "Select city/municipality..."}</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className="min-w-0">
          <label className="label">Barangay</label>
          <Select value={school.barangay} disabled={!school.city || cascadeBusy.barangays}
            onChange={(e) => setSchool({ ...school, barangay: e.target.value, name: "" })}>
            <option value="">{!school.city ? "Select city first" : cascadeBusy.barangays ? "Loading barangays..." : "Select barangay..."}</option>
            {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
        <div className="min-w-0">
          <label className="label">School</label>
          <Select value={school.name} disabled={!school.barangay || cascadeBusy.schools}
            onChange={(e) => setSchool({ ...school, name: e.target.value })}>
            <option value="">{!school.barangay ? "Select barangay first" : cascadeBusy.schools ? "Loading schools..." : "Select school..."}</option>
            {schools.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </Select>
        </div>
      </div>

      {selected?.id && (
        <>
          <div className="mb-4">
            <label className="label">Semester</label>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          {busy ? (
            <p className="text-sm text-slate-400">Loading subjects...</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Junior High School (Grades 7-10)</h3>
                <div className="grid sm:grid-cols-2 gap-2">{JHS_SUBJECTS.map((s) => checkbox("jhs", s))}</div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Senior High School (Grades 11-12)</h3>
                <div className="grid sm:grid-cols-2 gap-2">{SHS_SUBJECTS.map((s) => checkbox("shs", s))}</div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={save} disabled={saving || busy || !dirty}>
              {saving ? "Saving..." : "Save subjects"}
            </button>
            <button className="btn-outline" onClick={resetToDefaults} disabled={saving || busy}>
              Restore defaults
            </button>
            <p className="text-xs text-slate-400">Saving with no checkboxes clears the config and falls back to the default subject list.</p>
          </div>
        </>
      )}
    </div>
  );
}
