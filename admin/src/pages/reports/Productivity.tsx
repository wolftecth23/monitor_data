import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { AdvanceFilterPanel } from "../../components/reports/AdvanceFilterPanel";
import { ReportTable, type Column } from "../../components/reports/ReportTable";
import { ProgressBar } from "../../components/reports/ProgressBar";
import { daysAgoStr, formatDurationShort, todayStr } from "../../lib/reportUtils";

interface Row {
  employeeId: string;
  name: string;
  attendance: number;
  onlineTimeMinutes: number;
  activeTimeMinutes: number;
  idleTimeMinutes: number;
  productiveTimeMinutes: number;
  unproductiveTimeMinutes: number;
  neutralTimeMinutes: number;
  breakTimeMinutes: number;
  productivityPercentage: number;
}

export function Productivity() {
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [range, setRange] = useState({ startDate: daysAgoStr(7), endDate: todayStr() });
  const [advance, setAdvance] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["report-productivity", selection, range],
    queryFn: async () => (await reportsAPI.getProductivity({ ...selection, ...range })).data,
  });

  const minProductivity = advance.minProductivity ? Number(advance.minProductivity) : undefined;
  const rows: Row[] = (data?.rows ?? []).filter((r: Row) => minProductivity === undefined || r.productivityPercentage >= minProductivity);

  const columns: Column<Row>[] = [
    { key: "name", label: "Employee", render: (r) => r.name },
    { key: "attendance", label: "Attendance", align: "center", render: (r) => r.attendance },
    { key: "online", label: "Online time", align: "center", render: (r) => formatDurationShort(r.onlineTimeMinutes) },
    { key: "active", label: "Active time", align: "center", render: (r) => formatDurationShort(r.activeTimeMinutes) },
    { key: "idle", label: "Idle time", align: "center", render: (r) => formatDurationShort(r.idleTimeMinutes) },
    { key: "productive", label: "Productive time", align: "center", render: (r) => formatDurationShort(r.productiveTimeMinutes) },
    { key: "unproductive", label: "Unproductive time", align: "center", render: (r) => formatDurationShort(r.unproductiveTimeMinutes) },
    { key: "neutral", label: "Neutral time", align: "center", render: (r) => formatDurationShort(r.neutralTimeMinutes) },
    { key: "break", label: "Break time", align: "center", render: (r) => formatDurationShort(r.breakTimeMinutes) },
    { key: "productivity", label: "Productivity %", render: (r) => <ProgressBar percent={r.productivityPercentage} /> },
  ];

  return (
    <div className="p-6">
      <ReportPageHeader title="Productivity Report">
        <TeamEmployeeFilter value={selection} onChange={setSelection} />
        <DateRangeFilter mode="range" value={range} onChange={setRange} />
        <AdvanceFilterPanel
          fields={[{ key: "minProductivity", label: "Min Productivity %", type: "number", placeholder: "e.g. 50" }]}
          values={advance}
          onChange={setAdvance}
        />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <ReportTable columns={columns} rows={rows} emptyMessage="No data" />
        )}
      </div>
    </div>
  );
}
