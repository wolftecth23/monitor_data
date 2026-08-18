import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import { prisma } from "../lib/prisma.js";
import { authenticateAdmin } from "../middleware/authenticate.js";
import { env } from "../lib/env.js";

const AGENT_BUILDS_DIR = path.join(process.cwd(), "agent-builds");

// macOS builds must be produced on real Apple hardware (Xcode has no
// cross-compile path) and staged into agent-builds/macos/ the same way the
// other platforms are before its download will work.
const SUPPORTED_PLATFORMS = ["windows", "linux", "macos"] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

// The main executable within each platform's build directory — needs the
// Unix executable bit forced when zipping, since NTFS (this server's disk)
// can't actually store it, so whatever the file's mode looks like on disk
// here is meaningless for how it needs to land on a real Linux/macOS machine.
// macOS's is nested inside the .app bundle produced by `flutter build macos`
// (bundle name comes from PRODUCT_NAME in macos/Runner/Configs/AppInfo.xcconfig).
const ENTRY_POINT: Record<Platform, string | null> = {
  windows: null,
  linux: "monitor_agent",
  macos: "monitor_agent.app/Contents/MacOS/monitor_agent",
};

// Where each platform's agent looks for config.json next to its own
// executable (agent/lib/config.dart's loadRuntimeConfig). Flat for
// Windows/Linux; inside the .app bundle's MacOS folder for macOS, since
// that's where Platform.resolvedExecutable actually resolves to there.
const CONFIG_ENTRY_NAME: Record<Platform, string> = {
  windows: "config.json",
  linux: "config.json",
  macos: "monitor_agent.app/Contents/MacOS/config.json",
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
        return reply.code(404).send({ error: `No installer available for "${platform}" yet.` });
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
      archive.append(config, { name: CONFIG_ENTRY_NAME[platform] });
      archive.finalize();

      return reply.send(archive);
    }
  );
}
