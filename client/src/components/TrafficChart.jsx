export default function TrafficChart({ data = [] }) {
  const W = 720;
  const H = 170;
  const PAD = 6;

  if (!data.length) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="No traffic data yet">
        <rect x={0} y={0} width={W} height={H} fill="#f8fafc" rx={8} />
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={13} fill="#94a3b8">Waiting for traffic…</text>
      </svg>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0;

  const pts = data.map((d, i) => ({
    x: PAD + i * step,
    y: H - PAD - (d.count / max) * (H - PAD * 2),
    count: d.count,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pts[pts.length - 1].x).toFixed(1)},${H - PAD} L${pts[0].x.toFixed(1)},${H - PAD} Z`;
  const last = pts[pts.length - 1];

  const grid = [0.25, 0.5, 0.75].map((f) => {
    const y = H - PAD - f * (H - PAD * 2);
    return { y, label: Math.round(max * f) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Live requests per second chart">
      <defs>
        <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {grid.map((g, i) => (
        <g key={i}>
          <line x1={PAD} y1={g.y} x2={W - PAD} y2={g.y} stroke="#e2e8f0" strokeWidth={1} />
          <text x={W - PAD - 2} y={g.y - 3} textAnchor="end" fontSize={10} fill="#94a3b8">{g.label}</text>
        </g>
      ))}

      <path d={area} fill="url(#trafficFill)" />
      <path d={line} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={4} fill="#4f46e5" />
      <circle cx={last.x} cy={last.y} r={8} fill="#6366f1" opacity={0.2} />
    </svg>
  );
}
