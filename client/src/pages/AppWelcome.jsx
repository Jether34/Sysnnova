import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppWelcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem("sysnnova.welcomeSeen") === "1";
    } catch {
      /* ignore */
    }
    if (seen && !loading) navigate(user ? "/dashboard" : "/login", { replace: true });
  }, [loading, user, navigate]);

  const getStarted = () => {
    try {
      localStorage.setItem("sysnnova.welcomeSeen", "1");
    } catch {
      /* storage unavailable; still proceed */
    }
    navigate(user ? "/dashboard" : "/login", { replace: true });
  };

  return (
    <div className="h-dvh flex flex-col bg-surface dark:bg-black overflow-y-auto sm:h-auto sm:min-h-screen">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:py-4">
        <div className="w-full max-w-lg text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-8">
            Welcome to Sysnnova
          </h1>
          <button className="btn-primary w-full max-w-xs mx-auto text-lg py-4" onClick={getStarted}>
            Let's Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
