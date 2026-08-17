import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";
import { env } from "../lib/env.js";

const AGENT_BUILDS_DIR = path.join(process.cwd(), "agent-builds");

// macOS needs a build produced on real Apple hardware (Xcode has no
// cross-compile path) and staged the same way before its download can work.
const SUPPORTED_PLATFORMS = ["windows", "linux"] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

// The main executable within each platform's build directory — needs the
// Unix executable bit forced when zipping, since NTFS (this server's disk)
// can't actually store it, so whatever the file's mode looks like on disk
// here is meaningless for how it needs to land on a real Linux machine.
const ENTRY_POINT: Record<Platform, string | null> = {
  windows: null,
  linux: "monitor_agent",
};

function isSupportedPlatform(value: string): value is Platform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(value);
}

// <a href> downloads can't set an Authorization header, so this also
// accepts ?token=, same pattern as the screenshot file route.
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

export async function installerRoutes(app: FastifyInstance) {
  app.get("/platforms", { preHandler: authenticateAdmin }, async () => {
    return {
      platforms: ["windows", "macos", "linux"].map((platform) => ({
        platform,
        available: isSupportedPlatform(platform) && fs.existsSync(path.join(AGENT_BUILDS_DIR, platform)),
      })),
    };
  });

  app.get(
    "/employees/:id/installer/:platform",
    { preHandler: authenticateAdminOrQueryToken },
    async (request, reply) => {
      const { id, platform } = request.params as { id: string; platform: string };

      if (!isSupportedPlatform(platform)) {
        return reply.code(404).send({
          error: `No installer available for "${platform}" yet. macOS needs to be built on real Apple hardware first.`,
        });
      }

      const buildDir = path.join(AGENT_BUILDS_DIR, platform);
      if (!fs.existsSync(buildDir)) {
        return reply.code(404).send({ error: `${platform} build has not been staged on the server yet.` });
      }

      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) return reply.code(404).send({ error: "Employee not found" });

      const config = JSON.stringify(
        { backendUrl: env.publicBackendUrl, installToken: employee.installToken },
        null,
        2
      );

      const fileName = `monitor-agent-${employee.firstName}-${employee.lastName}-${platform}.zip`.replace(/\s+/g, "-");
      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="${fileName}"`);

      const archive = archiver("zip", { zlib: { level: 9 } });
      const entryPoint = ENTRY_POINT[platform];
      archive.directory(buildDir, false, (entry) => {
        if (entryPoint && entry.name === entryPoint) {
          entry.mode = 0o755;
        }
        return entry;
      });
      archive.append(config, { name: "config.json" });
      archive.finalize();

      return reply.send(archive);
    }
  );
}
