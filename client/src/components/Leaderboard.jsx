import { useEffect, useState } from "react";
import api from "../api/client.js";
import { useUI } from "./ui.jsx";

const MEDALS = [
  "bg-amber-400 text-amber-950",
  "bg-slate-300 text-slate-700",
  "bg-orange-300 text-orange-900",
];

export function RankColumn({ title, icon, items, className = "" }) {
  return (
    <div className={`card flex flex-col overflow-hidden ${className}`}>
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="material-symbols-outlined text-lg text-primary-600" aria-hidden="true">{icon}</span>
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">Highest average grade given this school year.</p>
      </div>
      <ul className="flex-1 min-h-0 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {items.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">No grades recorded yet.</li>}
        {items.map((t, i) => (
          <li key={t.id} className="flex items-center gap-3 px-5 py-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${MEDALS[i] || "bg-slate-100 text-slate-500"}`}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">{t.name}</div>
              <div className="truncate text-xs text-slate-500">
                {t.best?.subject ? `${t.best.subject} · ` : ""}{t.best?.className || ""}{t.sheets ? ` · ${t.sheets} sheet${t.sheets === 1 ? "" : "s"}` : ""}
              </div>
            </div>
            <span className="shrink-0 font-display text-lg font-bold text-primary-700">{t.avgGrade}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Leaderboard({ stacked = false, variant = null, data: externalData, className = "" }) {
  const { show } = useUI();
  const [data, setData] = useState(externalData || null);

  useEffect(() => {
    if (externalData) {
      setData(externalData);
      return;
    }
    api
      .get("/grades/leaderboard")
      .then(({ data }) => setData(data))
      .catch((err) => show(err.message, "error"));
  }, [externalData]);

  if (!data) return null;

  if (variant === "teachers") {
    return <RankColumn title="Top Teachers" icon="groups" items={data.teachers || []} className={className} />;
  }
  if (variant === "advisers") {
    return <RankColumn title="Top Advisers" icon="group" items={data.advisers || []} className={className} />;
  }

  return (
    <div className={stacked ? "space-y-6" : "grid gap-6 md:grid-cols-2"}>
      <RankColumn title="Top Teachers" icon="groups" items={data.teachers || []} />
      <RankColumn title="Top Advisers" icon="group" items={data.advisers || []} />
    </div>
  );
}
