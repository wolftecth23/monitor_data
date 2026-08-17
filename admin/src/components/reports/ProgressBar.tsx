export function ProgressBar({ percent }: { percent: number }) {
  const pct = Math.max(0, Math.min(100, percent));
  const color = pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  const textColor = pct >= 75 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded bg-gray-200 overflow-hidden">
        <div className={`h-1.5 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold shrink-0 ${textColor}`}>{pct.toFixed(1)}%</span>
    </div>
  );
}
