import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { ReportTable, type Column } from "../../components/reports/ReportTable";
import { ProgressBar } from "../../components/reports/ProgressBar";
import { currentMonthStr, formatDurationShort } from "../../lib/reportUtils";

interface Row {
  employeeId: string;
  name: string;
  presentDays: number;
  onlineTimeMinutes: number;
  activeTimeMinutes: number;
  productiveTimeMinutes: number;
  productivityPercentage: number;
}

export function Summary() {
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [month, setMonth] = useState(currentMonthStr());

  const { data, isLoading } = useQuery({
    queryKey: ["report-summary", selection, month],
    queryFn: async () => (await reportsAPI.getSummary({ ...selection, month })).data,
  });

  const columns: Column<Row>[] = [
    { key: "name", label: "Employee", render: (r) => r.name },
    { key: "presentDays", label: "Present Days", align: "center", render: (r) => r.presentDays },
    { key: "online", label: "Online Time", align: "center", render: (r) => formatDurationShort(r.onlineTimeMinutes) },
    { key: "active", label: "Active Time", align: "center", render: (r) => formatDurationShort(r.activeTimeMinutes) },
    { key: "productive", label: "Productive Time", align: "center", render: (r) => formatDurationShort(r.productiveTimeMinutes) },
    { key: "productivity", label: "Productivity %", render: (r) => <ProgressBar percent={r.productivityPercentage} /> },
  ];

  return (
    <div className="p-6">
      <ReportPageHeader title="Summary Report">
        <TeamEmployeeFilter value={selection} onChange={setSelection} />
        <DateRangeFilter mode="month" value={month} onChange={setMonth} />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <ReportTable columns={columns} rows={data?.rows ?? []} emptyMessage="No data" />
        )}
      </div>
    </div>
  );
}
