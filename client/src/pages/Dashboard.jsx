import { useAuth } from "../context/AuthContext.jsx";
import AdviserDashboard from "./AdviserDashboard.jsx";
import TeacherDashboard from "./TeacherDashboard.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import Spinner from "../components/Spinner.jsx";

export default function Dashboard() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner full />;
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "adviser") return <AdviserDashboard />;
  if (user.role === "teacher") return <TeacherDashboard />;
  return <StudentDashboard />;
}
