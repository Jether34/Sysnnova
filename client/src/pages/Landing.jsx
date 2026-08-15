import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import shotLanding from "../assets/screens/01-landing.png";
import shotLogin from "../assets/screens/02-login.png";
import shotSignup from "../assets/screens/03-signup.png";
import shotForgot from "../assets/screens/04-forgot-password.png";
import shotAdminDash from "../assets/screens/05-admin-dashboard.png";
import shotAdminDb from "../assets/screens/06-admin-database.png";
import shotAdviserDash from "../assets/screens/07-adviser-dashboard.png";
import shotAdviserStudents from "../assets/screens/08-adviser-my-students.png";
import shotAdviserGrades from "../assets/screens/09-adviser-grades.png";
import shotAdviserMessages from "../assets/screens/10-adviser-messages.png";
import shotTeacherDash from "../assets/screens/11-teacher-dashboard.png";
import shotTeacherGrades from "../assets/screens/12-teacher-grades.png";
import shotTeacherStudents from "../assets/screens/13-teacher-my-students.png";
import shotStudentDash from "../assets/screens/14-student-dashboard.png";

const NAV = [
  { href: "#overview", label: "Overview" },
  { href: "#problem", label: "The Problem" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#screens", label: "Product tour" },
  { href: "#security", label: "Security" },
];

const PROBLEMS = [
  {
    icon: "archive",
    color: "bg-amber-50 text-amber-700",
    ring: "border-amber-200",
    title: "Grades scattered on paper",
    desc: "Teachers keep grades in notebooks and spreadsheets scattered across devices. Nothing is centralized, and a lost file means lost grades.",
  },
  {
    icon: "hdr_weak",
    color: "bg-sky-50 text-sky-700",
    ring: "border-sky-200",
    title: "Slow, manual collection",
    desc: "Advisers chase subject teachers one by one for every class list. Grade collection eats days of the grading period and is prone to retyping errors.",
  },
  {
    icon: "lock_person",
    color: "bg-emerald-50 text-emerald-700",
    ring: "border-emerald-200",
    title: "No accountability trail",
    desc: "When a grade is disputed, there is no record of who encoded it, when, or who published it. Disputes are resolved by memory, not by evidence.",
  },
  {
    icon: "question_mark",
    color: "bg-rose-50 text-rose-700",
    ring: "border-rose-200",
    title: "Students in the dark",
    desc: "Learners wait weeks or approach teachers personally to ask how they are doing. Parents have no easy window into their child's progress.",
  },
  {
    icon: "task_alt",
    color: "bg-teal-50 text-teal-700",
    ring: "border-teal-200",
    title: "Inconsistent formats",
    desc: "Every teacher has their own grading style and file layout. Combining them into a single report card is a formatting nightmare.",
  },
  {
    icon: "manage_accounts",
    color: "bg-violet-50 text-violet-700",
    ring: "border-violet-200",
    title: "No oversight for school leaders",
    desc: "Administrators cannot see school-wide progress, live activity, or spot bottlenecks. Decisions are made without current data.",
  },
];

const FEATURES = [
  {
    icon: "grid_on",
    color: "bg-indigo-50 text-indigo-600",
    title: "Excel-first grading",
    desc: "Subject teachers download a ready-made grading template, encode on their own machine, and submit the same file back. No retyping into web forms.",
  },
  {
    icon: "verified_user",
    color: "bg-emerald-50 text-emerald-600",
    title: "Signed & verified submissions",
    desc: "Every uploaded grade list is cryptographically signed with the teacher's private key. The system verifies the file against the teacher's public key so tampering is detectable.",
  },
  {
    icon: "forum",
    color: "bg-sky-50 text-sky-600",
    title: "Built-in messaging",
    desc: "Advisers and teachers coordinate through the platform itself, asking for resubmissions, clarifying entries, or attaching files, without leaving the system.",
  },
  {
    icon: "description",
    color: "bg-amber-50 text-amber-600",
    title: "Instant report cards",
    desc: "Published grades are compiled into official report cards that advisers can download and hand to students, eliminating manual consolidation.",
  },
  {
    icon: "leaderboard",
    color: "bg-rose-50 text-rose-600",
    title: "Class leaderboards",
    desc: "Students see how they stand in their section, and advisers get a quick pulse on class performance per subject.",
  },
  {
    icon: "monitoring",
    color: "bg-violet-50 text-violet-600",
    title: "Live admin monitoring",
    desc: "Admins watch real-time traffic, active users, and top endpoints, plus a full database browser and audit trail. Everything a school IT lead needs.",
  },
  {
    icon: "school",
    color: "bg-teal-50 text-teal-600",
    title: "Multi-school ready",
    desc: "Provinces, cities, barangays, and thousands of schools make signup structured and school-specific from day one.",
  },
  {
    icon: "workspace_premium",
    color: "bg-indigo-50 text-indigo-600",
    title: "Academic-year aware",
    desc: "Everything is scoped by academic year and semester, so last year's classes and grades never mix with this year's.",
  },
];

const ROLES = [
  {
    key: "adviser",
    title: "Advisers",
    icon: "co_present",
    color: "bg-amber-100 text-amber-800",
    desc: "Own an advisory class. Review incoming grade lists, request fixes from teachers, and publish finalized grades to students with one click.",
  },
  {
    key: "teacher",
    title: "Subject Teachers",
    icon: "menu_book",
    color: "bg-sky-100 text-sky-800",
    desc: "Download the official format, encode grades offline, and submit them securely. The system records exactly what you sent and when.",
  },
  {
    key: "student",
    title: "Students",
    icon: "person",
    color: "bg-emerald-100 text-emerald-800",
    desc: "Log in and see your grades the moment your adviser publishes them. No more asking around, no more waiting.",
  },
  {
    key: "admin",
    title: "Administrators",
    icon: "admin_panel_settings",
    color: "bg-violet-100 text-violet-800",
    desc: "Manage accounts, schools, and subjects; watch live traffic; browse the database and audit trail from a single control room.",
  },
];

const STEPS = [
  {
    num: "01",
    role: "Subject teacher",
    title: "Encode",
    color: "border-sky-300 bg-sky-50 text-sky-800",
    desc: "Download the grading template for your class and semester, fill in scores on your own computer, then submit the file. It is signed and verified automatically.",
  },
  {
    num: "02",
    role: "Adviser",
    title: "Review & publish",
    color: "border-amber-300 bg-amber-50 text-amber-800",
    desc: "Advisers see every submitted subject list for their advisory, can request fixes through messages, then publish the consolidated grades.",
  },
  {
    num: "03",
    role: "Student & parents",
    title: "See results",
    color: "border-emerald-300 bg-emerald-50 text-emerald-800",
    desc: "Published grades appear on the student dashboard instantly and become the official report card for the quarter.",
  },
];

const SCREENS = [
  {
    group: "Getting started",
    accent: "bg-indigo-100 text-indigo-800",
    items: [
      { img: shotLanding, title: "Landing page", desc: "The public home of Sysnnova. A complete overview of the product, its purpose, the problems it solves, and this guided tour of every screen." },
      { img: shotLogin, title: "Secure sign-in", desc: "Users sign in with their school email and password. New devices trigger an emailed verification code before access is granted." },
      { img: shotSignup, title: "Structured signup", desc: "Roles, grade level, SHS strand, and school are chosen from real school data across provinces, cities, and barangays." },
      { img: shotForgot, title: "Password recovery", desc: "Forgot your password? A secure emailed reset code lets users restore access without losing their records." },
    ],
  },
  {
    group: "Administrator",
    accent: "bg-violet-100 text-violet-800",
    items: [
      { img: shotAdminDash, title: "Admin dashboard", desc: "A live control room: total users, active sessions, requests per second, traffic chart, top endpoints, plus full user and subject management." },
      { img: shotAdminDb, title: "Database monitor", desc: "Admins can visually inspect every collection, from users and schools to grades and assessments, with redacted secrets, plus an audit trail and live server logs." },
    ],
  },
  {
    group: "Adviser",
    accent: "bg-amber-100 text-amber-800",
    items: [
      { img: shotAdviserDash, title: "Adviser dashboard", desc: "A single view of the advisory class, showing pending submissions, published lists, and quick actions for the whole grading cycle." },
      { img: shotAdviserStudents, title: "My students", desc: "The full roster of the advisory section, with per-subject status at a glance." },
      { img: shotAdviserGrades, title: "Submitted grades", desc: "Every subject list submitted by teachers, ready to review, request changes on, or publish to students." },
      { img: shotAdviserMessages, title: "Messages", desc: "Advisers and teachers coordinate on grade submissions, follow-ups, and clarifications right inside the platform." },
    ],
  },
  {
    group: "Subject teacher",
    accent: "bg-sky-100 text-sky-800",
    items: [
      { img: shotTeacherDash, title: "Teacher dashboard", desc: "Your classes, grading template downloads, and submission status all in one place." },
      { img: shotTeacherGrades, title: "Submitted grades", desc: "Encode and submit grade lists for each class and semester, with verification status after each upload." },
      { img: shotTeacherStudents, title: "My students", desc: "The students you teach across your classes, searchable and ready for roster review." },
    ],
  },
  {
    group: "Student",
    accent: "bg-emerald-100 text-emerald-800",
    items: [
      { img: shotStudentDash, title: "Student dashboard", desc: "The moment an adviser publishes grades, they appear here, by subject, quarter, and semester, ready to review with parents." },
    ],
  },
];

const STATS = [
  { value: "82", label: "Provinces covered", icon: "map" },
  { value: "3", label: "Step workflow", icon: "signpost" },
  { value: "4", label: "User roles", icon: "group" },
  { value: "100%", label: "Digital workflow", icon: "cloud_done" },
];

function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function ScreenCard({ item }) {
  return (
    <div className="card group overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition">
      <div className="border-b border-slate-200 px-4 py-2.5 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 text-[11px] font-medium text-slate-400">sysnnova / screen</span>
      </div>
      <img src={item.img} alt={`Sysnnova · ${item.title}`} className="w-full h-auto block" loading="lazy" />
      <div className="p-5">
        <h4 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.desc}</p>
      </div>
    </div>
  );
}

