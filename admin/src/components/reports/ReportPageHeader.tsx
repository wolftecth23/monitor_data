import { Link } from "react-router-dom";

export function ReportPageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Link to="/reports" className="text-gray-500 hover:text-gray-800">
          ←
        </Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
