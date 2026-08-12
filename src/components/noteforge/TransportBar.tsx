import type { NoteForgeEvent, NoteForgeSession } from "@/lib/noteforge/types";
import { fmtTime } from "@/lib/noteforge/session";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const DOT: Record<NoteForgeEvent["type"], string> = {
  write: "bg-write",
  update: "bg-update",
  connect: "bg-update",
  skip: "bg-skip",
  wait: "bg-wait",
  question: "bg-question",
};

export function TransportBar({
  session,
  time,
  playing,
  rate,
  onToggle,
  onSeek,
  onRate,
  selectedEventId,
  onSelectEvent,
}: {
  session: NoteForgeSession;
  time: number;
  playing: boolean;
  rate: number;
  onToggle: () => void;
  onSeek: (t: number) => void;
  onRate: (r: number) => void;
  selectedEventId: string | null;
  onSelectEvent: (e: NoteForgeEvent) => void;
}) {
  const dur = Math.max(1, session.durationSec);
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / dur) * 100))}%`;

  return (
    <div className="surface flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Audio position"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur)}
          aria-valuenow={Math.round(time)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") onSeek(time + 5);
            if (e.key === "ArrowLeft") onSeek(time - 5);
          }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onSeek(((e.clientX - r.left) / r.width) * dur);
          }}
          className="relative h-9 cursor-pointer"
        >
          <div className="absolute left-0 right-0 top-[17px] h-[3px] rounded-full bg-subtle" />
          <div
            className="absolute left-0 top-[17px] h-[3px] rounded-full bg-primary/60"
            style={{ width: pct(time) }}
          />
          {session.events.map((e) => (
            <button
              key={e.id}
              type="button"
              title={`${fmtTime(e.timestamp)} · ${e.type}`}
              aria-label={`${e.type} at ${fmtTime(e.timestamp)}`}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectEvent(e);
              }}
              style={{ left: pct(e.timestamp) }}
              className={cn(
                "absolute top-[11px] -ml-[5px] h-[15px] w-[10px] rounded-full border-2 border-card transition-transform hover:scale-125",
                DOT[e.type],
                selectedEventId === e.id && "scale-125 ring-2 ring-primary/40",
                e.type === "skip" && "h-[9px] w-[6px] top-[14px] opacity-70",
              )}
            />
          ))}
          <div
            className="pointer-events-none absolute top-[9px] h-[19px] w-[2px] rounded bg-foreground"
            style={{ left: pct(time) }}
          />
        </div>
      </div>

      <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
        {fmtTime(time)} / {fmtTime(dur)}
      </span>
      <select
        aria-label="Playback speed"
        value={rate}
        onChange={(e) => onRate(Number(e.target.value))}
        className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[12px] text-secondary-foreground"
      >
        {[0.75, 1, 1.25, 1.5].map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
    </div>
  );
}