const DOWNLOADS = {
  windows: "/downloads/Sysnnova-Setup-Windows-v2.0.exe",
  android: "/downloads/Sysnnova-Android-v2.4.apk",
  linux: "/downloads/Sysnnova-Desktop-Linux-2.5.0.AppImage",
};

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const ids = NAV.map((n) => n.href.slice(1));
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (href) => (e) => {
    e.preventDefault();
    setMenuOpen(false);
    setDownloadsOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navItemClass = (id) =>
    `relative px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
      active === id
        ? "text-indigo-700"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
    }`;

  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth">
      {/* ================= NAVIGATION ================= */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-5 sm:gap-7">
            <span className="font-display text-xl font-bold tracking-tight text-indigo-600 drop-shadow-[0_0_12px_rgba(99,102,241,0.45)]">
              Sysnnova
            </span>
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} onClick={scrollTo(n.href)} className={navItemClass(n.href.slice(1))}>
                  {n.label}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-indigo-600 transition-transform duration-300 origin-left ${
                      active === n.href.slice(1) ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </a>
              ))}
            </nav>
          </div>

<div className="hidden md:flex items-center gap-2">
            <a href={DOWNLOADS.windows} className="btn-outline !py-2 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition">
              <img src="/windows-logo.png" alt="Windows" className="h-5 w-5 mr-1.5" />
              Windows
            </a>
            <a href={DOWNLOADS.linux} className="btn-outline !py-2 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition">
              <img src="/linux-logo.svg" alt="Linux" className="h-5 w-5 mr-1.5" />
              Linux
            </a>
            <a href={DOWNLOADS.android} className="btn-primary !py-2 border-2 border-emerald-800 hover:bg-emerald-800 hover:text-white transition">
              <img src="/android-logo.png" alt="Android" className="h-5 w-5 mr-1.5" />
              Android
            </a>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <button onClick={() => setMenuOpen((o) => !o)} aria-label="Toggle menu"
              className="btn-ghost !p-2">
              <span className="material-symbols-outlined" aria-hidden="true">{menuOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={scrollTo(n.href)}
                className={`block px-3 py-2.5 text-sm font-medium rounded-lg transition ${
                  active === n.href.slice(1)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}>
                {n.label}
              </a>
            ))}
            <div className="pt-1 border-t border-slate-100 mt-1">
              <button onClick={() => setDownloadsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">download</span>
                  Downloads
                </span>
                <span className={`material-symbols-outlined text-base transition-transform ${downloadsOpen ? "rotate-180" : ""}`} aria-hidden="true">expand_more</span>
              </button>
{downloadsOpen && (
                <div className="mt-1 space-y-1">
                  <a href={DOWNLOADS.windows} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-sm font-medium transition border-2 border-slate-900">
                    <img src="/windows-logo.png" alt="Windows" className="h-5 w-5" />
                    Windows
                  </a>
                  <a href={DOWNLOADS.linux} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-sm font-medium transition border-2 border-slate-900">
                    <img src="/linux-logo.svg" alt="Linux" className="h-5 w-5" />
                    Linux
                  </a>
                  <a href={DOWNLOADS.android} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 text-sm font-medium transition border-2 border-emerald-800">
                    <img src="/android-logo.png" alt="Android" className="h-5 w-5" />
                    Android
                  </a>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* ================= HERO ================= */}
        <section id="top" className="relative overflow-hidden bg-indigo-50/60">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <span className="absolute -left-16 top-6 h-64 w-64 rounded-full bg-indigo-100 blur-3xl animate-drift" />
            <span className="absolute right-[6%] top-16 h-56 w-56 rounded-full bg-sky-100 blur-3xl animate-drift" style={{ animationDelay: "-3s" }} />
            <span className="absolute bottom-0 left-[38%] h-48 w-48 rounded-full bg-emerald-100 blur-3xl animate-drift" style={{ animationDelay: "-6s" }} />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pt-16 sm:pt-24 pb-20">
            <div className="max-w-3xl">
              <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08] text-slate-900 animate-fade-up">
                Grades that flow from teacher to student,
                <span className="text-indigo-600"> automatically.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-slate-600 leading-relaxed animate-fade-up" style={{ animationDelay: "120ms" }}>
                Sysnnova is a complete grade management system for schools. Subject teachers encode and submit grades,
                advisers review and publish them, students see their results instantly, and administrators get full
                visibility, all in one secure platform.
              </p>
<div className="mt-9 flex flex-col sm:flex-row gap-3 animate-fade-up" style={{ animationDelay: "240ms" }}>
                <a href={DOWNLOADS.windows} className="btn-primary text-base px-7 py-3.5 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition">
                  <img src="/windows-logo.png" alt="Windows" className="h-5 w-5 mr-2" />
                  Windows
                </a>
                <a href={DOWNLOADS.linux} className="btn-outline text-base px-7 py-3.5 border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition">
                  <img src="/linux-logo.svg" alt="Linux" className="h-5 w-5 mr-2" />
                  Linux
                </a>
                <a href={DOWNLOADS.android} className="btn-outline text-base px-7 py-3.5 border-2 border-emerald-800 hover:bg-emerald-800 hover:text-white transition">
                  <img src="/android-logo.png" alt="Android" className="h-5 w-5 mr-2" />
                  Android
                </a>
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 pb-14">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {STATS.map((s, i) => (
                <Reveal key={s.label} delay={i * 90}>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start gap-3 hover:-translate-y-1 hover:shadow-md transition">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">{s.icon}</span>
                    </span>
                    <div>
                      <div className="font-display text-2xl font-bold text-slate-900 leading-none">{s.value}</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">{s.label}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= OVERVIEW ================= */}
        <section id="overview" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Reveal>
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Overview</span>
                  <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                    One system for the whole grading cycle
                  </h2>
                  <p className="mt-5 text-base text-slate-600 leading-relaxed">
                    Sysnnova digitizes the entire grading process, from a teacher's first score to the report card a
                    student takes home. Instead of shared drives, USB sticks, and paper chases, every step happens in one
                    accountable, verifiable workflow.
                  </p>
                </Reveal>
                <ul className="mt-7 space-y-3.5">
                  {[
                    { icon: "download", color: "bg-sky-100 text-sky-700", text: "Teachers download the official Excel grading template for their exact class, subject, and semester." },
                    { icon: "upload", color: "bg-emerald-100 text-emerald-700", text: "Files are uploaded, cryptographically signed, and verified against the teacher's key." },
                    { icon: "fact_check", color: "bg-amber-100 text-amber-700", text: "Advisers review every subject list, request fixes, then publish finalized grades." },
                    { icon: "assignment_turned_in", color: "bg-rose-100 text-rose-700", text: "Students see results instantly and advisers produce official report cards." },
                  ].map((li, i) => (
                    <Reveal key={li.text} delay={i * 80}>
                      <li className="flex items-start gap-3">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${li.color}`}>
                          <span className="material-symbols-outlined text-base" aria-hidden="true">{li.icon}</span>
                        </span>
                        <span className="text-sm text-slate-600 leading-relaxed pt-1">{li.text}</span>
                      </li>
                    </Reveal>
                  ))}
                </ul>
              </div>

              <Reveal delay={120}>
                <div className="rounded-2xl border border-slate-200 bg-indigo-50/50 p-6 sm:p-8">
                  <div className="grid sm:grid-cols-3 gap-4 text-center">
                    <div className="rounded-xl bg-sky-50 border border-sky-200 p-4">
                      <span className="material-symbols-outlined text-3xl text-sky-600" aria-hidden="true">edit_note</span>
                      <div className="mt-2 text-sm font-bold text-sky-800">Teacher encodes</div>
                      <div className="text-xs text-sky-700/70 mt-1">Excel template, signed upload</div>
                    </div>
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                      <span className="material-symbols-outlined text-3xl text-amber-600" aria-hidden="true">fact_check</span>
                      <div className="mt-2 text-sm font-bold text-amber-800">Adviser reviews</div>
                      <div className="text-xs text-amber-700/70 mt-1">Verifies, then publishes</div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <span className="material-symbols-outlined text-3xl text-emerald-600" aria-hidden="true">celebration</span>
                      <div className="mt-2 text-sm font-bold text-emerald-800">Student sees</div>
                      <div className="text-xs text-emerald-700/70 mt-1">Instant access + report card</div>
                    </div>
                  </div>
                  <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Class 11 - STEM · Block 1</span>
                      <span className="badge-success">Published</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {[
                        ["General Mathematics", "Jose Reyes", "91"],
                        ["Filipino", "Luz Magsaysay", "88"],
                        ["Earth and Life Science", "Pedro Lim", "94"],
                      ].map(([subj, teacher, grade]) => (
                        <div key={subj} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="text-slate-700">{subj}</span>
                          <span className="text-xs text-slate-400">{teacher}</span>
                          <span className="font-bold text-indigo-600">{grade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= THE PROBLEM ================= */}
        <section id="problem" className="scroll-mt-20 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <Reveal className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-rose-600">The problem</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                School grading is stuck in the paper age
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                Most schools still manage grades through notebooks, emails, and USB transfers. It is slow, error-prone,
                unaccountable, and stressful for everyone involved.
              </p>
            </Reveal>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROBLEMS.map((p, i) => (
                <Reveal key={p.title} delay={(i % 3) * 90}>
                  <div className={`card p-6 border-t-4 ${p.ring} hover:-translate-y-1 hover:shadow-md transition`}>
                    <span className={`inline-grid h-11 w-11 place-items-center rounded-xl ${p.color}`}>
                      <span className="material-symbols-outlined text-2xl" aria-hidden="true">{p.icon}</span>
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{p.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= HOW IT WORKS ================= */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <Reveal className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-600">How it works</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Three steps, zero chasing
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                The entire grading period collapses into three clear responsibilities.
              </p>
            </Reveal>

            <div className="mt-12 grid md:grid-cols-3 gap-5">
              {STEPS.map((s, i) => (
                <Reveal key={s.num} delay={i * 110}>
                  <div className={`rounded-2xl border p-6 ${s.color} h-full`}>
                    <div className="flex items-center justify-between">
                      <span className="font-display text-4xl font-bold text-slate-900/15">{s.num}</span>
                      <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide">{s.role}</span>
                    </div>
                    <h3 className="mt-3 font-display text-xl font-bold text-slate-900">{s.title}</h3>
                    <p className="mt-2 text-sm text-slate-700 leading-relaxed">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= FEATURES ================= */}
        <section id="features" className="scroll-mt-20 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <Reveal className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Features</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Everything a school needs to run grades
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                From the first score to the report card, and from one teacher to the whole school district.
              </p>
            </Reveal>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 4) * 70}>
                  <div className="card p-5 hover:shadow-md hover:-translate-y-1 transition h-full">
                    <span className={`inline-grid h-11 w-11 place-items-center rounded-xl ${f.color}`}>
                      <span className="material-symbols-outlined text-2xl" aria-hidden="true">{f.icon}</span>
                    </span>
                    <h3 className="mt-4 font-display text-base font-bold text-slate-900">{f.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= ROLES ================= */}
        <section id="roles" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <Reveal className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600">Who it's for</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Built for every role in the school
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                Each user sees exactly what they need, nothing more, nothing less.
              </p>
            </Reveal>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {ROLES.map((r, i) => (
                <Reveal key={r.key} delay={i * 90}>
                  <div className="card p-6 hover:shadow-md hover:-translate-y-1 transition h-full">
                    <span className={`inline-grid h-12 w-12 place-items-center rounded-xl ${r.color}`}>
                      <span className="material-symbols-outlined text-2xl" aria-hidden="true">{r.icon}</span>
                    </span>
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{r.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{r.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================= SCREENSHOTS / PRODUCT TOUR ================= */}
        <section id="screens" className="scroll-mt-20 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <Reveal className="mx-auto max-w-3xl text-center">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Product tour</span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                A tour of every screen
              </h2>
              <p className="mt-4 text-base text-slate-600 leading-relaxed">
                Real screenshots from the live system. Click through every page, from sign-in to the admin database monitor.
              </p>
            </Reveal>

            {SCREENS.map((group, gi) => (
              <Reveal key={group.group} delay={gi * 60}>
                <div className="mt-14">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${group.accent}`}>{group.group}</span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  <div className="mt-6 grid sm:grid-cols-2 gap-6">
                    {group.items.map((item) => (
                      <ScreenCard key={item.title} item={item} />
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================= SECURITY ================= */}
        <section id="security" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <Reveal>
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-8 text-white">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-emerald-400" aria-hidden="true">verified_user</span>
                    <h3 className="font-display text-2xl font-bold">Security by design</h3>
                  </div>
                  <div className="mt-6 space-y-5">
                    {[
                      { icon: "key", title: "Signed submissions", desc: "Each grade upload is signed with the teacher's private key and verified with their public key, so files cannot be tampered with." },
                      { icon: "manage_accounts", title: "Role-based access", desc: "Advisers, teachers, students, and admins only ever see the screens and data their role permits." },
                      { icon: "email", title: "Device verification", desc: "Logging in from a new device sends an emailed verification code before access is granted." },
                      { icon: "fingerprint", title: "Hashed credentials", desc: "Passwords are never stored in plain text. They are bcrypt-hashed, and verification codes are stored as one-way hashes." },
                    ].map((s) => (
                      <div key={s.title} className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-emerald-300">
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">{s.icon}</span>
                        </span>
                        <div>
                          <div className="text-sm font-bold">{s.title}</div>
                          <div className="text-sm text-slate-400 leading-relaxed mt-0.5">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>

              <Reveal delay={120}>
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Security & trust</span>
                <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  Grades you can trust, down to the keystroke
                </h2>
                <p className="mt-5 text-base text-slate-600 leading-relaxed">
                  A school's grades are official records. Sysnnova treats them that way. Every upload is signed and
                  verified, every account is locked down, and every sensitive action is recorded in an audit trail
                  administrators can review.
                </p>
                <ul className="mt-7 space-y-4">
                  {[
                    { icon: "receipt_long", color: "text-emerald-600 bg-emerald-50", text: "Full audit trail. Logins, signups, publishes, and admin actions are all recorded with actor, timestamp, and IP." },
                    { icon: "database", color: "text-indigo-600 bg-indigo-50", text: "Admin database monitor. Inspect collections with secrets redacted; no raw password or private key is ever exposed." },
                    { icon: "sync_lock", color: "text-sky-600 bg-sky-50", text: "Emailed codes for verification and password recovery keep accounts in the hands of their owners." },
                  ].map((s, i) => (
                    <Reveal key={s.text} delay={i * 80}>
                      <li className="flex items-start gap-3">
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${s.color}`}>
                          <span className="material-symbols-outlined text-lg" aria-hidden="true">{s.icon}</span>
                        </span>
                        <span className="text-sm text-slate-600 leading-relaxed pt-1">{s.text}</span>
                      </li>
                    </Reveal>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <span className="font-display font-bold text-white text-lg tracking-tight">Sysnnova</span>
              <p className="mt-4 max-w-sm text-sm text-slate-400 leading-relaxed">
                The school grade management system for Philippine senior high schools. From a teacher's first score to a
                student's report card, transparent, accountable, and automatic.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Explore</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                {NAV.map((n) => (
                  <li key={n.href}>
                    <a href={n.href} onClick={scrollTo(n.href)} className="text-slate-400 hover:text-white transition">{n.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">Developer</h4>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li className="text-slate-400">Developed by JetherS. Garque</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <span>© {new Date().getFullYear()} Sysnnova. All rights reserved.</span>
            <span>Made for schools that value their students' records.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
