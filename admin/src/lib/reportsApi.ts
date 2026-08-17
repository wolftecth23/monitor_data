import { api } from "./api";

export interface ReportFilterParams {
  teamId?: string;
  employeeId?: string;
  page?: number;
  pageSize?: number;
}

export const reportsAPI = {
  getDailyAttendance: (params?: ReportFilterParams & { date?: string }) => api.get("/reports/attendance/daily", { params }),
  getMonthlyAttendance: (params?: ReportFilterParams & { month?: string }) => api.get("/reports/attendance/monthly", { params }),
  getMonthlyInOut: (params?: ReportFilterParams & { month?: string }) => api.get("/reports/attendance/monthly-in-out", { params }),
  getSummary: (params?: ReportFilterParams & { month?: string }) => api.get("/reports/summary", { params }),
  getActivity: (params?: ReportFilterParams & { startDate?: string; endDate?: string }) => api.get("/reports/activity", { params }),
  getAppsUrls: (params?: ReportFilterParams & { startDate?: string; endDate?: string; view?: "summary" | "datewise" }) =>
    api.get("/reports/apps-urls", { params }),
  getProductivity: (params?: ReportFilterParams & { startDate?: string; endDate?: string }) => api.get("/reports/productivity", { params }),
  getLogs: (params?: ReportFilterParams & { startDate?: string; endDate?: string; view?: "summary" | "datewise" | "individual" }) =>
    api.get("/reports/logs", { params }),
  getUsbEvents: (params?: ReportFilterParams & { startDate?: string; endDate?: string }) => api.get("/reports/usb-events", { params }),
};
