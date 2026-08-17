interface SingleProps {
  mode: "single";
  value: string;
  onChange: (value: string) => void;
}

interface RangeProps {
  mode: "range";
  value: { startDate: string; endDate: string };
  onChange: (value: { startDate: string; endDate: string }) => void;
}

interface MonthProps {
  mode: "month";
  value: string;
  onChange: (value: string) => void;
}

type Props = SingleProps | RangeProps | MonthProps;

const inputClass = "rounded-md border px-3 py-1.5 text-sm";

export function DateRangeFilter(props: Props) {
  if (props.mode === "single") {
    return <input type="date" className={inputClass} value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
  }
  if (props.mode === "month") {
    return <input type="month" className={inputClass} value={props.value} onChange={(e) => props.onChange(e.target.value)} />;
  }
  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        className={inputClass}
        value={props.value.startDate}
        onChange={(e) => props.onChange({ ...props.value, startDate: e.target.value })}
      />
      <span className="text-gray-400 text-sm">to</span>
      <input
        type="date"
        className={inputClass}
        value={props.value.endDate}
        onChange={(e) => props.onChange({ ...props.value, endDate: e.target.value })}
      />
    </div>
  );
}
