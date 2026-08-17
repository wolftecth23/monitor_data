import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid credentials payload" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: "12h" }
    );

    return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });

  app.get("/me", { preHandler: authenticateAdmin }, async (request) => {
    const { sub } = request.user as { sub: string };
    const user = await prisma.adminUser.findUnique({ where: { id: sub } });
    if (!user) return { user: null };
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role } };
  });
}
