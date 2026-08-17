import type { ReactNode } from "react";

interface DayCell {
  day: number;
  isWeeklyOff: boolean;
}

interface EmployeeRow<Cell extends DayCell> {
  employeeId: string;
  name: string;
  cells: Cell[];
  trailingValue?: ReactNode;
}

export function MonthCalendarGrid<Cell extends DayCell>({
  daysInMonth,
  employees,
  renderCell,
  trailingColumnLabel,
  headerControls,
}: {
  daysInMonth: number;
  employees: EmployeeRow<Cell>[];
  renderCell: (cell: Cell) => ReactNode;
  trailingColumnLabel?: string;
  headerControls?: ReactNode;
}) {
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="sticky left-0 bg-gray-50 z-10 px-4 py-3 text-left font-semibold text-gray-700 min-w-[180px]">
              {headerControls ?? "Employee"}
            </th>
            {days.map((day) => (
              <th key={day} className="px-2 py-3 text-center font-medium text-gray-500 min-w-[64px]">
                {day}
              </th>
            ))}
            {trailingColumnLabel && (
              <th className="px-4 py-3 text-center font-semibold text-gray-700 min-w-[100px]">{trailingColumnLabel}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => (
            <tr key={emp.employeeId} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="sticky left-0 bg-white z-10 px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
              {emp.cells.map((cell) => (
                <td key={cell.day} className={`px-2 py-2 text-center group relative ${cell.isWeeklyOff ? "bg-gray-100" : ""}`}>
                  {renderCell(cell)}
                </td>
              ))}
              {trailingColumnLabel && <td className="px-4 py-2 text-center font-semibold">{emp.trailingValue}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {employees.length === 0 && <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No data</div>}
    </div>
  );
}
