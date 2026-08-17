import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface Team {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
}

export interface TeamEmployeeSelection {
  teamId?: string;
  employeeId?: string;
}

export function TeamEmployeeFilter({
  value,
  onChange,
}: {
  value: TeamEmployeeSelection;
  onChange: (next: TeamEmployeeSelection) => void;
}) {
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => (await api.get("/teams")).data,
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });

  const grouped = new Map<string | null, Employee[]>();
  for (const e of employees ?? []) {
    const key = e.teamId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(e);
  }

  const selected = value.employeeId ?? (value.teamId ? `team:${value.teamId}` : "");

  return (
    <select
      className="rounded-md border px-3 py-1.5 text-sm min-w-[220px]"
      value={selected}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return onChange({});
        if (v.startsWith("team:")) return onChange({ teamId: v.slice(5) });
        return onChange({ employeeId: v });
      }}
    >
      <option value="">All Teams &amp; Employees</option>
      {teams?.map((team) => (
        <optgroup key={team.id} label={team.name}>
          <option value={`team:${team.id}`}>All in {team.name}</option>
          {(grouped.get(team.id) ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </optgroup>
      ))}
      {(grouped.get(null) ?? []).length > 0 && (
        <optgroup label="No Team">
          {(grouped.get(null) ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.firstName} {e.lastName}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
