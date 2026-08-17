import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";

const alertRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["inactivity", "application", "url"]),
  config: z.record(z.any()),
  deliveryMode: z.enum(["individual", "summary"]).optional(),
  recipients: z.array(z.string().email()).default([]),
  teamIds: z.array(z.string().uuid()).default([]),
});

export async function alertRuleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateAdmin);

  app.get("/", async () => {
    return prisma.alertRule.findMany({
      include: { teams: { include: { team: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

  app.post("/", async (request, reply) => {
    const parsed = alertRuleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const { teamIds, ...data } = parsed.data;
    const rule = await prisma.alertRule.create({
      data: { ...data, teams: { create: teamIds.map((teamId) => ({ teamId })) } },
      include: { teams: { include: { team: true } } },
    });
    return reply.code(201).send(rule);
  });

  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = alertRuleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const { teamIds, ...data } = parsed.data;

    if (teamIds) {
      await prisma.alertRuleTeam.deleteMany({ where: { alertRuleId: id } });
    }
    const rule = await prisma.alertRule.update({
      where: { id },
      data: {
        ...data,
        ...(teamIds ? { teams: { create: teamIds.map((teamId) => ({ teamId })) } } : {}),
      },
      include: { teams: { include: { team: true } } },
    });
    return rule;
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.alertRule.delete({ where: { id } });
    return reply.code(204).send();
  });
}

export async function alertLogRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateAdmin);

  app.get("/", async (request) => {
    const { date } = request.query as { date?: string };
    const where = date
      ? {
          triggeredAt: {
            gte: new Date(`${date}T00:00:00.000Z`),
            lt: new Date(`${date}T23:59:59.999Z`),
          },
        }
      : {};
    return prisma.alertLog.findMany({
      where,
      include: { alertRule: true, employee: { select: { firstName: true, lastName: true } } },
      orderBy: { triggeredAt: "desc" },
    });
  });
}
