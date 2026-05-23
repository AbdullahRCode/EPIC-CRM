"use client";

interface StatusPipelineProps {
  stages: string[];
  current: string;
  onChange?: (stage: string) => void;
  colorScheme?: "default" | "good";
}

export default function StatusPipeline({
  stages,
  current,
  onChange,
  colorScheme = "default",
}: StatusPipelineProps) {
  const currentIdx = stages.indexOf(current);
  const activeColor = colorScheme === "good" ? "var(--good)" : "var(--ink)";

  return (
    <div className="flex flex-col gap-2">
      {/* Segmented bar */}
      <div className="flex gap-0.5">
        {stages.map((stage, i) => {
          const filled = i <= currentIdx;
          return (
            <div
              key={stage}
              className="flex-1 relative"
              style={{ height: 3, background: filled ? activeColor : "var(--line)", transition: "background 0.2s" }}
            />
          );
        })}
      </div>

      {/* Stage labels */}
      <div className="flex justify-between">
        {stages.map((stage, i) => {
          const active = i === currentIdx;
          const done = i < currentIdx;
          return (
            <button
              key={stage}
              onClick={() => onChange?.(stage)}
              disabled={!onChange}
              className="label text-left"
              style={{
                color: active ? activeColor : done ? "var(--muted)" : "var(--line)",
                fontWeight: active ? 600 : 400,
                cursor: onChange ? "pointer" : "default",
                fontSize: "0.58rem",
                letterSpacing: "0.15em",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              {stage}
            </button>
          );
        })}
      </div>
    </div>
  );
}
