import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { TeamEmployeeFilter, type TeamEmployeeSelection } from "../../components/reports/TeamEmployeeFilter";
import { MonthCalendarGrid } from "../../components/reports/MonthCalendarGrid";
import { Pagination } from "../../components/reports/Pagination";
import { currentMonthStr, formatClock } from "../../lib/reportUtils";

interface Cell {
  day: number;
  in: string | null;
  out: string | null;
  isWeeklyOff: boolean;
}

export function MonthlyInOut() {
  const [selection, setSelection] = useState<TeamEmployeeSelection>({});
  const [month, setMonth] = useState(currentMonthStr());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data, isLoading } = useQuery({
    queryKey: ["report-attendance-in-out", selection, month, page, pageSize],
    queryFn: async () => (await reportsAPI.getMonthlyInOut({ ...selection, month, page, pageSize })).data,
  });

  const employees = (data?.employees ?? []).map((emp: any) => ({
    employeeId: emp.employeeId,
    name: emp.name,
    cells: emp.cells,
  }));

  return (
    <div className="p-6">
      <ReportPageHeader title="Monthly In-Out Report">
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
              renderCell={(cell) =>
                cell.isWeeklyOff ? (
                  <span className="text-[10px] text-gray-400">Weekly off</span>
                ) : cell.in || cell.out ? (
                  <span className="text-[10px] text-orange-600 whitespace-nowrap">
                    {formatClock(cell.in)}
                    <br />
                    {formatClock(cell.out)}
                  </span>
                ) : (
                  <span className="text-gray-300">-</span>
                )
              }
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
