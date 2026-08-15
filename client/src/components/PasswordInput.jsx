import { useState } from "react";

export default function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} className={`input pr-10 ${className}`} {...props} />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition-colors hover:text-slate-600 focus:outline-none dark:text-slate-500 dark:hover:text-slate-300"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden="true">{show ? "visibility_off" : "visibility"}</span>
      </button>
    </div>
  );
}
