import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  devices: { id: string; platform: string }[];
}

interface Presence {
  status: "online" | "offline";
  appName?: string;
  windowTitle?: string;
}

const ICE_SERVERS: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export function Livestream() {
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });

  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [viewing, setViewing] = useState<Employee | null>(null);

  useEffect(() => {
    const socket = getSocket();

    function onPresence(payload: { employeeId: string; status: "online" | "offline" }) {
      setPresence((prev) => ({ ...prev, [payload.employeeId]: { ...prev[payload.employeeId], status: payload.status } }));
    }
    function onActivity(payload: { employeeId: string; appName?: string; windowTitle?: string }) {
      setPresence((prev) => ({
        ...prev,
        [payload.employeeId]: { ...prev[payload.employeeId], status: "online", appName: payload.appName, windowTitle: payload.windowTitle },
      }));
    }

    socket.on("presence:update", onPresence);
    socket.on("activity:update", onActivity);
    return () => {
      socket.off("presence:update", onPresence);
      socket.off("activity:update", onActivity);
    };
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Livestream</h1>

      <div className="grid grid-cols-4 gap-4">
        {employees?.map((e) => {
          const p = presence[e.id];
          const isOnline = p?.status === "online";
          return (
            <button
              key={e.id}
              onClick={() => isOnline && setViewing(e)}
              disabled={!isOnline}
              className={`text-left bg-white rounded-lg shadow p-4 space-y-2 ${isOnline ? "hover:shadow-md" : "opacity-60"}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="font-medium text-sm">
                  {e.firstName} {e.lastName}
                </span>
              </div>
              <div className="text-xs text-gray-500 truncate">{p?.appName ?? "No active app"}</div>
              <div className="text-xs text-gray-400 truncate">{p?.windowTitle ?? ""}</div>
            </button>
          );
        })}
      </div>

      {viewing && <LiveViewerModal employee={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function LiveViewerModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const deviceSocketIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "unavailable">("connecting");

  useEffect(() => {
    const socket = getSocket();
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.ontrack = (event) => {
      if (videoRef.current) videoRef.current.srcObject = event.streams[0];
      setStatus("live");
    };

    async function onOffer(payload: { from: string; employeeId: string; sdp: RTCSessionDescriptionInit }) {
      if (payload.employeeId !== employee.id) return;
      deviceSocketIdRef.current = payload.from;
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc:answer", { targetSocketId: payload.from, sdp: answer });
    }
    function onIceCandidate(payload: { candidate: RTCIceCandidateInit }) {
      pc.addIceCandidate(payload.candidate).catch(() => {});
    }
    function onUnavailable(payload: { employeeId: string }) {
      if (payload.employeeId === employee.id) setStatus("unavailable");
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && deviceSocketIdRef.current) {
        socket.emit("webrtc:ice-candidate", { targetSocketId: deviceSocketIdRef.current, candidate: event.candidate });
      }
    };

    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:ice-candidate", onIceCandidate);
    socket.on("livestream:unavailable", onUnavailable);
    socket.emit("livestream:watch", { employeeId: employee.id });

    return () => {
      socket.emit("livestream:stop", { employeeId: employee.id });
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:ice-candidate", onIceCandidate);
      socket.off("livestream:unavailable", onUnavailable);
      pc.close();
    };
  }, [employee.id]);

  function goFullscreen() {
    videoRef.current?.requestFullscreen();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-black rounded-lg overflow-hidden w-full max-w-[95vw] max-h-[95vh]">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white text-sm">
          <span>
            {employee.firstName} {employee.lastName} — {status === "live" ? "Live" : status === "unavailable" ? "Unavailable" : "Connecting..."}
          </span>
          <div className="space-x-3">
            <button onClick={goFullscreen}>Fullscreen</button>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
        <video
          ref={videoRef}
          autoPlay
          muted
          className="w-full max-h-[85vh] object-contain bg-black"
        />
      </div>
    </div>
  );
}
