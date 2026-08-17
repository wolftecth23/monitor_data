import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Livestream } from "./pages/Livestream";
import { Screenshots } from "./pages/Screenshots";
import { Devices } from "./pages/Devices";
import { Alerts } from "./pages/Alerts";
import { UserManagement } from "./pages/settings/UserManagement";
import { ReportsHome } from "./pages/reports/ReportsHome";
import { DailyAttendance } from "./pages/reports/DailyAttendance";
import { MonthlyAttendance } from "./pages/reports/MonthlyAttendance";
import { MonthlyInOut } from "./pages/reports/MonthlyInOut";
import { Summary } from "./pages/reports/Summary";
import { Activity } from "./pages/reports/Activity";
import { AppsUrls } from "./pages/reports/AppsUrls";
import { Productivity } from "./pages/reports/Productivity";
import { Logs } from "./pages/reports/Logs";
import { UsbDetection } from "./pages/reports/UsbDetection";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-sm text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/livestream" element={<Livestream />} />
        <Route path="/screenshots" element={<Screenshots />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<ReportsHome />} />
        <Route path="/reports/attendance-daily" element={<DailyAttendance />} />
        <Route path="/reports/attendance-monthly" element={<MonthlyAttendance />} />
        <Route path="/reports/in-out-monthly" element={<MonthlyInOut />} />
        <Route path="/reports/summary" element={<Summary />} />
        <Route path="/reports/activity" element={<Activity />} />
        <Route path="/reports/apps-urls" element={<AppsUrls />} />
        <Route path="/reports/productivity" element={<Productivity />} />
        <Route path="/reports/logs" element={<Logs />} />
        <Route path="/reports/usb-detection" element={<UsbDetection />} />
        <Route path="/settings/:tab" element={<UserManagement />} />
        <Route path="/" element={<Navigate to="/livestream" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/livestream" replace />} />
    </Routes>
  );
}
