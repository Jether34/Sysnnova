import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "./ui.jsx";
import SyncBanner from "../offline/SyncBanner.jsx";

const ROLE_LABEL = { adviser: "Adviser", teacher: "Subject Teacher", student: "Student", admin: "System Administrator" };

const NAV_ICONS = {
  "/dashboard": "dashboard",
  "/database": "storage",
  "/grades": "table_view",
  "/my-students": "groups",
  "/messages": "chat",
};

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { show, confirm } = useUI();
  const [open, setOpen] = useState(false);

  const links = user
    ? user.role === "admin"
      ? [
          { to: "/dashboard", label: "System Admin" },
          { to: "/database", label: "Database Monitor" },
        ]
      : user.role === "student"
        ? [{ to: "/dashboard", label: "My Grades" }]
        : [
            { to: "/dashboard", label: "Dashboard" },
            { to: "/my-students", label: "My Students" },
            { to: "/grades", label: "Submitted Grades" },
            { to: "/messages", label: "Messages" },
          ]
    : [];

  const initials = user
    ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
    : "?";

  const close = () => setOpen(false);

  const deleteAccount = async () => {
    const ok = await confirm({
      title: "Delete your account?",
      message: "This action is irreversible. Your account data will be archived and all your grade sheets, assessments, and messages will be permanently removed.",
      confirmLabel: "Delete my account",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await api.delete("/auth/me");
      show("Account deleted successfully.");
      logout();
    } catch (err) {
      show(err.message, "error");
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
        <span className="font-display font-bold text-white text-lg tracking-tight">Sysnnova</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Menu</p>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/dashboard"}
            onClick={close}
            className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{NAV_ICONS[l.to]}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-2">
          <span className="h-9 w-9 rounded-full bg-primary-600/80 grid place-items-center text-sm font-bold text-white">{initials}</span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-semibold text-white">{user?.fullName}</div>
            <div className="truncate text-xs text-slate-400">
              {ROLE_LABEL[user?.role]}{user?.grade && user?.grade !== "N/A" ? ` · Grade ${user.grade}` : ""}
            </div>
          </div>
        </div>
        {(user?.role === "teacher" || user?.role === "adviser") && (
          <button
            onClick={deleteAccount}
            className="sidebar-link w-full !text-slate-400 hover:!text-red-300 hover:!bg-red-500/10"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete_forever</span>
            Delete account
          </button>
        )}
        <button
          onClick={logout}
          className="sidebar-link w-full !text-slate-400 hover:!text-red-300 hover:!bg-red-500/10"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">logout</span>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface dark:bg-black">
      <SyncBanner />
      {/* mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-sidebar text-white shadow-sm">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex items-center justify-center h-10 w-10 -ml-2 rounded-lg hover:bg-white/10 transition"
        >
          <span className="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight">
          Sysnnova
        </div>
        <div className="w-10" />
      </header>

      {/* mobile overlay */}
      {open && <div className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={close} />}

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-white shadow-2xl transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-8 py-6 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
