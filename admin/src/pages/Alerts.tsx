import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Team {
  id: string;
  name: string;
}

interface AlertRule {
  id: string;
  name: string;
  description: string | null;
  type: "inactivity" | "application" | "url";
  config: Record<string, any>;
  deliveryMode: string;
  recipients: string[];
  teams: { team: Team }[];
}

interface AlertLog {
  id: string;
  description: string;
  triggeredAt: string;
  alertRule: { type: string };
  employee: { firstName: string; lastName: string } | null;
}

const EMPTY_RULE = {
  name: "",
  description: "",
  type: "inactivity" as AlertRule["type"],
  config: {} as Record<string, any>,
  deliveryMode: "individual",
  recipients: [] as string[],
  teamIds: [] as string[],
};

export function Alerts() {
  const [tab, setTab] = useState<"logs" | "rules">("logs");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<typeof EMPTY_RULE | null>(null);
  const queryClient = useQueryClient();

  const { data: logs } = useQuery<AlertLog[]>({
    queryKey: ["alert-logs", date],
    queryFn: async () => (await api.get("/alert-logs", { params: { date } })).data,
    enabled: tab === "logs",
  });

  const { data: rules } = useQuery<AlertRule[]>({
    queryKey: ["alert-rules"],
    queryFn: async () => (await api.get("/alert-rules")).data,
    enabled: tab === "rules",
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => (await api.get("/teams")).data,
  });

  const saveRule = useMutation({
    mutationFn: async (rule: typeof EMPTY_RULE & { id?: string }) => {
      if (rule.id) return api.put(`/alert-rules/${rule.id}`, rule);
      return api.post("/alert-rules", rule);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setEditing(null);
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => api.delete(`/alert-rules/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules"] }),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Alerts</h1>

      <div className="flex gap-4 border-b text-sm">
        <button
          className={`pb-2 ${tab === "logs" ? "border-b-2 border-brand text-brand font-medium" : "text-gray-500"}`}
          onClick={() => setTab("logs")}
        >
          Alert Logs
        </button>
        <button
          className={`pb-2 ${tab === "rules" ? "border-b-2 border-brand text-brand font-medium" : "text-gray-500"}`}
          onClick={() => setTab("rules")}
        >
          Alert Rules
        </button>
      </div>

      {tab === "logs" && (
        <div className="space-y-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          />
          <div className="bg-white rounded-lg shadow divide-y">
            <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-gray-500">
              <div>Date</div>
              <div className="col-span-2">Description</div>
              <div>Triggered</div>
            </div>
            {logs?.map((log) => (
              <div key={log.id} className="grid grid-cols-4 px-4 py-3 text-sm items-center">
                <div>{new Date(log.triggeredAt).toLocaleDateString()}</div>
                <div className="col-span-2">{log.description}</div>
                <div className="text-gray-500">{new Date(log.triggeredAt).toLocaleTimeString()}</div>
              </div>
            ))}
            {logs?.length === 0 && <div className="px-4 py-8 text-center text-sm text-gray-400">No alerts for this date</div>}
          </div>
        </div>
      )}

      {tab === "rules" && (
        <div className="space-y-3">
          <button
            onClick={() => setEditing({ ...EMPTY_RULE })}
            className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2"
          >
            + Add Alert Rule
          </button>
          <div className="bg-white rounded-lg shadow divide-y">
            <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-gray-500">
              <div>Type</div>
              <div className="col-span-2">Name</div>
              <div>Actions</div>
            </div>
            {rules?.map((rule) => (
              <div key={rule.id} className="grid grid-cols-4 px-4 py-3 text-sm items-center capitalize">
                <div>{rule.type}</div>
                <div className="col-span-2 normal-case">{rule.name}</div>
                <div className="space-x-3">
                  <button
                    className="text-brand"
                    onClick={() =>
                      setEditing({
                        name: rule.name,
                        description: rule.description ?? "",
                        type: rule.type,
                        config: rule.config,
                        deliveryMode: rule.deliveryMode,
                        recipients: rule.recipients,
                        teamIds: rule.teams.map((t) => t.team.id),
                        ...(rule.id ? { id: rule.id } : {}),
                      } as any)
                    }
                  >
                    Edit
                  </button>
                  <button className="text-red-600" onClick={() => deleteRule.mutate(rule.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-auto">
            <h2 className="font-bold">Edit Alert Rule</h2>
            <div>
              <label className="block text-xs font-medium mb-1">Alert Rule Name</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Alert Rule Type</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as AlertRule["type"], config: {} })}
              >
                <option value="inactivity">Inactivity</option>
                <option value="application">Application</option>
                <option value="url">URL</option>
              </select>
            </div>

            {editing.type === "inactivity" && (
              <div>
                <label className="block text-xs font-medium mb-1">Inactivity threshold (minutes)</label>
                <input
                  type="number"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={editing.config.thresholdMinutes ?? 30}
                  onChange={(e) => setEditing({ ...editing, config: { thresholdMinutes: Number(e.target.value) } })}
                />
              </div>
            )}

            {editing.type === "application" && (
              <div>
                <label className="block text-xs font-medium mb-1">Applications (comma separated)</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={(editing.config.apps ?? []).join(", ")}
                  onChange={(e) =>
                    setEditing({ ...editing, config: { apps: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })
                  }
                />
              </div>
            )}

            {editing.type === "url" && (
              <div>
                <label className="block text-xs font-medium mb-1">URLs (comma separated)</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={(editing.config.urls ?? []).join(", ")}
                  onChange={(e) =>
                    setEditing({ ...editing, config: { urls: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } })
                  }
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium mb-1">Teams</label>
              <select
                multiple
                className="w-full rounded-md border px-3 py-2 text-sm h-24"
                value={editing.teamIds}
                onChange={(e) =>
                  setEditing({ ...editing, teamIds: Array.from(e.target.selectedOptions).map((o) => o.value) })
                }
              >
                {teams?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Send email to (comma separated)</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={editing.recipients.join(", ")}
                onChange={(e) =>
                  setEditing({ ...editing, recipients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="px-4 py-2 text-sm rounded-md border" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-brand text-white"
                onClick={() => saveRule.mutate(editing as any)}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
