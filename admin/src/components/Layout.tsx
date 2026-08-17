import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/livestream", label: "Livestream" },
  { to: "/screenshots", label: "Screenshots" },
  { to: "/devices", label: "Devices" },
  { to: "/alerts", label: "Alerts" },
  { to: "/reports", label: "Reports" },
  { to: "/settings/users", label: "Settings" },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r bg-white flex flex-col">
        <div className="px-4 py-4 font-bold text-lg text-brand">Monitor</div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-brand/10 text-brand" : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t text-sm">
          <div className="font-medium">{user?.name}</div>
          <div className="text-gray-500 text-xs">{user?.email}</div>
          <button onClick={logout} className="mt-2 text-brand text-xs font-medium">
            Log out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
