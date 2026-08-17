import type { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { roleRoutes } from "./roles.js";
import { teamRoutes } from "./teams.js";
import { employeeRoutes } from "./employees.js";
import { deviceRoutes } from "./devices.js";
import { screenshotRoutes } from "./screenshots.js";
import { reportRoutes } from "./reports.js";
import { alertRuleRoutes, alertLogRoutes } from "./alerts.js";
import { agentRoutes } from "./agent.js";
import { installerRoutes } from "./installers.js";

export async function registerRoutes(app: FastifyInstance) {
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(roleRoutes, { prefix: "/api/roles" });
  app.register(teamRoutes, { prefix: "/api/teams" });
  app.register(employeeRoutes, { prefix: "/api/employees" });
  app.register(deviceRoutes, { prefix: "/api/devices" });
  app.register(screenshotRoutes, { prefix: "/api/screenshots" });
  app.register(reportRoutes, { prefix: "/api/reports" });
  app.register(alertRuleRoutes, { prefix: "/api/alert-rules" });
  app.register(alertLogRoutes, { prefix: "/api/alert-logs" });
  app.register(agentRoutes, { prefix: "/api/agent" });
  app.register(installerRoutes, { prefix: "/api" });
}
