import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface Team {
  id: string;
  name: string;
  _count?: { employees: number };
}

interface TrackingSettings {
  trackingEnabled: boolean;
  livestreamEnabled: boolean;
  captureScreenshots: boolean;
  screenshotFrequencySec: number;
  appUrlTracking: boolean;
  keyboardMouseTracking: boolean;
  idleTimeoutSec: number;
  activeThresholdSec: number;
}

const FREQUENCY_OPTIONS = [60, 300, 600, 900, 1800];

export function TeamsTab() {
  const queryClient = useQueryClient();
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => (await api.get("/teams")).data,
  });

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"info" | "members" | "tracking">("tracking");
  const [newTeamName, setNewTeamName] = useState("");

  const selectedTeam = teams?.find((t) => t.id === selectedTeamId) ?? teams?.[0] ?? null;
  const activeTeamId = selectedTeamId ?? selectedTeam?.id ?? null;

  const { data: teamDetail } = useQuery({
    queryKey: ["team", activeTeamId],
    queryFn: async () => (await api.get(`/teams/${activeTeamId}`)).data,
    enabled: !!activeTeamId,
  });

  const { data: trackingSettings } = useQuery<TrackingSettings>({
    queryKey: ["tracking-settings", activeTeamId],
    queryFn: async () => (await api.get(`/teams/${activeTeamId}/tracking-settings`)).data,
    enabled: !!activeTeamId && subTab === "tracking",
  });

  const createTeam = useMutation({
    mutationFn: async () => api.post("/teams", { name: newTeamName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setNewTeamName("");
    },
  });

  const saveSettings = useMutation({
    mutationFn: async (settings: Partial<TrackingSettings>) =>
      api.put(`/teams/${activeTeamId}/tracking-settings`, settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tracking-settings", activeTeamId] }),
  });

  const [draft, setDraft] = useState<TrackingSettings | null>(null);
  const settings = draft ?? trackingSettings;

  return (
    <div className="flex gap-4">
      <div className="w-56 shrink-0 bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Teams</span>
        </div>
        {teams?.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setSelectedTeamId(t.id);
              setDraft(null);
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
              activeTeamId === t.id ? "bg-brand/10 text-brand font-medium" : ""
            }`}
          >
            {t.name}
          </button>
        ))}
        <div className="px-4 py-2 flex gap-2 border-t">
          <input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="New team"
            className="flex-1 min-w-0 rounded-md border px-2 py-1 text-xs"
          />
          <button
            disabled={!newTeamName}
            onClick={() => createTeam.mutate()}
            className="text-brand text-xs font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {activeTeamId && (
        <div className="flex-1 bg-white rounded-lg shadow">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-bold">{teamDetail?.name}</span>
          </div>
          <div className="flex gap-4 border-b px-4 text-sm">
            {(["info", "members", "tracking"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSubTab(s)}
                className={`py-2 ${subTab === s ? "border-b-2 border-brand text-brand font-medium" : "text-gray-500"}`}
              >
                {s === "info" ? "Team Info" : s === "members" ? `Members ${teamDetail?.employees?.length ?? ""}` : "Tracking Settings"}
              </button>
            ))}
          </div>

          {subTab === "info" && (
            <div className="p-4 text-sm text-gray-500">Team name: {teamDetail?.name}</div>
          )}

          {subTab === "members" && (
            <div className="p-4 divide-y">
              {teamDetail?.employees?.map((e: any) => (
                <div key={e.id} className="py-2 text-sm">
                  {e.firstName} {e.lastName} <span className="text-gray-400">· {e.email}</span>
                </div>
              ))}
              {teamDetail?.employees?.length === 0 && <div className="text-sm text-gray-400">No members yet</div>}
            </div>
          )}

          {subTab === "tracking" && settings && (
            <div className="p-4 space-y-4">
              <ToggleRow
                label="Tracking"
                description="Switch off to stop tracking metrics for the employee."
                checked={settings.trackingEnabled}
                onChange={(v) => setDraft({ ...settings, trackingEnabled: v })}
              />
              <ToggleRow
                label="Livestream"
                description="Switch on to view live updates about the employee."
                checked={settings.livestreamEnabled}
                onChange={(v) => setDraft({ ...settings, livestreamEnabled: v })}
                indent
              />
              <ToggleRow
                label="Capture screenshots"
                description="Switch on to take regular screenshots."
                checked={settings.captureScreenshots}
                onChange={(v) => setDraft({ ...settings, captureScreenshots: v })}
                indent
              />
              {settings.captureScreenshots && (
                <div className="ml-6 flex items-center justify-between text-sm">
                  <span>Screenshot Frequency</span>
                  <select
                    className="rounded-md border px-2 py-1 text-sm"
                    value={settings.screenshotFrequencySec}
                    onChange={(e) => setDraft({ ...settings, screenshotFrequencySec: Number(e.target.value) })}
                  >
                    {FREQUENCY_OPTIONS.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec < 60 ? `${sec} Sec` : `${sec / 60} Min`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <ToggleRow
                label="App & URLs"
                description="Switch on to view live updates about the employee."
                checked={settings.appUrlTracking}
                onChange={(v) => setDraft({ ...settings, appUrlTracking: v })}
                indent
              />
              <div className="flex items-center justify-between text-sm">
                <span>Idle Timeout Popup</span>
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={settings.idleTimeoutSec}
                  onChange={(e) => setDraft({ ...settings, idleTimeoutSec: Number(e.target.value) })}
                >
                  {[60, 300, 600, 900].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec / 60} Min
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Active Threshold</span>
                <select
                  className="rounded-md border px-2 py-1 text-sm"
                  value={settings.activeThresholdSec}
                  onChange={(e) => setDraft({ ...settings, activeThresholdSec: Number(e.target.value) })}
                >
                  {[15, 30, 60].map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} Sec
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => draft && saveSettings.mutate(draft)}
                disabled={!draft}
                className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  indent,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between ${indent ? "ml-6" : ""}`}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition-colors ${checked ? "bg-brand" : "bg-gray-300"}`}
      >
        <span className={`block w-4 h-4 bg-white rounded-full transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
