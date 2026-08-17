import { useState } from "react";

export interface AdvanceFilterField {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder?: string;
}

export function AdvanceFilterPanel({
  fields,
  values,
  onChange,
}: {
  fields: AdvanceFilterField[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(values).filter((v) => v !== undefined && v !== "").length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
      >
        Advance Filter
        {activeCount > 0 && (
          <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-brand text-white text-[10px] flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border p-4 z-20 space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
                className="w-full rounded-md border px-2 py-1.5 text-sm"
              />
            </div>
          ))}
          <div className="flex justify-between pt-1">
            <button className="text-xs text-gray-500" onClick={() => onChange({})}>
              Clear all
            </button>
            <button className="text-xs text-brand font-medium" onClick={() => setOpen(false)}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
