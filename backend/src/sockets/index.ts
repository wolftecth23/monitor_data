import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";

interface DeviceAuth {
  role: "device";
  installToken: string;
  hostname: string;
  platform: string;
  ip?: string;
  appVersion?: string;
}

interface AdminAuth {
  role: "admin";
  token: string;
}

// employeeId -> current live device socket id
const liveDeviceSockets = new Map<string, string>();

export function setupSockets(io: Server) {
  io.use(async (socket, next) => {
    const auth = socket.handshake.auth as DeviceAuth | AdminAuth;
    if (auth?.role === "admin") {
      try {
        jwt.verify(auth.token, env.jwtSecret);
        socket.data.role = "admin";
        return next();
      } catch {
        return next(new Error("Invalid admin token"));
      }
    }
    if (auth?.role === "device") {
      const employee = await prisma.employee.findUnique({ where: { installToken: auth.installToken } });
      if (!employee) return next(new Error("Invalid install token"));
      socket.data.role = "device";
      socket.data.employeeId = employee.id;
      socket.data.hostname = auth.hostname;
      socket.data.platform = auth.platform;
      socket.data.ip = auth.ip ?? socket.handshake.address;
      socket.data.appVersion = auth.appVersion;
      return next();
    }
    return next(new Error("Missing role in socket auth"));
  });

  io.on("connection", (socket: Socket) => {
    if (socket.data.role === "admin") {
      socket.join("admins");
      registerAdminHandlers(io, socket);
      return;
    }

    if (socket.data.role === "device") {
      handleDeviceConnect(io, socket).catch((err) => console.error("[socket] device connect error", err));
    }
  });
}

async function handleDeviceConnect(io: Server, socket: Socket) {
  const { employeeId, hostname, platform, ip, appVersion } = socket.data;

  const device = await prisma.device.upsert({
    where: { employeeId_hostname: { employeeId, hostname } },
    create: { employeeId, hostname, platform, ip, appVersion, status: "online", lastSeenAt: new Date() },
    update: { status: "online", lastSeenAt: new Date(), ip, appVersion, platform },
  });

  socket.data.deviceId = device.id;
  socket.join(`employee:${employeeId}`);
  liveDeviceSockets.set(employeeId, socket.id);

  io.to("admins").emit("presence:update", { employeeId, deviceId: device.id, status: "online" });

  socket.on("activity:heartbeat", (payload: { appName?: string; windowTitle?: string; isIdle?: boolean }) => {
    io.to("admins").emit("activity:update", { employeeId, deviceId: device.id, ...payload });
  });

  // WebRTC signaling relay: device -> specific admin viewer socket
  socket.on("webrtc:offer", (payload: { targetSocketId: string; sdp: unknown }) => {
    io.to(payload.targetSocketId).emit("webrtc:offer", { from: socket.id, employeeId, sdp: payload.sdp });
  });
  socket.on("webrtc:ice-candidate", (payload: { targetSocketId: string; candidate: unknown }) => {
    io.to(payload.targetSocketId).emit("webrtc:ice-candidate", { from: socket.id, candidate: payload.candidate });
  });

  socket.on("disconnect", async () => {
    if (liveDeviceSockets.get(employeeId) === socket.id) {
      liveDeviceSockets.delete(employeeId);
    }
    await prisma.device.update({ where: { id: device.id }, data: { status: "offline", lastSeenAt: new Date() } });
    io.to("admins").emit("presence:update", { employeeId, deviceId: device.id, status: "offline" });
  });
}

function registerAdminHandlers(io: Server, socket: Socket) {
  socket.on("livestream:watch", (payload: { employeeId: string }) => {
    const deviceSocketId = liveDeviceSockets.get(payload.employeeId);
    if (!deviceSocketId) {
      socket.emit("livestream:unavailable", { employeeId: payload.employeeId });
      return;
    }
    io.to(deviceSocketId).emit("webrtc:viewer-join", { viewerSocketId: socket.id, employeeId: payload.employeeId });
  });

  socket.on("livestream:stop", (payload: { employeeId: string }) => {
    const deviceSocketId = liveDeviceSockets.get(payload.employeeId);
    if (deviceSocketId) {
      io.to(deviceSocketId).emit("webrtc:viewer-leave", { viewerSocketId: socket.id });
    }
  });

  // WebRTC signaling relay: admin -> specific device socket
  socket.on("webrtc:answer", (payload: { targetSocketId: string; sdp: unknown }) => {
    io.to(payload.targetSocketId).emit("webrtc:answer", { from: socket.id, sdp: payload.sdp });
  });
  socket.on("webrtc:ice-candidate", (payload: { targetSocketId: string; candidate: unknown }) => {
    io.to(payload.targetSocketId).emit("webrtc:ice-candidate", { from: socket.id, candidate: payload.candidate });
  });
}
