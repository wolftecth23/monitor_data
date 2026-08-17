import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";

// <img> tags can't set an Authorization header, so the file route also accepts ?token=
async function authenticateAdminOrQueryToken(request: FastifyRequest, reply: FastifyReply) {
  const { token } = request.query as { token?: string };
  if (token) {
    try {
      request.user = request.server.jwt.verify(token);
      return;
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  }
  return authenticateAdmin(request, reply);
}

export async function screenshotRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: authenticateAdmin }, async (request) => {
    const { employeeId, date } = request.query as { employeeId?: string; date?: string };
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (date) {
      where.capturedAt = {
        gte: new Date(`${date}T00:00:00.000Z`),
        lt: new Date(`${date}T23:59:59.999Z`),
      };
    }
    return prisma.screenshot.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      select: { id: true, employeeId: true, deviceId: true, appName: true, windowTitle: true, capturedAt: true, flagged: true },
    });
  });

  app.get("/:id/file", { preHandler: authenticateAdminOrQueryToken }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const screenshot = await prisma.screenshot.findUnique({ where: { id } });
    if (!screenshot || !fs.existsSync(screenshot.filePath)) {
      return reply.code(404).send({ error: "Screenshot not found" });
    }
    reply.type("image/jpeg");
    return reply.send(fs.createReadStream(screenshot.filePath));
  });

  app.patch("/:id/flag", { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { flagged } = request.body as { flagged: boolean };
    const screenshot = await prisma.screenshot.update({ where: { id }, data: { flagged } });
    return screenshot;
  });
}
