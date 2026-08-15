import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useUI } from "../components/ui.jsx";
import PasswordInput from "../components/PasswordInput.jsx";
import { getDeviceInfo } from "../auth/deviceService.js";

export default function Login() {
  const { login, verifyLogin } = useAuth();
  const { show } = useUI();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("form");
  const [pending, setPending] = useState({ email: "", maskedEmail: "" });
  const [code, setCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const deviceInfo = await getDeviceInfo();
      const res = await login(form.email, form.password, deviceInfo);
      if (res.needsVerification) {
        setPending({ email: form.email, maskedEmail: res.maskedEmail });
        setCode("");
        setStep("verify");
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      if (err.message) {
        show(err.message, "error");
      } else {
        show("An unexpected error occurred during login.", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setVerifyBusy(true);
    try {
      const deviceInfo = await getDeviceInfo();
      await verifyLogin(pending.email, code.trim(), deviceInfo);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      show(err.message, "error");
    } finally {
      setVerifyBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const deviceInfo = await getDeviceInfo();
      const res = await login(pending.email, form.password, deviceInfo);
      if (res.needsVerification) {
        setPending((p) => ({ ...p, maskedEmail: res.maskedEmail }));
        show("A new verification code was sent.", "info");
      }
    } catch (err) {
      if (err.message) {
        show(err.message, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-dvh flex flex-col bg-surface dark:bg-black overflow-y-auto sm:h-auto sm:min-h-screen">
      <div className="flex flex-1 flex-col items-center px-6 py-8 sm:py-4">
        <div className="my-auto w-full max-w-lg">
          <div className="mb-8 text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {step === "verify"
                ? "Verify your sign-in"
                : "Sign in to Sysnnova"}
            </h1>
            <p className="mt-1.5 text-base text-slate-500 dark:text-slate-400">
              {step === "verify"
                ? `We sent a code to ${pending.maskedEmail}.`
                : "Use your school email and password."}
            </p>
          </div>

          {step === "form" ? (
            <div className="card p-8 sm:p-12">
              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@school.edu.ph"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="label !mb-0">Password</label>
                    <Link
                      to="/forgot-password"
                      className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
                <button className="btn-primary w-full" disabled={busy}>
                  {busy ? "Signing in..." : "Sign in"}
                </button>
              </form>
            </div>
          ) : step === "verify" ? (
            <div className="card p-8 sm:p-12">
              <form onSubmit={verify} className="space-y-5">
                <div>
                  <label className="label">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    className="input text-center text-2xl tracking-[0.5em]"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                    autoFocus
                  />
                </div>
                <button className="btn-primary w-full" disabled={verifyBusy || code.length < 6}>
                  {verifyBusy ? "Verifying..." : "Verify and sign in"}
                </button>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={resend}
                    disabled={busy}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    Resend code
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep("form")}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Back
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <p className="mt-5 text-center text-base text-slate-500 dark:text-slate-400">
            {step === "form" ? (
              <>
                No account yet?{" "}
                <Link
                  to="/signup"
                  className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Create one
                </Link>
              </>
            ) : (
              <>
                Having trouble?{" "}
                <Link
                  to="/forgot-password"
                  className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  Reset your password
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}