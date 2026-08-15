import { computeGrade } from "../utils/compute.js";

const SPINNERLESS = "appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function itemFor(row, field, items, ownOnly = false) {
  const own = Number(row[`${field}Items`]);
  if (Number.isFinite(own)) {
    if (ownOnly) return own;
    if (own > 0) return own;
  }
  if (ownOnly) return null;
  const g = Number(items[field]);
  return Number.isFinite(g) && g > 0 ? g : null;
}

function moveToNextScore(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const field = e.currentTarget.dataset.field;
  const idx = Number(e.currentTarget.dataset.idx);
  const next = [...document.querySelectorAll(`input[data-field="${field}"]`)]
    .filter((el) => Number(el.dataset.idx) > idx)
    .sort((a, b) => Number(a.dataset.idx) - Number(b.dataset.idx))[0];
  if (next) {
    next.focus();
    next.select();
  }
}

function ComponentCells({ s, field, label, readOnly, setScore, compact, showItems, items, editableItems, rowIndex }) {
  if (readOnly) {
    const ownItems = itemFor(s, field, items, true);
    return (
      <>
        <td className="text-center">{s[field] === null || s[field] === undefined || s[field] === "" ? "—" : s[field]}</td>
        {showItems && <td className="text-center">{ownItems !== null && ownItems > 0 ? ownItems : "—"}</td>}
      </>
    );
  }
  return (
    <>
      <td>
        <input
          type="number"
          min={0}
          max={itemFor(s, field, items) || 1000}
          step="any"
          placeholder="0"
          title={label}
          data-field={field}
          data-idx={rowIndex}
          onKeyDown={moveToNextScore}
          className={`${SPINNERLESS} ${
            compact
              ? "w-full min-w-14 rounded-md border-0 bg-transparent px-1.5 py-1 text-center text-sm text-slate-900 outline-none transition hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
              : "rounded-md border-0 bg-transparent px-2 py-1.5 text-center text-slate-900 outline-none transition hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
          }`}
          value={s[field] ?? ""}
          onChange={(e) => setScore(s.id, field, e.target.value)}
        />
      </td>
      {showItems &&
        (editableItems ? (
          <td>
            <input
              type="number"
              min={1}
              step="any"
              placeholder="item"
              title={`${label} total items`}
              className={`${SPINNERLESS} ${
                compact
                  ? "w-full min-w-14 rounded-md border-0 bg-transparent px-1.5 py-1 text-center text-sm text-slate-900 outline-none transition hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                  : "rounded-md border-0 bg-transparent px-2 py-1.5 text-center text-slate-900 outline-none transition hover:bg-slate-100 focus:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
              }`}
              value={s[`${field}Items`] ?? ""}
              onChange={(e) => setScore(s.id, `${field}Items`, e.target.value)}
            />
          </td>
        ) : (
          <td className="text-center font-medium text-slate-500">{itemFor(s, field, items)}</td>
        ))}
    </>
  );
}

export default function EncodeTable({
  roster,
  scores,
  setScore,
  items = { ww: 100, pt: 100, qa: 100 },
  readOnly = false,
  compact = false,
  showItems = false,
  fill = false,
  editableItems = false,
}) {
  return (
    <div
      className={`${fill ? "min-h-0 flex-1 " : ""}overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
    >
      <table className={`table ${compact ? "w-full min-w-0 [&_th]:!px-2 [&_th]:!py-1 [&_td]:!px-2 [&_td]:!py-0.5" : "min-w-[760px]"}`}>
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900">Student</th>
            <th className="text-center">Written Work</th>
            {showItems && <th className="text-center">WW Items</th>}
            <th className="text-center">Performance Task</th>
            {showItems && <th className="text-center">PT Items</th>}
            <th className="text-center">Quarterly Assessment</th>
            {showItems && <th className="text-center">QA Items</th>}
            <th className="text-center">Weighted</th>
            <th className="text-center">Transmuted</th>
            {!compact && !showItems && <th>Remark</th>}
          </tr>
        </thead>
        <tbody>
          {roster.map((s, rowIndex) => {
            const row = scores[s.id] || {};
            const studentItems = {
              ww: itemFor(row, "ww", items, readOnly),
              pt: itemFor(row, "pt", items, readOnly),
              qa: itemFor(row, "qa", items, readOnly),
            };
            const r = computeGrade({ ww: row.ww, pt: row.pt, qa: row.qa, items: studentItems });
            return (
              <tr key={s.id}>
                <td className="sticky left-0 bg-white font-semibold text-slate-900 whitespace-nowrap dark:bg-slate-950">{s.lastName}, {s.firstName}</td>
                <ComponentCells s={row} field="ww" label="Written Work" readOnly={readOnly} setScore={setScore} compact={compact} showItems={showItems} items={items} editableItems={editableItems} rowIndex={rowIndex} />
                <ComponentCells s={row} field="pt" label="Performance Task" readOnly={readOnly} setScore={setScore} compact={compact} showItems={showItems} items={items} editableItems={editableItems} rowIndex={rowIndex} />
                <ComponentCells s={row} field="qa" label="Quarterly Assessment" readOnly={readOnly} setScore={setScore} compact={compact} showItems={showItems} items={items} editableItems={editableItems} rowIndex={rowIndex} />
                <td className="text-center font-semibold text-slate-700 whitespace-nowrap">{r.complete ? r.weighted.toFixed(2) : "—"}</td>
                <td className="text-center whitespace-nowrap">
                  <span className={`inline-flex min-w-[44px] items-center justify-center rounded-md px-2.5 py-1 font-bold ${r.complete && r.transmuted >= 75 ? "bg-primary-50 text-primary-700" : "bg-red-50 text-red-700"}`}>
                    {r.complete ? r.transmuted : "—"}
                  </span>
                </td>
                {!compact && !showItems && <td className="text-sm">{r.complete ? r.remark : <span className="text-slate-400">Fill all three</span>}</td>}
              </tr>
            );
          })}
          {roster.length === 0 && (
            <tr><td colSpan={showItems ? 9 : compact ? 6 : 7} className="px-4 py-6 text-center text-slate-400">No students in this class.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
