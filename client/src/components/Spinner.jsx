export default function Spinner({ full = false, label = "Loading..." }) {
  return (
    <div className={full ? "min-h-screen flex flex-col items-center justify-center gap-3" : "flex items-center justify-center gap-3 py-8"}>
      <div className="h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}
