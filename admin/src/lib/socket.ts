import { io, type Socket } from "socket.io-client";
import { API_URL } from "./api";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const token = localStorage.getItem("monitor_token") ?? "";
  socket = io(API_URL, { auth: { role: "admin", token }, autoConnect: true });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
