import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client.js";
import { useUI } from "../components/ui.jsx";

export default function ForgotPassword() {
  const { show } = useUI();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent({ maskedEmail: data.maskedEmail });
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
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900">Forgot your password?</h1>
          <p className="mt-1.5 text-base text-slate-500">Enter your email and we will send you a reset code.</p>
        </div>

        <div className="card p-8 sm:p-12">
          {!sent ? (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="you@school.edu.ph" value={email}
                  onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending..." : "Send reset code"}</button>
            </form>
          ) : (
            <div className="space-y-5 text-center">
              <span className="material-symbols-outlined text-4xl text-emerald-600" aria-hidden="true">mail</span>
              <p className="text-base leading-snug text-slate-600">
                If an account exists for <strong>{sent.maskedEmail}</strong>, a password reset code is on its way.
              </p>
              <button className="btn-primary w-full" onClick={() => navigate("/reset-password", { state: { email } })}>
                Continue
              </button>
              <p className="text-sm text-slate-500">
                Remembered it? <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">Back to sign in</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
