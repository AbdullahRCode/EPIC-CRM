"use client";

interface MultiSelectProps<T extends string> {
  options: T[];
  value: T[];
  onChange: (value: T[]) => void;
  label?: string;
}

export default function MultiSelect<T extends string>({
  options,
  value,
  onChange,
  label,
}: MultiSelectProps<T>) {
  function toggle(item: T) {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item));
    } else {
      onChange([...value, item]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="label">{label}</span>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className="label px-3 py-1.5 transition-all"
              style={{
                border: "1px solid",
                borderColor: selected ? "var(--ink)" : "var(--line)",
                background: selected ? "var(--ink)" : "transparent",
                color: selected ? "var(--paper)" : "var(--muted)",
                cursor: "pointer",
                fontSize: "0.6rem",
                letterSpacing: "0.15em",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
