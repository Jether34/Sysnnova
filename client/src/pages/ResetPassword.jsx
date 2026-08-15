import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useUI } from "../components/ui.jsx";
import PasswordInput from "../components/PasswordInput.jsx";

export default function ResetPassword() {
  const { show } = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      show("Passwords do not match.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { email, code: code.trim(), password });
      show("Password updated. You can now sign in.", "success");
      navigate("/login", { replace: true });
    } catch (err) {
      show(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-dvh flex items-center justify-center bg-surface px-6 sm:h-auto sm:min-h-screen [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <span className="hidden sm:inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary-600 text-white">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">lock_reset</span>
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900">Reset your password</h1>
          <p className="mt-1.5 text-base text-slate-500">Enter the code we emailed you and choose a new password.</p>
        </div>

        <div className="card p-8 sm:p-12">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="you@school.edu.ph" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Reset code</label>
              <input type="text" inputMode="numeric" maxLength={6} autoComplete="one-time-code"
                className="input text-center text-2xl tracking-[0.5em]"
                placeholder="000000" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
            </div>
            <div>
              <label className="label">New password</label>
              <PasswordInput placeholder="At least 6 characters" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <PasswordInput placeholder="Repeat your password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={busy || code.length < 6}>
              {busy ? "Resetting..." : "Reset password"}
            </button>
            <p className="text-center text-sm text-slate-500">
              <Link to="/forgot-password" className="font-medium text-primary-600 hover:text-primary-700">Resend code</Link>
              {" · "}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">Back to sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
