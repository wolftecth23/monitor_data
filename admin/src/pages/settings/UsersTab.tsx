import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, API_URL } from "../../lib/api";

interface Team {
  id: string;
  name: string;
}
interface Role {
  id: string;
  name: string;
}
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string | null;
  status: string;
  team: Team | null;
  role: Role | null;
  installToken: string;
}

interface EmployeeForm {
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  roleId: string;
  teamId: string;
}

interface PlatformInfo {
  platform: string;
  available: boolean;
}

const EMPTY_FORM: EmployeeForm = {
  firstName: "",
  lastName: "",
  email: "",
  employeeId: "",
  roleId: "",
  teamId: "",
};

const PLATFORM_LABELS: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Ubuntu / Linux",
};

export function UsersTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [installerFor, setInstallerFor] = useState<Employee | null>(null);

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });
  const { data: teams } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: async () => (await api.get("/teams")).data,
  });
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => (await api.get("/roles")).data,
  });
  const { data: platformsData } = useQuery<{ platforms: PlatformInfo[] }>({
    queryKey: ["installer-platforms"],
    queryFn: async () => (await api.get("/platforms")).data,
    enabled: !!installerFor,
  });

  const saveEmployee = useMutation({
    mutationFn: async () => {
      if (editingId) return api.put(`/employees/${editingId}`, form);
      return api.post("/employees", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      closeModal();
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  });

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(e: Employee) {
    setEditingId(e.id);
    setForm({
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      employeeId: e.employeeId ?? "",
      roleId: e.role?.id ?? "",
      teamId: e.team?.id ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function confirmDelete(e: Employee) {
    if (window.confirm(`Delete ${e.firstName} ${e.lastName}? This also removes their devices, screenshots, and activity history.`)) {
      deleteEmployee.mutate(e.id);
    }
  }

  function downloadInstaller(platform: string) {
    if (!installerFor) return;
    const token = localStorage.getItem("monitor_token") ?? "";
    const url = `${API_URL}/api/employees/${installerFor.id}/installer/${platform}?token=${token}`;
    window.open(url, "_blank");
    setInstallerFor(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">Total Active Users: {employees?.filter((e) => e.status === "active").length}</div>
        <button onClick={openAdd} className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2">
          + Add User
        </button>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        <div className="grid grid-cols-[1.1fr_1.8fr_0.9fr_1fr_0.7fr_0.9fr_0.9fr] px-4 py-2 text-xs font-medium text-gray-500">
          <div>Name</div>
          <div>Email</div>
          <div>Team</div>
          <div>Role</div>
          <div>Status</div>
          <div>Install</div>
          <div>Actions</div>
        </div>
        {employees?.map((e) => (
          <div key={e.id} className="grid grid-cols-[1.1fr_1.8fr_0.9fr_1fr_0.7fr_0.9fr_0.9fr] px-4 py-3 text-sm items-center">
            <div>
              {e.firstName} {e.lastName}
            </div>
            <div className="text-gray-500 truncate" title={e.email}>
              {e.email}
            </div>
            <div>{e.team?.name ?? "-"}</div>
            <div>{e.role?.name ?? "-"}</div>
            <div className="capitalize">{e.status}</div>
            <div>
              <button className="text-brand text-xs font-medium" onClick={() => setInstallerFor(e)}>
                Get Installer
              </button>
            </div>
            <div className="space-x-3">
              <button className="text-brand text-xs font-medium" onClick={() => openEdit(e)}>
                Edit
              </button>
              <button className="text-red-600 text-xs font-medium" onClick={() => confirmDelete(e)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">{editingId ? "Edit User" : "Add User"}</h2>
              <button onClick={closeModal}>&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">First Name *</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Last Name *</label>
                <input
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Email *</label>
              <input
                type="email"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">Employee ID</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Role *</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                >
                  <option value="">Select</option>
                  {roles?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Team *</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={form.teamId}
                  onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                >
                  <option value="">Select</option>
                  {teams?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => saveEmployee.mutate()}
              disabled={!form.firstName || !form.lastName || !form.email || !form.roleId || !form.teamId}
              className="w-full rounded-md bg-brand text-white text-sm font-medium py-2 disabled:opacity-50"
            >
              {editingId ? "Save Changes" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {installerFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-bold">
                Install on {installerFor.firstName} {installerFor.lastName}'s PC
              </h2>
              <button onClick={() => setInstallerFor(null)}>&times;</button>
            </div>
            <p className="text-xs text-gray-500">
              Choose the operating system. The download is a ready-to-run app pre-configured for this employee —
              extract it and run it on their computer, no setup needed.
            </p>
            <div className="space-y-2">
              {(platformsData?.platforms ?? [{ platform: "windows", available: true }, { platform: "macos", available: false }, { platform: "linux", available: false }]).map(
                (p) => (
                  <button
                    key={p.platform}
                    disabled={!p.available}
                    onClick={() => downloadInstaller(p.platform)}
                    className="w-full flex items-center justify-between rounded-md border px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                  >
                    <span>{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
                    <span className="text-xs text-gray-400">{p.available ? "Download" : "Not available yet"}</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
