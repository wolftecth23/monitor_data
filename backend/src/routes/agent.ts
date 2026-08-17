import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authenticateDevice } from "../middleware/authenticate.js";
import { saveScreenshot } from "../lib/storage.js";
import { evaluateActivityEvent } from "../lib/alertEngine.js";
import { classifyActivity } from "../lib/classify.js";

async function resolveEmployee(installToken: string) {
  return prisma.employee.findUnique({ where: { installToken }, include: { team: true } });
}

const activityEventSchema = z.object({
  hostname: z.string().min(1),
  appName: z.string().optional(),
  windowTitle: z.string().optional(),
  url: z.string().optional(),
  isIdle: z.boolean().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});

const inputActivitySchema = z.object({
  hostname: z.string().min(1),
  keyCount: z.number().int().min(0).default(0),
  mouseClickCount: z.number().int().min(0).default(0),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

const usbEventSchema = z.object({
  hostname: z.string().min(1),
  deviceName: z.string().optional(),
  vendorId: z.string().optional(),
  productId: z.string().optional(),
  eventType: z.enum(["connected", "disconnected"]),
  timestamp: z.string().datetime().optional(),
});

export async function agentRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticateDevice);

  // Agent calls this on boot and periodically to pick up frequency/idle-timeout changes.
  app.get("/settings", async (request, reply) => {
    const employee = await resolveEmployee((request as any).installToken);
    if (!employee) return reply.code(401).send({ error: "Unknown install token" });

    const settings = employee.teamId
      ? await prisma.trackingSettings.findUnique({ where: { teamId: employee.teamId } })
      : null;

    return {
      employeeId: employee.id,
      settings: settings ?? {
        trackingEnabled: true,
        livestreamEnabled: true,
        captureScreenshots: true,
        screenshotFrequencySec: 300,
        appUrlTracking: true,
        keyboardMouseTracking: true,
        idleTimeoutSec: 300,
        activeThresholdSec: 30,
      },
    };
  });

  app.post("/screenshots", async (request, reply) => {
    const employee = await resolveEmployee((request as any).installToken);
    if (!employee) return reply.code(401).send({ error: "Unknown install token" });

    const data = await request.file();
    if (!data) return reply.code(400).send({ error: "No file uploaded" });

    const hostname = (data.fields.hostname as any)?.value;
    const appName = (data.fields.appName as any)?.value;
    const windowTitle = (data.fields.windowTitle as any)?.value;
    if (!hostname) return reply.code(400).send({ error: "hostname field is required" });

    const device = await prisma.device.findUnique({
      where: { employeeId_hostname: { employeeId: employee.id, hostname } },
    });
    if (!device) return reply.code(404).send({ error: "Device not registered; connect via socket first" });

    const buffer = await data.toBuffer();
    const capturedAt = new Date();
    const fileName = `${capturedAt.getTime()}.jpg`;
    const filePath = await saveScreenshot(employee.id, capturedAt, fileName, buffer);

    const screenshot = await prisma.screenshot.create({
      data: { employeeId: employee.id, deviceId: device.id, filePath, appName, windowTitle, capturedAt },
    });

    return reply.code(201).send({ id: screenshot.id, capturedAt: screenshot.capturedAt });
  });

  app.post("/activity-events", async (request, reply) => {
    const employee = await resolveEmployee((request as any).installToken);
    if (!employee) return reply.code(401).send({ error: "Unknown install token" });

    const parsed = activityEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const { hostname, ...rest } = parsed.data;

    const device = await prisma.device.findUnique({
      where: { employeeId_hostname: { employeeId: employee.id, hostname } },
    });
    if (!device) return reply.code(404).send({ error: "Device not registered; connect via socket first" });

    const { category, isProductive } = classifyActivity(rest.appName, rest.url);

    await prisma.activityEvent.create({
      data: {
        employeeId: employee.id,
        deviceId: device.id,
        appName: rest.appName,
        windowTitle: rest.windowTitle,
        url: rest.url,
        isIdle: rest.isIdle ?? false,
        startedAt: new Date(rest.startedAt),
        endedAt: rest.endedAt ? new Date(rest.endedAt) : undefined,
        category,
        isProductive,
      },
    });

    await evaluateActivityEvent({
      employeeId: employee.id,
      teamId: employee.teamId,
      appName: rest.appName,
      url: rest.url,
    });

    return reply.code(201).send({ ok: true });
  });

  app.post("/input-activity", async (request, reply) => {
    const employee = await resolveEmployee((request as any).installToken);
    if (!employee) return reply.code(401).send({ error: "Unknown install token" });

    const parsed = inputActivitySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const { hostname, ...rest } = parsed.data;

    const device = await prisma.device.findUnique({
      where: { employeeId_hostname: { employeeId: employee.id, hostname } },
    });
    if (!device) return reply.code(404).send({ error: "Device not registered; connect via socket first" });

    await prisma.inputActivity.create({
      data: {
        employeeId: employee.id,
        deviceId: device.id,
        keyCount: rest.keyCount,
        mouseClickCount: rest.mouseClickCount,
        periodStart: new Date(rest.periodStart),
        periodEnd: new Date(rest.periodEnd),
      },
    });

    return reply.code(201).send({ ok: true });
  });

  app.post("/usb-events", async (request, reply) => {
    const employee = await resolveEmployee((request as any).installToken);
    if (!employee) return reply.code(401).send({ error: "Unknown install token" });

    const parsed = usbEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const { hostname, ...rest } = parsed.data;

    const device = await prisma.device.findUnique({
      where: { employeeId_hostname: { employeeId: employee.id, hostname } },
    });
    if (!device) return reply.code(404).send({ error: "Device not registered; connect via socket first" });

    await prisma.usbEvent.create({
      data: {
        employeeId: employee.id,
        deviceId: device.id,
        deviceName: rest.deviceName ?? "Unknown USB Device",
        vendorId: rest.vendorId,
        productId: rest.productId,
        eventType: rest.eventType,
        timestamp: rest.timestamp ? new Date(rest.timestamp) : undefined,
      },
    });

    return reply.code(201).send({ ok: true });
  });
}
