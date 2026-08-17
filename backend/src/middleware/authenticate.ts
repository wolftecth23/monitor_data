import type { FastifyReply, FastifyRequest } from "fastify";

export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
}

// Verifies a device request using the per-employee install token (agent -> backend).
export async function authenticateDevice(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers["x-install-token"];
  if (!token || typeof token !== "string") {
    reply.code(401).send({ error: "Missing install token" });
    return;
  }
  (request as any).installToken = token;
}
