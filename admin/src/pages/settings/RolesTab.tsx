import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface Role {
  id: string;
  name: string;
  description: string | null;
  isAdmin: boolean;
}

export function RolesTab() {
  const queryClient = useQueryClient();
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => (await api.get("/roles")).data,
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createRole = useMutation({
    mutationFn: async () => api.post("/roles", { name, description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setName("");
      setDescription("");
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4 flex gap-2 items-end">
        <div>
          <label className="block text-xs font-medium mb-1">Role name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={!name}
          onClick={() => createRole.mutate()}
          className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          + Add Role
        </button>
      </div>

      <div className="bg-white rounded-lg shadow divide-y">
        <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-gray-500">
          <div>Name</div>
          <div className="col-span-2">Description</div>
          <div>Actions</div>
        </div>
        {roles?.map((r) => (
          <div key={r.id} className="grid grid-cols-4 px-4 py-3 text-sm items-center">
            <div>{r.name}</div>
            <div className="col-span-2 text-gray-500">{r.description}</div>
            <div>
              {!r.isAdmin && (
                <button className="text-red-600" onClick={() => deleteRole.mutate(r.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
