import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { ReportTable, type Column } from "../../components/reports/ReportTable";
import { Pagination } from "../../components/reports/Pagination";
import { StatusBadge } from "../../components/reports/StatusBadge";
import { daysAgoStr, formatDurationShort, todayStr } from "../../lib/reportUtils";

type Tab = "summary" | "datewise" | "individual";

interface GroupRow {
  employeeId: string;
  employee: string;
  label: string;
  type: "APP" | "URL";
  day?: string;
  durationMinutes: number;
  mappingStatus: string;
}

interface IndividualRow {
  employeeId: string;
  employee: string;
  application: string | null;
  url: string | null;
  title: string | null;
  durationMinutes: number;
  mappingStatus: string;
  activeTimeMinutes: number;
  idleTimeMinutes: number;
  keyPresses: number | null;
  mouseClicks: number | null;
  systemStatus: string;
}

export function Logs() {
  const [tab, setTab] = useState<Tab>("individual");
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [range, setRange] = useState({ startDate: daysAgoStr(1), endDate: todayStr() });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data, isLoading } = useQuery({
    queryKey: ["report-logs", tab, selection, range, page, pageSize],
    queryFn: async () => (await reportsAPI.getLogs({ ...selection, ...range, view: tab, page, pageSize })).data,
  });

  const groupColumns: Column<GroupRow>[] = [
    { key: "employee", label: "Employee", render: (r) => r.employee },
    { key: "label", label: "Application / URL", render: (r) => r.label },
    { key: "type", label: "Type", align: "center", render: (r) => <StatusBadge label={r.type} /> },
    ...(tab === "datewise" ? [{ key: "day", label: "Date", align: "center" as const, render: (r: GroupRow) => r.day }] : []),
    { key: "duration", label: "Duration", align: "center", render: (r) => formatDurationShort(r.durationMinutes) },
    { key: "mapping", label: "Mapping status", align: "center", render: (r) => <StatusBadge label={r.mappingStatus} /> },
  ];

  const individualColumns: Column<IndividualRow>[] = [
    { key: "employee", label: "Employee", render: (r) => r.employee },
    { key: "application", label: "Application", render: (r) => r.application ?? "-" },
    { key: "url", label: "URL", render: (r) => r.url ?? "-" },
    { key: "title", label: "Title", render: (r) => <span className="max-w-[220px] inline-block truncate align-middle">{r.title ?? "-"}</span> },
    { key: "duration", label: "Duration", align: "center", render: (r) => formatDurationShort(r.durationMinutes) },
    { key: "mapping", label: "Mapping status", align: "center", render: (r) => <StatusBadge label={r.mappingStatus} /> },
    { key: "active", label: "Active time", align: "center", render: (r) => formatDurationShort(r.activeTimeMinutes) },
    { key: "idle", label: "Idle time", align: "center", render: (r) => formatDurationShort(r.idleTimeMinutes) },
    { key: "keys", label: "Key presses", align: "center", render: (r) => r.keyPresses ?? "-" },
    { key: "mouse", label: "Mouse clicks", align: "center", render: (r) => r.mouseClicks ?? "-" },
    { key: "system", label: "System status", align: "center", render: (r) => <StatusBadge label={r.systemStatus} /> },
  ];

  return (
    <div className="p-6">
      <ReportPageHeader title="Logs Report">
        <TeamEmployeeFilter value={selection} onChange={(v) => (setPage(1), setSelection(v))} />
        <DateRangeFilter mode="range" value={range} onChange={(v) => (setPage(1), setRange(v))} />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex gap-4 border-b px-4">
          {(["summary", "datewise", "individual"] as const).map((t) => (
            <button
              key={t}
              onClick={() => (setPage(1), setTab(t))}
              className={`py-3 text-sm capitalize ${tab === t ? "border-b-2 border-brand text-brand font-medium" : "text-gray-500"}`}
            >
              {t === "individual" ? "Individual Log" : t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : tab === "individual" ? (
          <ReportTable columns={individualColumns} rows={data?.rows ?? []} emptyMessage="No data" />
        ) : (
          <ReportTable columns={groupColumns} rows={data?.rows ?? []} emptyMessage="No data" />
        )}
        <Pagination
          total={data?.total ?? 0}
          page={data?.page ?? page}
          pageSize={data?.pageSize ?? pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => (setPage(1), setPageSize(s))}
          itemLabel="Logs"
        />
      </div>
    </div>
  );
}
