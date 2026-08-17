import { Link } from "react-router-dom";

const REPORTS = [
  { to: "/reports/attendance-daily", label: "Daily Attendance Report", description: "Arrival, departure and working time for a single day." },
  { to: "/reports/attendance-monthly", label: "Monthly Attendance Report", description: "Calendar view of working/online time across the month." },
  { to: "/reports/in-out-monthly", label: "Monthly In-Out Report", description: "Calendar view of punch in/out times across the month." },
  { to: "/reports/summary", label: "Summary Report", description: "Present days, online/active/productive time by month." },
  { to: "/reports/activity", label: "Activity Report", description: "Online, active, idle, break time and input activity." },
  { to: "/reports/apps-urls", label: "Apps/URLs Report", description: "Usage breakdown of applications and websites." },
  { to: "/reports/productivity", label: "Productivity Report", description: "Productive vs unproductive vs neutral time." },
  { to: "/reports/logs", label: "Logs Report", description: "Detailed activity log, per app/URL or individual events." },
  { to: "/reports/usb-detection", label: "USB Detection Report", description: "USB device connect/disconnect events." },
];

export function ReportsHome() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Reports</h1>
      <div className="grid grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Link key={r.to} to={r.to} className="bg-white rounded-lg shadow p-4 hover:shadow-md transition block">
            <div className="font-semibold text-sm mb-1">{r.label}</div>
            <div className="text-xs text-gray-500">{r.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
