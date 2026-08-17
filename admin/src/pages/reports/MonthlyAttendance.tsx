import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { MonthCalendarGrid } from "../../components/reports/MonthCalendarGrid";
import { Pagination } from "../../components/reports/Pagination";
import { currentMonthStr, formatDurationShort } from "../../lib/reportUtils";

type Metric = "workingTime" | "onlineTime";

interface Cell {
  day: number;
  workingTimeMinutes: number;
  onlineTimeMinutes: number;
  isWeeklyOff: boolean;
}

export function MonthlyAttendance() {
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [month, setMonth] = useState(currentMonthStr());
  const [metric, setMetric] = useState<Metric>("workingTime");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data, isLoading } = useQuery({
    queryKey: ["report-attendance-monthly", selection, month, page, pageSize],
    queryFn: async () => (await reportsAPI.getMonthlyAttendance({ ...selection, month, page, pageSize })).data,
  });

  const employees = (data?.employees ?? []).map((emp: any) => ({
    employeeId: emp.employeeId,
    name: emp.name,
    cells: emp.cells,
    trailingValue: emp.totalPresent,
  }));

  function cellColor(cell: Cell): string {
    const minutes = metric === "workingTime" ? cell.workingTimeMinutes : cell.onlineTimeMinutes;
    if (cell.isWeeklyOff) return "text-gray-400";
    if (minutes <= 0) return "bg-red-100 text-red-700 rounded px-1";
    if (minutes >= 8 * 60) return "bg-green-100 text-green-700 rounded px-1";
    return "bg-yellow-100 text-yellow-700 rounded px-1";
  }

  return (
    <div className="p-6">
      <ReportPageHeader title="Monthly Attendance Report">
        <TeamEmployeeFilter value={selection} onChange={(v) => (setPage(1), setSelection(v))} />
        <DateRangeFilter mode="month" value={month} onChange={(v) => (setPage(1), setMonth(v))} />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            <MonthCalendarGrid<Cell>
              daysInMonth={data?.daysInMonth ?? 30}
              employees={employees}
              trailingColumnLabel="Total Present"
              headerControls={
                <select
                  className="rounded-md border px-2 py-1 text-xs"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                >
                  <option value="workingTime">Working Time</option>
                  <option value="onlineTime">Online Time</option>
                </select>
              }
              renderCell={(cell) => (
                <span
                  className={`text-xs group-hover:relative ${cellColor(cell)}`}
                  title={
                    metric === "workingTime"
                      ? formatDurationShort(cell.workingTimeMinutes)
                      : formatDurationShort(cell.onlineTimeMinutes)
                  }
                >
                  {cell.isWeeklyOff
                    ? "Off"
                    : formatDurationShort(metric === "workingTime" ? cell.workingTimeMinutes : cell.onlineTimeMinutes)}
                </span>
              )}
            />
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
