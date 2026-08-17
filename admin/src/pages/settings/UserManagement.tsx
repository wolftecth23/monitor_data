import { useParams, useNavigate } from "react-router-dom";
import { UsersTab } from "./UsersTab";
import { TeamsTab } from "./TeamsTab";
import { RolesTab } from "./RolesTab";

const TABS = [
  { key: "users", label: "Users" },
  { key: "teams", label: "Teams" },
  { key: "roles", label: "Roles" },
];

export function UserManagement() {
  const { tab = "users" } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Settings &gt; User Management</h1>

      <div className="flex gap-4 border-b text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/settings/${t.key}`)}
            className={`pb-2 ${tab === t.key ? "border-b-2 border-brand text-brand font-medium" : "text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "teams" && <TeamsTab />}
      {tab === "roles" && <RolesTab />}
    </div>
  );
}
