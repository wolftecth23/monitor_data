import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsAPI } from "../../lib/reportsApi";
import { ReportPageHeader } from "../../components/reports/ReportPageHeader";
import { DateRangeFilter } from "../../components/reports/DateRangeFilter";
import { ReportTable, type Column } from "../../components/reports/ReportTable";
import { Pagination } from "../../components/reports/Pagination";
import { StatusBadge } from "../../components/reports/StatusBadge";
import { formatIST, daysAgoStr, todayStr } from "../../lib/reportUtils";

interface UsbRow {
  timestamp: string;
  eventType: string;
  title: string;
  user: { name: string; email: string };
}

export function UsbDetection() {
  const [range, setRange] = useState({ startDate: daysAgoStr(7), endDate: todayStr() });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data, isLoading } = useQuery({
    queryKey: ["report-usb-events", range, page, pageSize],
    queryFn: async () => (await reportsAPI.getUsbEvents({ ...range, page, pageSize })).data,
  });

  const columns: Column<UsbRow>[] = [
    { key: "timestamp", label: "Timestamp (IST)", render: (r) => formatIST(r.timestamp) },
    { key: "eventType", label: "Event Type", render: (r) => <StatusBadge label={r.eventType} /> },
    { key: "title", label: "Title", render: (r) => r.title },
    { key: "user", label: "User (Actor)", render: (r) => r.user.name },
  ];

  return (
    <div className="p-6">
      <ReportPageHeader title="USB Detection Report">
        <DateRangeFilter mode="range" value={range} onChange={(v) => (setPage(1), setRange(v))} />
      </ReportPageHeader>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <>
            <ReportTable columns={columns} rows={data?.rows ?? []} emptyMessage="No data" />
            <Pagination
              total={data?.total ?? 0}
              page={data?.page ?? page}
              pageSize={data?.pageSize ?? pageSize}
              onPageChange={setPage}
              onPageSizeChange={(s) => (setPage(1), setPageSize(s))}
              itemLabel="Events"
            />
          </>
        )}
      </div>
    </div>
  );
}
