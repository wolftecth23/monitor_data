import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isAdmin: z.boolean().optional(),
});

export async function roleRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateAdmin);

  app.get("/", async () => {
    return prisma.role.findMany({ orderBy: { name: "asc" } });
  });

  app.post("/", async (request, reply) => {
    const parsed = roleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const role = await prisma.role.create({ data: parsed.data });
    return reply.code(201).send(role);
  });

  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = roleSchema.partial().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const role = await prisma.role.update({ where: { id }, data: parsed.data });
    return role;
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.role.delete({ where: { id } });
    return reply.code(204).send();
  });
}
