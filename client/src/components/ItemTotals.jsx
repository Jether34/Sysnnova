const FIELDS = [
  { key: "ww", label: "Written Work items", hint: "WW" },
  { key: "pt", label: "Performance Task items", hint: "PT" },
  { key: "qa", label: "Quarterly Assessment items", hint: "QA" },
];

export default function ItemTotals({ items = { ww: 100, pt: 100, qa: 100 }, onChange, disabled, compact = false }) {
  if (compact) {
    return (
      <div className="flex flex-wrap items-end gap-2.5" title="Allocate item totals — e.g. a 150-item performance task">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label !mb-1 !text-[11px]">{f.label}</label>
            <input
              type="number"
              min={1}
              max={500}
              step="any"
              disabled={disabled}
              className="input !w-24 !py-1.5 text-center text-sm"
              value={items[f.key] ?? 100}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...items, [f.key]: Number.isFinite(n) && n > 0 ? n : 100 });
              }}
            />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 p-3 sm:p-4 dark:border-slate-700">
      <div className="mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-primary-600" aria-hidden="true">tune</span>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score allocation</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label !text-xs">{f.label}</label>
            <input
              type="number"
              min={1}
              max={500}
              step="any"
              disabled={disabled}
              className="input"
              value={items[f.key] ?? 100}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...items, [f.key]: Number.isFinite(n) && n > 0 ? n : 100 });
              }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Scores are computed out of these totals and converted to percentages. You may allocate more than 100 items (e.g. a 150-item performance task) for a more accessible breakdown.
      </p>
    </div>
  );
}
