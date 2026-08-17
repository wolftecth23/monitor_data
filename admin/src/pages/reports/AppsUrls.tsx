import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { AdvanceFilterPanel } from "../../components/reports/AdvanceFilterPanel";
import { ReportTable, type Column } from "../../components/reports/ReportTable";
import { Pagination } from "../../components/reports/Pagination";
import { StatusBadge } from "../../components/reports/StatusBadge";
import { daysAgoStr, formatDurationShort, todayStr } from "../../lib/reportUtils";

interface Row {
  employeeId: string;
  employee: string;
  label: string;
  type: "APP" | "URL";
  day?: string;
  usagePercent: number;
  usageDurationMinutes: number;
  activeDurationMinutes: number;
}

export function AppsUrls() {
  const [tab, setTab] = useState<"summary" | "datewise">("summary");
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [range, setRange] = useState({ startDate: daysAgoStr(7), endDate: todayStr() });
  const [advance, setAdvance] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data, isLoading } = useQuery({
    queryKey: ["report-apps-urls", tab, selection, range, page, pageSize],
    queryFn: async () => (await reportsAPI.getAppsUrls({ ...selection, ...range, view: tab, page, pageSize })).data,
  });

  const search = (advance.search ?? "").toLowerCase();
  const rows: Row[] = (data?.rows ?? []).filter((r: Row) => !search || r.label.toLowerCase().includes(search));

  const columns: Column<Row>[] = [
    { key: "employee", label: "Employee", render: (r) => r.employee },
    { key: "label", label: "Apps/URLs", render: (r) => r.label },
    { key: "type", label: "Type", align: "center", render: (r) => <StatusBadge label={r.type} /> },
    ...(tab === "datewise" ? [{ key: "day", label: "Date", align: "center" as const, render: (r: Row) => r.day }] : []),
    { key: "usagePercent", label: "Usage %", align: "center", render: (r) => `${r.usagePercent.toFixed(1)}%` },
    { key: "usage", label: "Usage duration", align: "center", render: (r) => formatDurationShort(r.usageDurationMinutes) },
    { key: "active", label: "Active duration", align: "center", render: (r) => formatDurationShort(r.activeDurationMinutes) },
  ];

  return (
    <div className="p-6">
      <ReportPageHeader title="Apps/URLs Report">
        <TeamEmployeeFilter value={selection} onChange={(v) => (setPage(1), setSelection(v))} />
        <DateRangeFilter mode="range" value={range} onChange={(v) => (setPage(1), setRange(v))} />
        <AdvanceFilterPanel
          fields={[{ key: "search", label: "Search app/url", type: "text", placeholder: "e.g. chrome" }]}
          values={advance}
          onChange={setAdvance}
        />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex gap-4 border-b px-4">
          {(["summary", "datewise"] as const).map((t) => (
            <button
              key={t}
              onClick={() => (setPage(1), setTab(t))}
              className={`py-3 text-sm capitalize ${tab === t ? "border-b-2 border-brand text-brand font-medium" : "text-gray-500"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            <ReportTable columns={columns} rows={rows} emptyMessage="No data" />
            <Pagination
              total={data?.total ?? 0}
              page={data?.page ?? page}
              pageSize={data?.pageSize ?? pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => (setPage(1), setPageSize(s))}
              itemLabel="Rows"
            />
          </>
        )}
      </div>
    </div>
  );
}
