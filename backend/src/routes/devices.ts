import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";

export async function deviceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateAdmin);

  app.get("/", async () => {
    const devices = await prisma.device.findMany({
      include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { lastSeenAt: "desc" },
    });

    const platformCounts: Record<string, number> = {};
    let online = 0;
    let offline = 0;
    for (const d of devices) {
      platformCounts[d.platform] = (platformCounts[d.platform] ?? 0) + 1;
      if (d.status === "online") online++;
      else offline++;
    }

    return {
      devices,
      summary: {
        totalDeviceProfiles: devices.length,
        online,
        offline,
        platforms: platformCounts,
      },
    };
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const device = await prisma.device.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!device) return reply.code(404).send({ error: "Device not found" });
    return device;
  });
}
