export const DEFAULT_WEIGHTS = { ww: 0.3, pt: 0.5, qa: 0.2 };

const TRANSMUTATION = [
  [98.4, 99], [96.8, 98], [95.2, 97], [93.6, 96], [92.0, 95], [90.4, 94],
  [88.8, 93], [87.2, 92], [85.6, 91], [84.0, 90], [82.4, 89], [80.8, 88],
  [79.2, 87], [77.6, 86], [76.0, 85], [74.4, 84], [72.8, 83], [71.2, 82],
  [69.6, 81], [68.0, 80], [66.4, 79], [64.8, 78], [63.2, 77], [61.6, 76],
  [60.0, 75], [56.0, 74], [52.0, 73], [48.0, 72], [44.0, 71], [40.0, 70],
  [36.0, 69], [32.0, 68], [28.0, 67], [24.0, 66], [20.0, 65], [16.0, 64],
  [12.0, 63], [8.0, 62], [4.0, 61], [0.0, 60],
];

export function transmute(initial) {
  const n = Number(initial);
  if (Number.isNaN(n)) return null;
  if (n >= 100) return 100;
  if (n < 0) return 60;
  for (const [min, grade] of TRANSMUTATION) {
    if (n >= min) return grade;
  }
  return 60;
}

export function remarkFor(grade) {
  const g = Number(grade);
  if (Number.isNaN(g)) return "";
  if (g >= 90) return "Outstanding";
  if (g >= 85) return "Very Satisfactory";
  if (g >= 80) return "Satisfactory";
  if (g >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function computeGrade({ ww, pt, qa, weights = DEFAULT_WEIGHTS, items }) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const it = { ww: 100, pt: 100, qa: 100, ...(items || {}) };
  const pct = (v, total) => {
    const n = num(v);
    if (n === null) return null;
    const t = Number(total);
    if (!Number.isFinite(t) || t <= 0) return null;
    return Math.max(0, Math.min(100, (n / t) * 100));
  };
  const a = pct(ww, it.ww);
  const b = pct(pt, it.pt);
  const c = pct(qa, it.qa);
  if (a === null || b === null || c === null) {
    return { complete: false, weighted: null, transmuted: null, remark: "", missing: true };
  }
  const weighted = Math.round((a * w.ww + b * w.pt + c * w.qa) * 100) / 100;
  const transmuted = transmute(weighted);
  return { complete: true, weighted, transmuted, remark: remarkFor(transmuted) };
}
