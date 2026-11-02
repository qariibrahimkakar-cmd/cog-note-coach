import type { Analysis, DecisionEvent } from "@/lib/noteforge/types";
import { fmtTime } from "@/lib/noteforge/notestate";
import { cn } from "@/lib/utils";

const decisionColor: Record<DecisionEvent["decision"], string> = {
  write: "bg-write",
  update: "bg-update",
  connect: "bg-update",
  skip: "bg-skip",
  wait: "bg-wait",
};

const decisionLabel: Record<DecisionEvent["decision"], string> = {
  write: "WRITE",
  update: "UPDATE",
  connect: "CONNECT",
  skip: "IGNORE",
  wait: "WAIT",
};

export function DecisionTimeline({
  analysis,
  currentTime,
  onSeek,
  selected,
  onSelect,
}: {
  analysis: Analysis;
  currentTime: number;
  onSeek: (t: number) => void;
  selected: DecisionEvent | null;
  onSelect: (e: DecisionEvent) => void;
}) {
  const d = analysis.durationSec || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          decision timeline
        </h3>
        <div className="flex gap-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {(["write", "update", "skip"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <i className={cn("h-1.5 w-1.5 rounded-full", decisionColor[k])} />
              {decisionLabel[k]}
            </span>
          ))}
        </div>
      </div>

      <div
        className="relative h-24 cursor-pointer select-none rounded-lg border border-border bg-secondary/40"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - rect.left) / rect.width) * d);
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
        {analysis.events.map((ev) => {
          const left = `${Math.min(99, (ev.t / d) * 100)}%`;
          const isPast = ev.t <= currentTime;
          const written = ev.decision !== "skip" && ev.decision !== "wait";
          return (
            <button
              key={`${ev.segId}-${ev.t}`}
              type="button"
              title={`${fmtTime(ev.t)} · ${decisionLabel[ev.decision]} · ${ev.eventType}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(ev);
                onSeek(ev.t);
              }}
              className="absolute -translate-x-1/2"
              style={{ left, top: written ? undefined : "50%", bottom: written ? "50%" : undefined }}
            >
              <span
                className={cn(
                  "block w-[3px] rounded-full transition-all",
                  decisionColor[ev.decision],
                  isPast ? "opacity-100" : "opacity-35",
                  selected?.segId === ev.segId && "w-[5px] ring-2 ring-foreground/40",
                )}
                style={{ height: `${8 + ev.importance * 34}px` }}
              />
            </button>
          );
        })}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-foreground"
          style={{ left: `${Math.min(100, (currentTime / d) * 100)}%` }}
        >
          <span className="absolute -top-1 -left-[3px] h-[7px] w-[7px] rounded-full bg-foreground" />
        </div>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>00:00</span>
        <span>above the line = written · below = deliberately ignored · height = importance</span>
        <span>{fmtTime(d)}</span>
      </div>
    </div>
  );
}
