import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { ReportTable, type Column } from "../../components/reports/ReportTable";
import { Pagination } from "../../components/reports/Pagination";
import { StatusBadge } from "../../components/reports/StatusBadge";
import { formatClock, formatDurationHMS, formatDurationShort, todayStr } from "../../lib/reportUtils";

interface Row {
  employeeId: string;
  name: string;
  shiftLabel: string;
  arrivalStatus: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  punchInLocation: string | null;
  punchOutLocation: string | null;
  departureStatus: string | null;
  workingTimeMinutes: number;
  onlineTimeMinutes: number;
  remark: string;
}

export function DailyAttendance() {
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [date, setDate] = useState(todayStr());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data, isLoading } = useQuery({
    queryKey: ["report-attendance-daily", selection, date, page, pageSize],
    queryFn: async () => (await reportsAPI.getDailyAttendance({ ...selection, date, page, pageSize })).data,
  });

  const columns: Column<Row>[] = [
    { key: "name", label: "Employee", render: (r) => r.name },
    { key: "shift", label: "Shift", render: (r) => r.shiftLabel },
    { key: "arrival", label: "Arrival", align: "center", render: (r) => <StatusBadge label={r.arrivalStatus} /> },
    { key: "in", label: "In", align: "center", render: (r) => formatClock(r.checkInTime) },
    { key: "out", label: "Out", align: "center", render: (r) => formatClock(r.checkOutTime) },
    { key: "pinLoc", label: "Punch In Location", align: "center", render: (r) => r.punchInLocation ?? "-" },
    { key: "poutLoc", label: "Punch Out Location", align: "center", render: (r) => r.punchOutLocation ?? "-" },
    { key: "departure", label: "Departure", align: "center", render: (r) => <StatusBadge label={r.departureStatus} /> },
    { key: "working", label: "Working Time", align: "center", render: (r) => formatDurationHMS(r.workingTimeMinutes) },
    { key: "online", label: "Online Time", align: "center", render: (r) => formatDurationShort(r.onlineTimeMinutes) },
    { key: "remark", label: "Remark", align: "center", render: (r) => <StatusBadge label={r.remark} /> },
  ];

  return (
    <div className="p-6">
      <ReportPageHeader title="Daily Attendance Report">
        <TeamEmployeeFilter value={selection} onChange={(v) => (setPage(1), setSelection(v))} />
        <DateRangeFilter mode="single" value={date} onChange={(v) => (setPage(1), setDate(v))} />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            <ReportTable columns={columns} rows={data?.rows ?? []} emptyMessage="No data" />
            <Pagination
              total={data?.total ?? 0}
              page={data?.page ?? page}
              pageSize={data?.pageSize ?? pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => (setPage(1), setPageSize(s))}
              itemLabel="Employees"
            />
          </>
        )}
      </div>
    </div>
  );
}
