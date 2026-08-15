import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import Select from "../components/Select.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import api from "../api/client.js";
import { getDeviceInfo } from "../auth/deviceService.js";
import { GRADE_LEVELS, STRANDS, SEMESTERS, BLOCKS, TVL_STRANDS, isShsGrade, subjectsFor, specializationsFor, academicYearOptions } from "../utils/constants.js";

const ROLES = [
  { key: "adviser", label: "Adviser", icon: "co_present" },
  { key: "teacher", label: "Subject Teacher", icon: "menu_book" },
  { key: "student", label: "Student", icon: "person" },
];

const emptySchool = { province: "", city: "", barangay: "", name: "" };

export default function Signup() {
  const { signup } = useAuth();
  const { show } = useUI();
  const navigate = useNavigate();
  const [role, setRole] = useState("adviser");
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "Male",
    email: "",
    password: "",
    grade: "11",
    strand: "STEM",
    tvlStrand: "",
    specialization: "",
    section: "",
    subject: "General Mathematics",
    semester: SEMESTERS[0],
    academicYear: academicYearOptions()[1],
    ...emptySchool,
  });
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [schools, setSchools] = useState([]);
  const [enabledSubjects, setEnabledSubjects] = useState([]);
  const [enabledBusy, setEnabledBusy] = useState(false);
  const [cascadeBusy, setCascadeBusy] = useState({ provinces: true, cities: false, barangays: false, schools: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/schools/provinces")
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
    setCascadeBusy((b) => ({ ...b, cities: true, barangays: true, schools: true }));
    api.get("/schools/cities", { params: { province: form.province } })
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
    setCascadeBusy((b) => ({ ...b, barangays: true, schools: true }));
    api.get("/schools/barangays", { params: { province: form.province, city: form.city } })
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
    api.get("/schools", { params: { province: form.province, city: form.city, barangay: form.barangay } })
      .then(({ data }) => { if (!stale) setSchools(data.schools || []); })
      .catch((err) => { if (!stale) show(err.message, "error"); })
      .finally(() => { if (!stale) setCascadeBusy((b) => ({ ...b, schools: false })); });
    return () => { stale = true; };
  }, [form.province, form.city, form.barangay]);

  const school = schools.find((s) => s.name === form.name && s.barangay === form.barangay && s.city === form.city && s.province === form.province);

  useEffect(() => {
    if (role !== "teacher") {
      setEnabledSubjects([]);
      return;
    }
    if (!school?.id || !form.semester || !form.grade) {
      setEnabledSubjects(subjectsFor(form.grade));
      return;
    }
    let stale = false;
    setEnabledBusy(true);
    api.get("/schools/subjects", { params: { schoolId: school.id, semester: form.semester, grade: form.grade } })
      .then(({ data }) => {
        if (stale) return;
        const list = data.subjects?.length ? data.subjects : subjectsFor(form.grade);
        setEnabledSubjects(list);
        setForm((f) => (list.includes(f.subject) ? f : { ...f, subject: list[0] }));
      })
      .catch(() => { if (!stale) setEnabledSubjects(subjectsFor(form.grade)); })
      .finally(() => { if (!stale) setEnabledBusy(false); });
    return () => { stale = true; };
  }, [role, school?.id, form.semester, form.grade]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const switchRole = (r) => {
    setRole(r);
    setForm((f) => ({ ...f, subject: subjectsFor(f.grade)[0], semester: SEMESTERS[0], specialization: "" }));
  };
  const shs = isShsGrade(form.grade);

  const submit = async (e) => {
    e.preventDefault();
    if ((role === "adviser" || role === "student") && !form.section) {
      show("Please select a section/block for your account.", "error");
      return;
    }
    if (role !== "admin" && !form.name) {
      show("Please select a school from the list.", "error");
      return;
    }
    setBusy(true);
    try {
      const deviceInfo = await getDeviceInfo();
      await signup(
        {
          ...form,
          role,
          school: { name: form.name, province: form.province, city: form.city, barangay: form.barangay },
        },
        deviceInfo
      );
      navigate("/login", { replace: true });
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-dvh flex items-start justify-center bg-surface px-6 py-8 sm:h-auto sm:min-h-screen sm:items-center sm:p-4 overflow-y-auto sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-full max-w-[1070px]">
        <div className="mb-6 flex items-center justify-center">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Create your account</h1>
        </div>

        <div className="rounded-none border-0 bg-transparent p-0 shadow-none sm:rounded-xl sm:border sm:border-slate-200 sm:bg-white sm:p-[34px] sm:shadow-sm dark:sm:border-slate-800 dark:sm:bg-slate-950">
          <div className="mx-auto w-full max-w-[1000px]">
          <div className="flex flex-wrap justify-center gap-2">
            {ROLES.map((r) => (
              <button key={r.key} type="button" onClick={() => switchRole(r.key)}
                className={`flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  role === r.key
                    ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-primary-600 dark:border-primary-500 dark:bg-white dark:text-black"
                    : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                }`}>
                <span className="material-symbols-outlined text-base max-sm:hidden!" aria-hidden="true">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">First name</label>
                <input className="input" value={form.firstName} onChange={set("firstName")} required />
              </div>
              <div>
                <label className="label">Middle name</label>
                <input className="input" value={form.middleName} onChange={set("middleName")} />
              </div>
              <div>
                <label className="label">Last name</label>
                <input className="input" value={form.lastName} onChange={set("lastName")} required />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={form.email} onChange={set("email")} required placeholder="you@school.edu.ph" />
              </div>
              <div>
                <label className="label">Password</label>
                <PasswordInput value={form.password} onChange={set("password")} required minLength={6} placeholder="min 6 characters" />
              </div>
            </div>

            {cascadeBusy.provinces ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Loading provinces...</p>
            ) : provinces.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">No schools are registered yet. Please contact the administrator to register your school first.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 min-w-0">
                <div className="min-w-0">
                  <label className="label">Province</label>
                  <Select value={form.province} required
                    onChange={(e) => setForm({ ...form, province: e.target.value, city: "", barangay: "", name: "" })}>
                    <option value="">Select province...</option>
                    {provinces.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="label">City / Municipality</label>
                  <Select value={form.city} required disabled={!form.province || cascadeBusy.cities}
                    onChange={(e) => setForm({ ...form, city: e.target.value, barangay: "", name: "" })}>
                    <option value="">{!form.province ? "Select province first" : cascadeBusy.cities ? "Loading cities..." : "Select city/municipality..."}</option>
                    {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="label">Barangay</label>
                  <Select value={form.barangay} required disabled={!form.city || cascadeBusy.barangays}
                    onChange={(e) => setForm({ ...form, barangay: e.target.value, name: "" })}>
                    <option value="">{!form.city ? "Select city first" : cascadeBusy.barangays ? "Loading barangays..." : "Select barangay..."}</option>
                    {barangays.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </div>
                <div className="min-w-0">
                  <label className="label">School</label>
                  <Select value={form.name} required disabled={!form.barangay || cascadeBusy.schools}
                    onChange={set("name")}>
                    <option value="">{!form.barangay ? "Select barangay first" : cascadeBusy.schools ? "Loading schools..." : "Select school..."}</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}{schools.filter((o) => o.name === s.name).length > 1 ? ` (${s.barangay}, ${s.city}, ${s.province})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
            {form.province && form.city && form.barangay && form.name && (
              <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined text-sm text-emerald-600" aria-hidden="true">check_circle</span>
                <span>Selected: <strong>{form.name}</strong> of {form.province}, {form.city}, {form.barangay}</span>
              </p>
            )}

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="min-w-0">
                <label className="label">Grade level</label>
                <Select value={form.grade} onChange={(e) => {
                  const g = e.target.value;
                  setForm((f) => ({
                    ...f,
                    grade: g,
                    subject: subjectsFor(g).includes(f.subject) ? f.subject : subjectsFor(g)[0],
                    specialization: "",
                  }));
                }}>
                  {GRADE_LEVELS.map((g) => <option key={g} value={g}>{`Grade ${g}${g >= 11 ? " (SHS)" : ""}`}</option>)}
                </Select>
              </div>
              {shs && (
                <div className="min-w-0">
                  <label className="label">Strand (SHS)</label>
                  <Select value={form.strand} onChange={(e) => setForm((f) => ({ ...f, strand: e.target.value, specialization: "", tvlStrand: "" }))}>
                    {STRANDS.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </div>
              )}
              {shs && (
                <div className="min-w-0">
                  <label className="label">Academic year</label>
                  <Select value={form.academicYear} onChange={set("academicYear")}>
                    {academicYearOptions().map((y) => <option key={y} value={y}>S.Y. {y}</option>)}
                  </Select>
                </div>
              )}
            </div>
            {shs && form.strand === "TVL" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="label">TVL Strand</label>
                  <Select value={form.tvlStrand || ""} onChange={(e) => setForm((f) => ({ ...f, tvlStrand: e.target.value, specialization: "" }))}>
                    <option value="">Select TVL strand...</option>
                    {TVL_STRANDS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>
                {form.tvlStrand && (
                  <div className="min-w-0">
                    <label className="label">Specialization</label>
                    <Select value={form.specialization} onChange={set("specialization")} required>
                      <option value="">Select specialization...</option>
                      {specializationsFor(form.tvlStrand).map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </div>
                )}
              </div>
            )}

            {(role === "adviser" || role === "student") && (
              <div className="grid sm:grid-cols-2 gap-3">
                {role === "student" && (
                  <div>
                    <span className="label">Gender</span>
                    <div className="flex gap-2">
                      {["Male", "Female"].map((g) => {
                        const active = form.gender === g;
                        return (
                          <div key={g} role="radio" aria-checked={active} tabIndex={0}
                            onClick={() => setForm({ ...form, gender: g })}
                            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); setForm({ ...form, gender: g }); } }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer transition ${
                              active
                                ? "border-primary-600 bg-primary-50 text-primary-700 ring-1 ring-primary-600"
                                : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                            }`}>
                            <span className={`grid h-4 w-4 place-items-center rounded-full border-2 transition ${active ? "border-primary-600" : "border-slate-300"}`}>
                              <span className={`h-2 w-2 rounded-full bg-primary-600 transition ${active ? "" : "opacity-0"}`} />
                            </span>
                            {g}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <label className="label">Section / Block</label>
                  <Select value={form.section} onChange={set("section")} required>
                    <option value="">Select section/block...</option>
                    {BLOCKS.map((b) => <option key={b} value={b}>Block {b}</option>)}
                  </Select>
                </div>
              </div>
            )}

            {role === "teacher" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="label">Subject</label>
                  <Select value={form.subject} onChange={set("subject")} required disabled={enabledBusy}>
                    {enabledBusy
                      ? <option value={form.subject}>{form.subject}</option>
                      : enabledSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  {!enabledBusy && enabledSubjects.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No subjects are enabled for this school and semester yet. Please ask the administrator to enable subjects.</p>
                  )}
                </div>
                <div>
                  <label className="label">Semester</label>
                  <Select value={form.semester} onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}>
                    {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-center pt-[1.6px]">
              <button className="btn-primary w-2/3 !py-2.5 !text-base sm:w-1/2" disabled={busy}>
                {busy ? "Creating account..." : "Create account"}
              </button>
            </div>
          </form>
          </div>
        </div>

        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Already registered? <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
