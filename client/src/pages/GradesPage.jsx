import { useAuth } from "../context/AuthContext.jsx";
import GradeSubmissions from "../components/GradeSubmissions.jsx";

export default function GradesPage() {
  const { user } = useAuth();
  const isAdviser = user.role === "adviser";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Submitted Grades</h1>
        <p className="mt-1 text-sm text-slate-500 max-w-3xl">
          {isAdviser
            ? "Every grade list your subject teachers generate from My Students is routed here for your review. Nothing reaches students until you select lists and send them to the student portal."
            : "The grade lists you generate from My Students are routed to your adviser for review here. Students only see grades after your adviser sends them."}
        </p>
      </div>
      <GradeSubmissions />
    </div>
  );
}
