import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useUI } from "./ui.jsx";
import Select from "./Select.jsx";
import { GRADE_LEVELS, STRANDS, SEMESTERS, BLOCKS, isShsGrade, subjectsFor, academicYearOptions, TVL_STRANDS, specializationsFor } from "../utils/constants.js";

const ROLES = [
  { key: "adviser", label: "Adviser" },
  { key: "teacher", label: "Subject Teacher" },
  { key: "student", label: "Student" },
  { key: "admin", label: "System Admin" },
];

const emptySchool = { province: "", city: "", barangay: "", name: "" };

export default function UserFormModal({ mode, user, onClose, onSaved }) {
  const { show } = useUI();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const s = user?.school || emptySchool;
    return {
      role: user?.role || "adviser",
      firstName: user?.firstName || "",
      middleName: user?.middleName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      password: "",
      gender: user?.gender || "Male",
      grade: user?.grade && user?.grade !== "N/A" ? user.grade : "11",
      strand: user?.strand || "STEM",
      specialization: user?.specialization || "",
      tvlStrand: user?.tvlStrand || "",
      section: user?.section || "",
      subject: user?.subject || subjectsFor(user?.grade || "11")[0],
      semester: user?.semester || SEMESTERS[0],
      academicYear: user?.academicYear && user?.academicYear !== "N/A" ? user.academicYear : academicYearOptions()[1],
      province: s?.province || "",
      city: s?.city || "",
      barangay: s?.barangay || "",
      name: s?.name || "",
    };
  });

  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [schools, setSchools] = useState([]);
  const [enabledSubjects, setEnabledSubjects] = useState([]);
  const [enabledBusy, setEnabledBusy] = useState(false);
  const [cascadeBusy, setCascadeBusy] = useState({ provinces: true, cities: false, barangays: false, schools: false });

  useEffect(() => {
    api
      .get("/schools/provinces")
      .then(({ data }) => setProvinces(data.provinces || []))
      .catch((err) => show(err.message, "error"))
      .finally(() => setCascadeBusy((b) => ({ ...b, provinces: false })));
  }, []);

  useEffect(() => {
    if (!form.province) {
      setCities([]);
      setBarangays([]);
      setSchools([]);
      return;
    }
    let stale = false;
    setCascadeBusy((b) => ({ ...b, cities: true }));
    api
      .get("/schools/cities", { params: { province: form.province } })
      .then(({ data }) => { if (!stale) setCities(data.cities || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, cities: false })); });
    return () => { stale = true; };
  }, [form.province]);

  useEffect(() => {
    if (!form.province || !form.city) {
      setBarangays([]);
      setSchools([]);
      return;
    }
    let stale = false;
    setCascadeBusy((b) => ({ ...b, barangays: true }));
    api
      .get("/schools/barangays", { params: { province: form.province, city: form.city } })
      .then(({ data }) => { if (!stale) setBarangays(data.barangays || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, barangays: false })); });
    return () => { stale = true; };
  }, [form.province, form.city]);

  useEffect(() => {
    if (!form.province || !form.city || !form.barangay) {
      setSchools([]);
      return;
    }
    let stale = false;
    setCascadeBusy((b) => ({ ...b, schools: true }));
    api
      .get("/schools", { params: { province: form.province, city: form.city, barangay: form.barangay } })
      .then(({ data }) => { if (!stale) setSchools(data.schools || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, schools: false })); });
    return () => { stale = true; };
  }, [form.province, form.city, form.barangay]);

  const selectedSchool = schools.find((s) => s.name === form.name && s.barangay === form.barangay && s.city === form.city && s.province === form.province);

  useEffect(() => {
    if (form.role !== "teacher") {
      setEnabledSubjects([]);
      return;
    }
    if (!selectedSchool?.id || !form.semester || !form.grade) {
      setEnabledSubjects(subjectsFor(form.grade));
      return;
    }
    let stale = false;
    setEnabledBusy(true);
    api.get("/schools/subjects", { params: { schoolId: selectedSchool.id, semester: form.semester, grade: form.grade } })
      .then(({ data }) => {
        if (stale) return;
        const list = data.subjects?.length ? data.subjects : subjectsFor(form.grade);
        setEnabledSubjects(list);
        setForm((f) => (list.includes(f.subject) ? f : { ...f, subject: list[0] }));
      })
      .catch(() => { if (!stale) setEnabledSubjects(subjectsFor(form.grade)); })
      .finally(() => { if (!stale) setEnabledBusy(false); });
    return () => { stale = true; };
  }, [form.role, selectedSchool?.id, form.semester, form.grade]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const shs = isShsGrade(form.grade);
  const isAdmin = form.role === "admin";

  const submit = async (e) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) {
      show("First name, last name and email are required.", "error");
      return;
    }
    if (mode === "create" && (!form.password || form.password.length < 6)) {
      show("Password must be at least 6 characters.", "error");
      return;
    }
    if (form.password && form.password.length < 6) {
      show("Password must be at least 6 characters.", "error");
      return;
    }
    if (!isAdmin && !form.name) {
      show("Please select a school for this account.", "error");
      return;
    }
    const payload = {
      role: form.role,
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      email: form.email,
      gender: form.role === "student" ? form.gender : "",
      grade: isAdmin ? "N/A" : form.grade,
      strand: isAdmin ? "" : form.strand,
      specialization: isAdmin ? "" : form.specialization,
      tvlStrand: isAdmin ? "" : form.tvlStrand,
      section: form.section,
      subject: form.subject,
      semester: form.semester,
      academicYear: isAdmin ? "N/A" : form.academicYear,
      school: isAdmin
        ? null
        : { name: form.name, province: form.province, city: form.city, barangay: form.barangay },
    };
    if (form.password) payload.password = form.password;

    setBusy(true);
    try {
      const { data } =
        mode === "create"
          ? await api.post("/admin/users", payload)
          : await api.put(`/admin/users/${user.id}`, payload);
      show(mode === "create" ? "Account created." : "Account updated.", "success");
      onSaved(data.user);
      onClose();
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl rounded-xl bg-white shadow-xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="font-display text-lg font-bold text-slate-900">
            {mode === "create" ? "Add user" : "Edit user"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="label">Role *</label>
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, password: form.password })}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="label">First name *</label>
              <input className="input !py-3 !text-base" value={form.firstName} onChange={set("firstName")} required />
            </div>
            <div>
              <label className="label">Middle name</label>
              <input className="input !py-3 !text-base" value={form.middleName} onChange={set("middleName")} />
            </div>
            <div>
              <label className="label">Last name *</label>
              <input className="input !py-3 !text-base" value={form.lastName} onChange={set("lastName")} required />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input !py-3 !text-base" value={form.email} onChange={set("email")} required placeholder="you@school.edu.ph" />
            </div>
            <div>
              <label className="label">{mode === "create" ? "Password *" : "Password (leave blank to keep)"}</label>
              <input type="password" className="input !py-3 !text-base" value={form.password} onChange={set("password")}
                minLength={6} required={mode === "create"} placeholder="min 6 characters" />
            </div>
          </div>

          {!isAdmin && (
            <>
              {form.role === "student" && (
                <div>
                  <span className="label">Gender *</span>
                  <div className="flex gap-2">
                    {["Male", "Female"].map((g) => {
                      const active = form.gender === g;
                      return (
                        <label key={g} className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer select-none transition-colors ${
                          active
                            ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-primary-600"
                            : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                        }`}>
                          <input type="radio" name="gender" value={g} checked={active} onChange={set("gender")} className="sr-only" />
                          <span className={`grid h-4 w-4 place-items-center rounded-full border-2 transition-colors ${active ? "border-primary-600" : "border-slate-300"}`}>
                            <span className={`h-2 w-2 rounded-full bg-primary-600 transition ${active ? "" : "opacity-0"}`} />
                          </span>
                          {g}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="label">Grade level *</label>
                  <Select value={form.grade} onChange={(e) => {
                    const g = e.target.value;
                    setForm((f) => ({
                      ...f,
                      grade: g,
                      subject: subjectsFor(g).includes(f.subject) ? f.subject : subjectsFor(g)[0],
                    }));
                  }}>
                    {GRADE_LEVELS.map((g) => <option key={g} value={g}>{`Grade ${g}${g >= 11 ? " (SHS)" : ""}`}</option>)}
                  </Select>
                </div>
                {shs && (
                  <div>
                    <label className="label">Strand (SHS) *</label>
                    <Select value={form.strand} onChange={set("strand")}>
                      {STRANDS.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                  </div>
                )}
                {shs && form.strand === "TVL" && (
                  <>
                    <div>
                      <label className="label">TVL Track</label>
                      <Select value={form.tvlStrand} onChange={(e) => setForm({ ...form, tvlStrand: e.target.value, specialization: "" })}>
                        <option value="">Select TVL track...</option>
                        {TVL_STRANDS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </div>
                    <div>
                      <label className="label">Specialization *</label>
                      <Select value={form.specialization} onChange={set("specialization")} disabled={!form.tvlStrand}>
                        <option value="">Select specialization...</option>
                        {specializationsFor(form.tvlStrand).map((sp) => <option key={sp} value={sp}>{sp}</option>)}
                      </Select>
                    </div>
                  </>
                )}
                <div>
                  <label className="label">Academic year *</label>
                  <Select value={form.academicYear} onChange={set("academicYear")}>
                    {academicYearOptions().map((y) => <option key={y} value={y}>S.Y. {y}</option>)}
                  </Select>
                </div>
              </div>

              {(form.role === "adviser" || form.role === "student") && (
                <div>
                  <label className="label">Section / Block *</label>
                  <Select value={form.section} onChange={set("section")}>
                    <option value="">Select section/block...</option>
                    {BLOCKS.map((b) => <option key={b} value={b}>Block {b}</option>)}
                  </Select>
                </div>
              )}

              {form.role === "teacher" && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Subject *</label>
                    <Select value={form.subject} onChange={set("subject")} disabled={enabledBusy}>
                      {enabledBusy
                        ? <option value={form.subject}>{form.subject}</option>
                        : enabledSubjects.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                    {!enabledBusy && enabledSubjects.length === 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No subjects are enabled for this school and semester yet.</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Semester *</label>
                    <Select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                      {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="min-w-0">
                  <label className="label">Province *</label>
                  <Select value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value, city: "", barangay: "", name: "" })}>
                    <option value="">Select province...</option>
                    {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="label">City *</label>
                  <Select value={form.city} disabled={!form.province || cascadeBusy.cities}
                    onChange={(e) => setForm({ ...form, city: e.target.value, barangay: "", name: "" })}>
                    <option value="">{!form.province ? "Select province first" : cascadeBusy.cities ? "Loading..." : "Select city..."}</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="label">Barangay *</label>
                  <Select value={form.barangay} disabled={!form.city || cascadeBusy.barangays}
                    onChange={(e) => setForm({ ...form, barangay: e.target.value, name: "" })}>
                    <option value="">{!form.city ? "Select city first" : cascadeBusy.barangays ? "Loading..." : "Select barangay..."}</option>
                    {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="label">School *</label>
                  <Select value={form.name} disabled={!form.barangay || cascadeBusy.schools}
                    onChange={set("name")}>
                    <option value="">{!form.barangay ? "Select barangay first" : cascadeBusy.schools ? "Loading..." : "Select school..."}</option>
                    {schools.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Saving..." : mode === "create" ? "Add user" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
