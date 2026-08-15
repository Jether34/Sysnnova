import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Spinner from "./components/Spinner.jsx";
import Layout from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import AppWelcome from "./pages/AppWelcome.jsx";
import { isNativeApp } from "./utils/platform.js";
import { useAuth } from "./context/AuthContext.jsx";
import Signup from "./pages/Signup.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import GradesPage from "./pages/GradesPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import MyStudentsPage from "./pages/MyStudentsPage.jsx";
import DatabaseMonitor from "./pages/DatabaseMonitor.jsx";

const WELCOME_KEY = "sysnnova.welcomeSeen";
const welcomeSeen = () => {
  try {
    return localStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
};

export default function App() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const native = isNativeApp();
  const atEntry = native && (location.pathname === "/" || location.pathname === "/landing" || location.pathname === "/app-welcome");
  const atHome = location.pathname === "/" || location.pathname === "/landing";

  // While the persisted session is being restored, never render the login form
  // or decide a redirect based on a not-yet-loaded user. This prevents the
  // "re-login required on every app open" race.
  if (loading) {
    if (atEntry || atHome) {
      return <Spinner full label="Checking authentication..." />;
    }
    if (location.pathname === "/login") {
      return <Spinner full label="Checking authentication..." />;
    }
  }

  if (atEntry) {
    if (location.pathname === "/app-welcome") {
      if (!welcomeSeen()) {
        // first-run welcome screen; AppWelcome handles its own redirect
      } else {
        return <Navigate to={user ? "/dashboard" : "/login"} replace />;
      }
    } else if (!welcomeSeen()) {
      return <Navigate to="/app-welcome" replace />;
    } else if (user) {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  if (atHome && !native) {
    if (user) return <Navigate to="/dashboard" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/app-welcome" element={<AppWelcome />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={["adviser", "teacher", "student", "admin"]}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/grades"
        element={
          <ProtectedRoute roles={["adviser", "teacher"]}>
            <Layout>
              <GradesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-students"
        element={
          <ProtectedRoute roles={["adviser", "teacher"]}>
            <Layout>
              <MyStudentsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute roles={["adviser", "teacher"]}>
            <Layout>
              <MessagesPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/database"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Layout>
              <DatabaseMonitor />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
