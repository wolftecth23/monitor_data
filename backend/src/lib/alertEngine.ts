import { prisma } from "./prisma.js";
import { sendAlertEmail } from "./mailer.js";

const INDIVIDUAL_SUPPRESSION_MS = 2 * 60 * 60 * 1000; // 2h
const SUMMARY_INTERVAL_MS = 30 * 60 * 1000; // 30m
const URL_APP_SUPPRESSION_MS = 10 * 60 * 1000; // 10m, avoids one alert per page load

// key: `${ruleId}:${employeeId ?? "summary"}` -> last triggered timestamp
const lastTriggered = new Map<string, number>();

function suppressed(key: string, windowMs: number): boolean {
  const last = lastTriggered.get(key);
  return last !== undefined && Date.now() - last < windowMs;
}

async function fireAlert(ruleId: string, employeeId: string | null, description: string, recipients: string[]) {
  await prisma.alertLog.create({ data: { alertRuleId: ruleId, employeeId, description } });
  if (recipients.length) {
    await sendAlertEmail(recipients, "Monitor Alert", description);
  }
}

// Called whenever the agent reports an app/URL activity event.
export async function evaluateActivityEvent(params: {
  employeeId: string;
  teamId: string | null;
  appName?: string | null;
  url?: string | null;
}) {
  const { employeeId, teamId, appName, url } = params;
  if (!appName && !url) return;

  const rules = await prisma.alertRule.findMany({
    where: { type: { in: ["application", "url"] } },
    include: { teams: true },
  });

  for (const rule of rules) {
    const scoped = rule.teams.length === 0 || (teamId && rule.teams.some((t) => t.teamId === teamId));
    if (!scoped) continue;

    const config = rule.config as { apps?: string[]; urls?: string[] };
    let matched: string | null = null;

    if (rule.type === "application" && appName && config.apps?.some((a) => appName.toLowerCase().includes(a.toLowerCase()))) {
      matched = appName;
    }
    if (rule.type === "url" && url && config.urls?.some((u) => url.includes(u.replace(/^https?:\/\//, "").replace(/\/$/, "")))) {
      matched = url;
    }
    if (!matched) continue;

    const key = `${rule.id}:${employeeId}`;
    if (suppressed(key, URL_APP_SUPPRESSION_MS)) continue;
    lastTriggered.set(key, Date.now());

    const label = rule.type === "url" ? `URL ${matched} was visited by the user` : `Application ${matched} was used by the user`;
    await fireAlert(rule.id, employeeId, label, rule.recipients);
  }
}

// Polled periodically to detect employees who have gone idle past their team's threshold.
export async function runInactivityCheck() {
  const rules = await prisma.alertRule.findMany({
    where: { type: "inactivity" },
    include: { teams: true },
  });
  if (rules.length === 0) return;

  const now = Date.now();
  const devices = await prisma.device.findMany({
    where: { status: "online" },
    include: { employee: { include: { team: { include: { trackingSettings: true } } } } },
  });

  for (const rule of rules) {
    const config = rule.config as { thresholdMinutes?: number };
    const thresholdMs = (config.thresholdMinutes ?? 30) * 60 * 1000;

    const inactiveEmployees: string[] = [];

    for (const device of devices) {
      const employee = device.employee;
      const teamId = employee.teamId;
      const scoped = rule.teams.length === 0 || (teamId && rule.teams.some((t) => t.teamId === teamId));
      if (!scoped || !device.lastSeenAt) continue;

      const idleMs = now - device.lastSeenAt.getTime();
      if (idleMs < thresholdMs) continue;

      if (rule.deliveryMode === "individual") {
        const key = `${rule.id}:${employee.id}`;
        if (suppressed(key, INDIVIDUAL_SUPPRESSION_MS)) continue;
        lastTriggered.set(key, now);
        await fireAlert(rule.id, employee.id, `Inactivity Alert for user ${employee.firstName} ${employee.lastName}`, rule.recipients);
      } else {
        inactiveEmployees.push(`${employee.firstName} ${employee.lastName}`);
      }
    }

    if (rule.deliveryMode === "summary" && inactiveEmployees.length > 0) {
      const key = `${rule.id}:summary`;
      if (suppressed(key, SUMMARY_INTERVAL_MS)) continue;
      lastTriggered.set(key, now);
      await fireAlert(rule.id, null, `Inactivity Alert for multiple Users under rule ${rule.name}: ${inactiveEmployees.join(", ")}`, rule.recipients);
    }
  }
}
