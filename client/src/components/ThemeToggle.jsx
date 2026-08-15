import { useTheme } from "../context/ThemeContext.jsx";

export default function ThemeToggle({ variant = "ghost", className = "" }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  const styles =
    variant === "solid"
      ? "border-slate-300/30 text-slate-400 hover:text-white hover:bg-white/10"
      : "border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-200";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${styles} ${className}`}
    >
      <span className="material-symbols-outlined text-xl leading-none" aria-hidden="true">
        {dark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
