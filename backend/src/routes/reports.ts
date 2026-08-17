import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";
import {
  BREAK_THRESHOLD_MINUTES,
  arrivalAndDeparture,
  computeArrivalStatus,
  computeDepartureStatus,
  dayKeyUTC,
  durationMinutes,
  employeeName,
  fetchActivityEvents,
  getDaysInMonthUTC,
  getDefaultLocation,
  getDefaultShift,
  groupByEmployee,
  groupByEmployeeAndDay,
  isWeeklyOffUTC,
  paginate,
  parseDateParam,
  parseDateRangeParams,
  parseMonthParam,
  resolveEmployeeIds,
  shiftDurationMinutes,
  shiftLabel,
  splitDayTotals,
} from "../lib/reportAggregation.js";

type ReportQuery = {
  teamId?: string;
  employeeId?: string;
  date?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
  view?: string;
  page?: string;
  pageSize?: string;
};

export async function reportRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateAdmin);

  // ---------- USB Detection (trivial find, built first) ----------
  app.get("/usb-events", async (request) => {
    const { teamId, employeeId, startDate, endDate, page, pageSize } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseDateRangeParams(startDate, endDate);

    const events = await prisma.usbEvent.findMany({
      where: { employeeId: { in: employeeIds }, timestamp: { gte: start, lt: end } },
      include: { employee: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { timestamp: "desc" },
    });

    const rows = events.map((e) => ({
      timestamp: e.timestamp,
      eventType: e.eventType,
      title: `${e.deviceName} ${e.eventType}`,
      user: { name: employeeName(e.employee), email: e.employee.email },
    }));

    return { success: true, ...paginate(rows, Number(page) || 1, Number(pageSize) || 15) };
  });

  // ---------- Daily Attendance ----------
  app.get("/attendance/daily", async (request) => {
    const { teamId, employeeId, date, page, pageSize } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseDateParam(date);

    const [employees, events, defaultShift, defaultLocation] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        include: { shift: true },
        orderBy: { firstName: "asc" },
      }),
      fetchActivityEvents(employeeIds, start, end),
      getDefaultShift(),
      getDefaultLocation(),
    ]);
    const byEmployee = groupByEmployee(events);
    const locationName = defaultLocation?.name ?? "Default";

    const rows = employees.map((emp) => {
      const shift = emp.shift ?? defaultShift;
      const evs = byEmployee.get(emp.id) ?? [];
      if (evs.length === 0) {
        return {
          employeeId: emp.id,
          name: employeeName(emp),
          shiftLabel: shiftLabel(shift),
          arrivalStatus: null,
          checkInTime: null,
          checkOutTime: null,
          punchInLocation: null,
          punchOutLocation: null,
          departureStatus: null,
          workingTimeMinutes: 0,
          onlineTimeMinutes: 0,
          remark: "Absent",
        };
      }
      const { arrival, departure } = arrivalAndDeparture(evs);
      const { workingMinutes } = splitDayTotals(evs);
      const onlineMinutes = (departure.getTime() - arrival.getTime()) / 60000;
      const shiftMinutes = shift ? shiftDurationMinutes(shift) : null;
      const remark =
        shiftMinutes != null ? (workingMinutes >= shiftMinutes * 0.75 ? "Full day" : "Half day") : workingMinutes > 0 ? "Full day" : "Absent";

      return {
        employeeId: emp.id,
        name: employeeName(emp),
        shiftLabel: shiftLabel(shift),
        arrivalStatus: shift ? computeArrivalStatus(arrival, shift) : null,
        checkInTime: arrival,
        checkOutTime: departure,
        punchInLocation: locationName,
        punchOutLocation: locationName,
        departureStatus: shift ? computeDepartureStatus(departure, shift) : null,
        workingTimeMinutes: workingMinutes,
        onlineTimeMinutes: onlineMinutes,
        remark,
      };
    });

    return { success: true, date: dayKeyUTC(start), ...paginate(rows, Number(page) || 1, Number(pageSize) || 15) };
  });

  // ---------- Summary ----------
  app.get("/summary", async (request) => {
    const { teamId, employeeId, month } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseMonthParam(month);

    const [employees, events] = await Promise.all([
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, orderBy: { firstName: "asc" } }),
      fetchActivityEvents(employeeIds, start, end),
    ]);
    const byEmployee = groupByEmployeeAndDay(events);

    const rows = employees.map((emp) => {
      const byDay = byEmployee.get(emp.id);
      if (!byDay) {
        return {
          employeeId: emp.id,
          name: employeeName(emp),
          presentDays: 0,
          onlineTimeMinutes: 0,
          activeTimeMinutes: 0,
          productiveTimeMinutes: 0,
          productivityPercentage: 0,
        };
      }
      let onlineTimeMinutes = 0;
      let activeTimeMinutes = 0;
      let productiveTimeMinutes = 0;
      for (const dayEvents of byDay.values()) {
        const { arrival, departure } = arrivalAndDeparture(dayEvents);
        onlineTimeMinutes += (departure.getTime() - arrival.getTime()) / 60000;
        const { workingMinutes, productiveMinutes } = splitDayTotals(dayEvents);
        activeTimeMinutes += workingMinutes;
        productiveTimeMinutes += productiveMinutes;
      }
      return {
        employeeId: emp.id,
        name: employeeName(emp),
        presentDays: byDay.size,
        onlineTimeMinutes,
        activeTimeMinutes,
        productiveTimeMinutes,
        productivityPercentage: activeTimeMinutes > 0 ? (productiveTimeMinutes / activeTimeMinutes) * 100 : 0,
      };
    });

    return { success: true, month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`, rows, total: rows.length };
  });

  // ---------- Activity ----------
  app.get("/activity", async (request) => {
    const { teamId, employeeId, startDate, endDate } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseDateRangeParams(startDate, endDate);

    const [employees, events, inputRows] = await Promise.all([
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, orderBy: { firstName: "asc" } }),
      fetchActivityEvents(employeeIds, start, end),
      prisma.inputActivity.groupBy({
        by: ["employeeId"],
        where: { employeeId: { in: employeeIds }, periodStart: { gte: start, lt: end } },
        _sum: { keyCount: true, mouseClickCount: true },
      }),
    ]);
    const byEmployee = groupByEmployeeAndDay(events);
    const inputByEmployee = new Map(inputRows.map((r) => [r.employeeId, r._sum]));

    const rows = employees.map((emp) => {
      const byDay = byEmployee.get(emp.id);
      const input = inputByEmployee.get(emp.id);
      if (!byDay) {
        return {
          employeeId: emp.id,
          name: employeeName(emp),
          attendance: 0,
          onlineTimeMinutes: 0,
          activeTimeMinutes: 0,
          idleTimeMinutes: 0,
          breakTimeMinutes: 0,
          keyPresses: input?.keyCount ?? 0,
          mouseClicks: input?.mouseClickCount ?? 0,
          activityPercentage: 0,
        };
      }
      let onlineTimeMinutes = 0;
      let activeTimeMinutes = 0;
      let idleTimeMinutes = 0;
      let breakTimeMinutes = 0;
      for (const dayEvents of byDay.values()) {
        const { arrival, departure } = arrivalAndDeparture(dayEvents);
        onlineTimeMinutes += (departure.getTime() - arrival.getTime()) / 60000;
        const totals = splitDayTotals(dayEvents);
        activeTimeMinutes += totals.workingMinutes;
        idleTimeMinutes += totals.idleMinutes;
        breakTimeMinutes += totals.breakMinutes;
      }
      const denom = activeTimeMinutes + idleTimeMinutes;
      return {
        employeeId: emp.id,
        name: employeeName(emp),
        attendance: byDay.size,
        onlineTimeMinutes,
        activeTimeMinutes,
        idleTimeMinutes,
        breakTimeMinutes,
        keyPresses: input?.keyCount ?? 0,
        mouseClicks: input?.mouseClickCount ?? 0,
        activityPercentage: denom > 0 ? (activeTimeMinutes / denom) * 100 : 0,
      };
    });

    return { success: true, rows, total: rows.length };
  });

  // ---------- Productivity ----------
  app.get("/productivity", async (request) => {
    const { teamId, employeeId, startDate, endDate } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseDateRangeParams(startDate, endDate);

    const [employees, events] = await Promise.all([
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, orderBy: { firstName: "asc" } }),
      fetchActivityEvents(employeeIds, start, end),
    ]);
    const byEmployee = groupByEmployeeAndDay(events);

    const rows = employees.map((emp) => {
      const byDay = byEmployee.get(emp.id);
      if (!byDay) {
        return {
          employeeId: emp.id,
          name: employeeName(emp),
          attendance: 0,
          onlineTimeMinutes: 0,
          activeTimeMinutes: 0,
          idleTimeMinutes: 0,
          productiveTimeMinutes: 0,
          unproductiveTimeMinutes: 0,
          neutralTimeMinutes: 0,
          breakTimeMinutes: 0,
          productivityPercentage: 0,
        };
      }
      let onlineTimeMinutes = 0;
      let activeTimeMinutes = 0;
      let idleTimeMinutes = 0;
      let breakTimeMinutes = 0;
      let productiveTimeMinutes = 0;
      let unproductiveTimeMinutes = 0;
      for (const dayEvents of byDay.values()) {
        const { arrival, departure } = arrivalAndDeparture(dayEvents);
        onlineTimeMinutes += (departure.getTime() - arrival.getTime()) / 60000;
        const totals = splitDayTotals(dayEvents);
        activeTimeMinutes += totals.workingMinutes;
        idleTimeMinutes += totals.idleMinutes;
        breakTimeMinutes += totals.breakMinutes;
        productiveTimeMinutes += totals.productiveMinutes;
        unproductiveTimeMinutes += totals.unproductiveMinutes;
      }
      const neutralTimeMinutes = Math.max(activeTimeMinutes - productiveTimeMinutes - unproductiveTimeMinutes, 0);
      const denom = productiveTimeMinutes + unproductiveTimeMinutes;
      return {
        employeeId: emp.id,
        name: employeeName(emp),
        attendance: byDay.size,
        onlineTimeMinutes,
        activeTimeMinutes,
        idleTimeMinutes,
        productiveTimeMinutes,
        unproductiveTimeMinutes,
        neutralTimeMinutes,
        breakTimeMinutes,
        productivityPercentage: denom > 0 ? (productiveTimeMinutes / denom) * 100 : 0,
      };
    });

    return { success: true, rows, total: rows.length };
  });

  // ---------- Apps/URLs ----------
  app.get("/apps-urls", async (request) => {
    const { teamId, employeeId, startDate, endDate, view, page, pageSize } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseDateRangeParams(startDate, endDate);
    const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
    const employeeMap = new Map(employees.map((e) => [e.id, employeeName(e)]));
    const events = await fetchActivityEvents(employeeIds, start, end);

    const datewise = view === "datewise";
    type Key = string;
    const groups = new Map<Key, { employeeId: string; label: string; type: "APP" | "URL"; day?: string; totalMinutes: number; activeMinutes: number; visits: number }>();

    for (const e of events) {
      const type: "APP" | "URL" = e.url ? "URL" : "APP";
      const label = type === "URL" ? e.url! : e.appName ?? "Unknown";
      const day = datewise ? dayKeyUTC(e.startedAt) : undefined;
      const key = `${e.employeeId}|${label}|${day ?? ""}`;
      const mins = durationMinutes(e);
      const existing = groups.get(key);
      if (existing) {
        existing.totalMinutes += mins;
        if (!e.isIdle) existing.activeMinutes += mins;
        existing.visits += 1;
      } else {
        groups.set(key, {
          employeeId: e.employeeId,
          label,
          type,
          day,
          totalMinutes: mins,
          activeMinutes: e.isIdle ? 0 : mins,
          visits: 1,
        });
      }
    }

    const employeeTotals = new Map<string, number>();
    for (const g of groups.values()) {
      employeeTotals.set(g.employeeId, (employeeTotals.get(g.employeeId) ?? 0) + g.totalMinutes);
    }

    const rows = Array.from(groups.values())
      .map((g) => {
        const total = employeeTotals.get(g.employeeId) ?? 0;
        return {
          employeeId: g.employeeId,
          employee: employeeMap.get(g.employeeId) ?? "Unknown",
          label: g.label,
          type: g.type,
          day: g.day,
          usagePercent: total > 0 ? (g.totalMinutes / total) * 100 : 0,
          usageDurationMinutes: g.totalMinutes,
          activeDurationMinutes: g.activeMinutes,
        };
      })
      .sort((a, b) => b.usageDurationMinutes - a.usageDurationMinutes);

    return { success: true, view: datewise ? "datewise" : "summary", ...paginate(rows, Number(page) || 1, Number(pageSize) || 15) };
  });

  // ---------- Logs ----------
  app.get("/logs", async (request) => {
    const { teamId, employeeId, startDate, endDate, view, page, pageSize } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end } = parseDateRangeParams(startDate, endDate);

    if (view === "summary" || view === "datewise") {
      const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
      const employeeMap = new Map(employees.map((e) => [e.id, employeeName(e)]));
      const events = await fetchActivityEvents(employeeIds, start, end);
      const datewise = view === "datewise";

      type Group = { employeeId: string; label: string; type: "APP" | "URL"; day?: string; totalMinutes: number; productiveMinutes: number; unproductiveMinutes: number };
      const groups = new Map<string, Group>();
      for (const e of events) {
        const type: "APP" | "URL" = e.url ? "URL" : "APP";
        const label = type === "URL" ? e.url! : e.appName ?? "Unknown";
        const day = datewise ? dayKeyUTC(e.startedAt) : undefined;
        const key = `${e.employeeId}|${label}|${day ?? ""}`;
        const mins = durationMinutes(e);
        const existing = groups.get(key);
        if (existing) {
          existing.totalMinutes += mins;
          if (e.isProductive === true) existing.productiveMinutes += mins;
          if (e.isProductive === false) existing.unproductiveMinutes += mins;
        } else {
          groups.set(key, {
            employeeId: e.employeeId,
            label,
            type,
            day,
            totalMinutes: mins,
            productiveMinutes: e.isProductive === true ? mins : 0,
            unproductiveMinutes: e.isProductive === false ? mins : 0,
          });
        }
      }

      const rows = Array.from(groups.values()).map((g) => ({
        employeeId: g.employeeId,
        employee: employeeMap.get(g.employeeId) ?? "Unknown",
        label: g.label,
        type: g.type,
        day: g.day,
        durationMinutes: g.totalMinutes,
        mappingStatus: g.productiveMinutes >= g.unproductiveMinutes ? (g.productiveMinutes > 0 ? "PRODUCTIVE" : "NEUTRAL") : "UNPRODUCTIVE",
      }));

      return { success: true, view, ...paginate(rows, Number(page) || 1, Number(pageSize) || 15) };
    }

    // individual — flat, one row per ActivityEvent
    const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
    const employeeMap = new Map(employees.map((e) => [e.id, employeeName(e)]));
    const events = await fetchActivityEvents(employeeIds, start, end);
    const sorted = [...events].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const rows = sorted.map((e) => ({
      employeeId: e.employeeId,
      employee: employeeMap.get(e.employeeId) ?? "Unknown",
      application: e.url ? null : e.appName,
      url: e.url,
      title: e.windowTitle,
      durationMinutes: durationMinutes(e),
      mappingStatus: e.isProductive === true ? "PRODUCTIVE" : e.isProductive === false ? "UNPRODUCTIVE" : "NEUTRAL",
      activeTimeMinutes: e.isIdle ? 0 : durationMinutes(e),
      idleTimeMinutes: e.isIdle ? durationMinutes(e) : 0,
      // No per-record keyboard/mouse capture exists yet — InputActivity is
      // only aggregated per device per period, not tied to a single event.
      keyPresses: null,
      mouseClicks: null,
      systemStatus: e.isIdle ? "IDLE" : "ACTIVE",
    }));

    return { success: true, view: "individual", ...paginate(rows, Number(page) || 1, Number(pageSize) || 15) };
  });

  // ---------- Monthly Attendance (calendar grid) ----------
  app.get("/attendance/monthly", async (request) => {
    const { teamId, employeeId, month, page, pageSize } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end, daysInMonth } = parseMonthParam(month);

    const [employees, events] = await Promise.all([
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, orderBy: { firstName: "asc" } }),
      fetchActivityEvents(employeeIds, start, end),
    ]);
    const byEmployee = groupByEmployeeAndDay(events);

    const allRows = employees.map((emp) => {
      const byDay = byEmployee.get(emp.id);
      const cells = [];
      let totalPresent = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
        const key = dayKeyUTC(cellDate);
        const dayEvents = byDay?.get(key);
        if (!dayEvents) {
          cells.push({ day, workingTimeMinutes: 0, onlineTimeMinutes: 0, isWeeklyOff: isWeeklyOffUTC(cellDate) });
          continue;
        }
        const { arrival, departure } = arrivalAndDeparture(dayEvents);
        const { workingMinutes } = splitDayTotals(dayEvents);
        const onlineMinutes = (departure.getTime() - arrival.getTime()) / 60000;
        if (workingMinutes > 0) totalPresent += 1;
        cells.push({ day, workingTimeMinutes: workingMinutes, onlineTimeMinutes: onlineMinutes, isWeeklyOff: isWeeklyOffUTC(cellDate) });
      }
      return { employeeId: emp.id, name: employeeName(emp), cells, totalPresent };
    });

    const paginated = paginate(allRows, Number(page) || 1, Number(pageSize) || 15);
    return {
      success: true,
      month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      daysInMonth,
      employees: paginated.rows,
      total: paginated.total,
      page: paginated.page,
      pageSize: paginated.pageSize,
    };
  });

  // ---------- Monthly In-Out (calendar grid) ----------
  app.get("/attendance/monthly-in-out", async (request) => {
    const { teamId, employeeId, month, page, pageSize } = request.query as ReportQuery;
    const employeeIds = await resolveEmployeeIds(teamId, employeeId);
    const { start, end, daysInMonth } = parseMonthParam(month);

    const [employees, events] = await Promise.all([
      prisma.employee.findMany({ where: { id: { in: employeeIds } }, orderBy: { firstName: "asc" } }),
      fetchActivityEvents(employeeIds, start, end),
    ]);
    const byEmployee = groupByEmployeeAndDay(events);

    const allRows = employees.map((emp) => {
      const byDay = byEmployee.get(emp.id);
      const cells = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
        const key = dayKeyUTC(cellDate);
        const dayEvents = byDay?.get(key);
        if (!dayEvents) {
          cells.push({ day, in: null, out: null, isWeeklyOff: isWeeklyOffUTC(cellDate) });
          continue;
        }
        const { arrival, departure } = arrivalAndDeparture(dayEvents);
        cells.push({ day, in: arrival, out: departure, isWeeklyOff: isWeeklyOffUTC(cellDate) });
      }
      return { employeeId: emp.id, name: employeeName(emp), cells };
    });

    const paginated = paginate(allRows, Number(page) || 1, Number(pageSize) || 15);
    return {
      success: true,
      month: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      daysInMonth,
      employees: paginated.rows,
      total: paginated.total,
      page: paginated.page,
      pageSize: paginated.pageSize,
    };
  });
}

// Re-exported for potential reuse (e.g. a future settings endpoint to tweak
// the break-detection threshold without touching aggregation logic).
export { BREAK_THRESHOLD_MINUTES, getDaysInMonthUTC };
