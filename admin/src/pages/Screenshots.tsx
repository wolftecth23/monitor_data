import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, API_URL } from "../lib/api";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface Screenshot {
  id: string;
  employeeId: string;
  appName: string | null;
  windowTitle: string | null;
  capturedAt: string;
  flagged: boolean;
}

function screenshotUrl(id: string) {
  return `${API_URL}/api/screenshots/${id}/file?token=${localStorage.getItem("monitor_token") ?? ""}`;
}

export function Screenshots() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Screenshot | null>(null);

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });

  const { data: screenshots } = useQuery<Screenshot[]>({
    queryKey: ["screenshots", selectedEmployeeId, date],
    queryFn: async () =>
      (
        await api.get("/screenshots", {
          params: { employeeId: selectedEmployeeId ?? undefined, date },
        })
      ).data,
    enabled: !!selectedEmployeeId,
  });

  const grouped = useMemo(() => {
    const byHour = new Map<string, Screenshot[]>();
    for (const s of screenshots ?? []) {
      const d = new Date(s.capturedAt);
      const h = d.getHours();
      const label = `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
      if (!byHour.has(label)) byHour.set(label, []);
      byHour.get(label)!.push(s);
    }
    return byHour;
  }, [screenshots]);

  return (
    <div className="p-6 flex gap-6 h-full">
      <div className="w-64 shrink-0 bg-white rounded-lg shadow overflow-auto">
        <div className="px-4 py-3 border-b text-sm font-medium">Users</div>
        {employees?.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelectedEmployeeId(e.id)}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
              selectedEmployeeId === e.id ? "bg-brand/10 text-brand font-medium" : ""
            }`}
          >
            {e.firstName} {e.lastName}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Screenshots</h1>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
        </div>

        {!selectedEmployeeId && <div className="text-sm text-gray-400">Select a user to view their screenshots.</div>}

        {[...grouped.entries()].map(([hour, shots]) => (
          <div key={hour}>
            <div className="text-xs font-medium text-brand mb-2">{hour}</div>
            <div className="grid grid-cols-5 gap-3">
              {shots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setViewing(s)}
                  className="text-left rounded-md overflow-hidden shadow bg-white hover:shadow-md hover:ring-2 hover:ring-brand/50 transition"
                >
                  <img
                    src={screenshotUrl(s.id)}
                    alt={s.windowTitle ?? "screenshot"}
                    className="w-full h-28 object-cover bg-gray-100"
                  />
                  <div className="px-2 py-1 text-[10px] text-gray-500 truncate">
                    {new Date(s.capturedAt).toLocaleTimeString()} · {s.appName}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        {selectedEmployeeId && grouped.size === 0 && (
          <div className="text-sm text-gray-400">No screenshots for this user on {date}.</div>
        )}
      </div>

      {viewing && <ScreenshotViewerModal screenshot={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function ScreenshotViewerModal({ screenshot, onClose }: { screenshot: Screenshot; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);

  function goFullscreen() {
    imgRef.current?.requestFullscreen();
  }

  async function download() {
    const res = await fetch(screenshotUrl(screenshot.id));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `screenshot-${new Date(screenshot.capturedAt).toISOString().replace(/[:.]/g, "-")}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-black rounded-lg overflow-hidden w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white text-sm">
          <span>
            {new Date(screenshot.capturedAt).toLocaleString()} · {screenshot.appName ?? "Unknown app"}
            {screenshot.windowTitle ? ` — ${screenshot.windowTitle}` : ""}
          </span>
          <div className="space-x-4">
            <button onClick={download} className="hover:text-brand">
              Download
            </button>
            <button onClick={goFullscreen} className="hover:text-brand">
              Fullscreen
            </button>
            <button onClick={onClose} className="hover:text-brand">
              Close
            </button>
          </div>
        </div>
        <img
          ref={imgRef}
          src={screenshotUrl(screenshot.id)}
          alt={screenshot.windowTitle ?? "screenshot"}
          className="w-full max-h-[80vh] object-contain bg-black"
        />
      </div>
    </div>
  );
}
