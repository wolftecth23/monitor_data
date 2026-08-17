type Variant = "on-time" | "late" | "early" | "active" | "idle" | "productive" | "unproductive" | "neutral" | "app" | "url" | "connected" | "disconnected" | "full-day" | "half-day" | "absent";

const STYLES: Record<Variant, string> = {
  "on-time": "bg-green-100 text-green-800",
  late: "bg-red-100 text-red-800",
  early: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  idle: "bg-gray-100 text-gray-600",
  productive: "bg-green-100 text-green-800",
  unproductive: "bg-red-100 text-red-800",
  neutral: "bg-gray-100 text-gray-600",
  app: "bg-blue-100 text-blue-800",
  url: "bg-purple-100 text-purple-800",
  connected: "bg-green-100 text-green-800",
  disconnected: "bg-gray-100 text-gray-600",
  "full-day": "bg-green-100 text-green-800",
  "half-day": "bg-yellow-100 text-yellow-800",
  absent: "bg-red-100 text-red-800",
};

function toVariant(raw: string): Variant {
  const key = raw.toLowerCase().replace(/\s+/g, "-").replace(/_/g, "-") as Variant;
  return STYLES[key] ? key : "neutral";
}

export function StatusBadge({ label }: { label: string | null | undefined }) {
  if (!label) return <span className="text-gray-300 text-xs">-</span>;
  const variant = toVariant(label);
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${STYLES[variant]}`}>{label}</span>;
}
