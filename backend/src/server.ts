import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { Server } from "socket.io";
import { env } from "./lib/env.js";
import { registerRoutes } from "./routes/index.js";
import { setupSockets } from "./sockets/index.js";
import { runInactivityCheck } from "./lib/alertEngine.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  await app.register(jwt, { secret: env.jwtSecret });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  await registerRoutes(app);

  app.get("/health", async () => ({ ok: true }));

  await app.ready();

  const io = new Server(app.server, {
    cors: { origin: env.corsOrigin, credentials: true },
  });
  setupSockets(io);

  setInterval(() => {
    runInactivityCheck().catch((err) => app.log.error(err, "inactivity check failed"));
  }, 60_000);

  await app.listen({ port: env.port, host: "0.0.0.0" });
  app.log.info(`Monitor backend listening on port ${env.port}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
