import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Device {
  id: string;
  platform: string;
  hostname: string;
  ip: string | null;
  status: string;
  lastSeenAt: string | null;
  employee: { id: string; firstName: string; lastName: string; email: string };
}

interface DevicesResponse {
  devices: Device[];
  summary: {
    totalDeviceProfiles: number;
    online: number;
    offline: number;
    platforms: Record<string, number>;
  };
}

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "a few seconds ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

export function Devices() {
  const { data, isLoading } = useQuery<DevicesResponse>({
    queryKey: ["devices"],
    queryFn: async () => (await api.get("/devices")).data,
    refetchInterval: 15000,
  });

  if (isLoading || !data) return <div className="p-8 text-sm text-gray-500">Loading...</div>;

  const { devices, summary } = data;
  const total = summary.online + summary.offline || 1;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Devices</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Device Profiles</div>
          <div className="text-3xl font-bold">{summary.totalDeviceProfiles}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-2">Availability</div>
          <div className="flex items-center gap-3">
            <span className="font-bold">{summary.online}</span>
            <div className="flex-1 h-2 rounded bg-pink-200 overflow-hidden">
              <div className="h-2 bg-green-500" style={{ width: `${(summary.online / total) * 100}%` }} />
            </div>
            <span className="font-bold">{summary.offline}</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Online</span>
            <span>Offline</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-sm font-medium mb-3">Platform Distribution</div>
        <div className="flex gap-4 text-sm">
          {["windows", "macos", "linux"].map((p) => (
            <div key={p}>
              {summary.platforms[p] ?? 0} <span className="text-gray-500 capitalize">{p}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-gray-500">
          <div>Employee</div>
          <div>Platform</div>
          <div>Hostname / IP</div>
          <div>Last Seen</div>
        </div>
        {devices.map((d) => (
          <div key={d.id} className="grid grid-cols-4 px-4 py-3 text-sm items-center">
            <div>
              {d.employee.firstName} {d.employee.lastName}
            </div>
            <div className="capitalize">{d.platform}</div>
            <div className="text-gray-500">
              {d.hostname} {d.ip ? `· ${d.ip}` : ""}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${d.status === "online" ? "bg-green-500" : "bg-gray-300"}`} />
              {timeAgo(d.lastSeenAt)}
            </div>
          </div>
        ))}
        {devices.length === 0 && <div className="px-4 py-8 text-center text-sm text-gray-400">No devices yet</div>}
      </div>
    </div>
  );
}
