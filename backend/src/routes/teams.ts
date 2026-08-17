import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";

const teamSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
});

const trackingSettingsSchema = z.object({
  trackingEnabled: z.boolean().optional(),
  livestreamEnabled: z.boolean().optional(),
  captureScreenshots: z.boolean().optional(),
  screenshotFrequencySec: z.number().int().positive().optional(),
  appUrlTracking: z.boolean().optional(),
  keyboardMouseTracking: z.boolean().optional(),
  idleTimeoutSec: z.number().int().positive().optional(),
  activeThresholdSec: z.number().int().positive().optional(),
});

export async function teamRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateAdmin);

  app.get("/", async () => {
    return prisma.team.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    });
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        employees: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
        trackingSettings: true,
      },
    });
    if (!team) return reply.code(404).send({ error: "Team not found" });
    return team;
  });

  app.post("/", async (request, reply) => {
    const parsed = teamSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const team = await prisma.team.create({
      data: {
        ...parsed.data,
        trackingSettings: { create: {} },
      },
    });
    return reply.code(201).send(team);
  });

  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = teamSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const team = await prisma.team.update({ where: { id }, data: parsed.data });
    return team;
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.team.delete({ where: { id } });
    return reply.code(204).send();
  });

  // Tracking settings for a team
  app.get("/:id/tracking-settings", async (request, reply) => {
    const { id } = request.params as { id: string };
    let settings = await prisma.trackingSettings.findUnique({ where: { teamId: id } });
    if (!settings) {
      settings = await prisma.trackingSettings.create({ data: { teamId: id } });
    }
    return settings;
  });

  app.put("/:id/tracking-settings", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = trackingSettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const settings = await prisma.trackingSettings.upsert({
      where: { teamId: id },
      create: { teamId: id, ...parsed.data },
      update: parsed.data,
    });
    return settings;
  });
}
