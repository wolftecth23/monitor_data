import { prisma } from "./prisma.js";

// Attendance has no stored "session" row — arrival/departure/working-time are
// derived by aggregating ActivityEvent per employee per day. Day boundaries
// and shift-time comparisons are done in UTC throughout for consistency;
// this repo doesn't handle per-employee timezones anywhere else either.

export const BREAK_THRESHOLD_MINUTES = 15;

export type EventRow = {
  employeeId: string;
  deviceId: string;
  appName: string | null;
  windowTitle: string | null;
  url: string | null;
  isIdle: boolean;
  startedAt: Date;
  endedAt: Date | null;
  category: string | null;
  isProductive: boolean | null;
};

export async function resolveEmployeeIds(teamId?: string, employeeId?: string): Promise<string[]> {
  if (employeeId) return [employeeId];
  const employees = await prisma.employee.findMany({
    where: teamId ? { teamId } : {},
    select: { id: true },
  });
  return employees.map((e) => e.id);
}

export async function fetchActivityEvents(employeeIds: string[], start: Date, end: Date): Promise<EventRow[]> {
  if (employeeIds.length === 0) return [];
  return prisma.activityEvent.findMany({
    where: { employeeId: { in: employeeIds }, startedAt: { gte: start, lt: end } },
    select: {
      employeeId: true,
      deviceId: true,
      appName: true,
      windowTitle: true,
      url: true,
      isIdle: true,
      startedAt: true,
      endedAt: true,
      category: true,
      isProductive: true,
    },
    orderBy: { startedAt: "asc" },
  });
}

export function durationMinutes(row: { startedAt: Date; endedAt: Date | null }): number {
  const end = row.endedAt ?? new Date();
  return Math.max(0, (end.getTime() - row.startedAt.getTime()) / 60000);
}

export function dayKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayOfMonthUTC(date: Date): number {
  return date.getUTCDate();
}

export function groupByEmployee<T extends { employeeId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.employeeId);
    if (list) list.push(row);
    else map.set(row.employeeId, [row]);
  }
  return map;
}

export function groupByEmployeeAndDay(rows: EventRow[]): Map<string, Map<string, EventRow[]>> {
  const map = new Map<string, Map<string, EventRow[]>>();
  for (const row of rows) {
    let byDay = map.get(row.employeeId);
    if (!byDay) {
      byDay = new Map();
      map.set(row.employeeId, byDay);
    }
    const key = dayKeyUTC(row.startedAt);
    const list = byDay.get(key);
    if (list) list.push(row);
    else byDay.set(key, [row]);
  }
  return map;
}

export async function getDefaultShift() {
  return prisma.shift.findFirst({ where: { isDefault: true } });
}

export async function getDefaultLocation() {
  return prisma.location.findFirst({ where: { isDefault: true } });
}

export function shiftBoundaryMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function computeArrivalStatus(arrival: Date, shift: { startTime: string; graceMinutes: number }): "on-time" | "late" {
  const mins = arrival.getUTCHours() * 60 + arrival.getUTCMinutes();
  return mins <= shiftBoundaryMinutes(shift.startTime) + shift.graceMinutes ? "on-time" : "late";
}

export function computeDepartureStatus(departure: Date, shift: { endTime: string }): "on-time" | "early" {
  const mins = departure.getUTCHours() * 60 + departure.getUTCMinutes();
  return mins >= shiftBoundaryMinutes(shift.endTime) ? "on-time" : "early";
}

export function shiftDurationMinutes(shift: { startTime: string; endTime: string }): number {
  return shiftBoundaryMinutes(shift.endTime) - shiftBoundaryMinutes(shift.startTime);
}

export function shiftLabel(shift: { name: string; startTime: string; endTime: string } | null): string {
  if (!shift) return "-";
  return `${shift.name} (${shift.startTime}-${shift.endTime})`;
}

// Working/idle/break split for a single employee-day's events.
// "Break" = idle stretches at/above BREAK_THRESHOLD_MINUTES; anything idle
// but shorter is ordinary idle time. No explicit break start/stop capture
// exists, so this is a heuristic, not a precise figure.
export function splitDayTotals(events: EventRow[]) {
  let workingMinutes = 0;
  let idleMinutes = 0;
  let breakMinutes = 0;
  let productiveMinutes = 0;
  let unproductiveMinutes = 0;

  for (const e of events) {
    const mins = durationMinutes(e);
    if (e.isIdle) {
      if (mins >= BREAK_THRESHOLD_MINUTES) breakMinutes += mins;
      else idleMinutes += mins;
    } else {
      workingMinutes += mins;
      if (e.isProductive === true) productiveMinutes += mins;
      else if (e.isProductive === false) unproductiveMinutes += mins;
    }
  }

  return { workingMinutes, idleMinutes, breakMinutes, productiveMinutes, unproductiveMinutes };
}

export function arrivalAndDeparture(events: EventRow[]): { arrival: Date; departure: Date } {
  let arrival = events[0].startedAt;
  let departure = events[0].endedAt ?? events[0].startedAt;
  for (const e of events) {
    if (e.startedAt < arrival) arrival = e.startedAt;
    const end = e.endedAt ?? e.startedAt;
    if (end > departure) departure = end;
  }
  return { arrival, departure };
}

export function getDaysInMonthUTC(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

export function parseMonthParam(month?: string): { year: number; monthIndex0: number; start: Date; end: Date; daysInMonth: number } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let monthIndex0 = now.getUTCMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    year = Number(month.slice(0, 4));
    monthIndex0 = Number(month.slice(5, 7)) - 1;
  }
  const start = new Date(Date.UTC(year, monthIndex0, 1));
  const end = new Date(Date.UTC(year, monthIndex0 + 1, 1));
  return { year, monthIndex0, start, end, daysInMonth: getDaysInMonthUTC(year, monthIndex0) };
}

export function parseDateParam(date?: string): { start: Date; end: Date } {
  const d = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function parseDateRangeParams(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? new Date(`${endDate}T00:00:00.000Z`) : new Date();
  const endInclusive = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) + 24 * 60 * 60 * 1000);
  const start =
    startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ? new Date(`${startDate}T00:00:00.000Z`)
      : new Date(endInclusive.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start, end: endInclusive };
}

// Sunday-only weekly-off, hardcoded until per-employee weekly-off days exist.
export function isWeeklyOffUTC(date: Date): boolean {
  return date.getUTCDay() === 0;
}

export function paginate<T>(rows: T[], page = 1, pageSize = 15): { rows: T[]; total: number; page: number; pageSize: number } {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safePageSize;
  return { rows: rows.slice(start, start + safePageSize), total: rows.length, page: safePage, pageSize: safePageSize };
}

export function employeeName(e: { firstName: string; lastName: string }): string {
  return `${e.firstName} ${e.lastName}`;
}
