import type { DecisionEvent, Segment } from "@/lib/noteforge/types";
import { fmtTime } from "@/lib/noteforge/notestate";
import { cn } from "@/lib/utils";

const label: Record<DecisionEvent["decision"], string> = {
  write: "I WROTE THIS",
  update: "I UPDATED A NOTE",
  connect: "I CONNECTED IT",
  skip: "I DID NOT WRITE",
  wait: "I WAITED",
};

const tone: Record<DecisionEvent["decision"], string> = {
  write: "text-write",
  update: "text-update",
  connect: "text-update",
  skip: "text-muted-foreground",
  wait: "text-wait",
};

export function TeacherPanel({
  event,
  segment,
}: {
  event: DecisionEvent | null;
  segment: Segment | undefined;
}) {
  if (!event) {
    return (
      <div className="panel flex min-h-[240px] items-center justify-center p-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          Play the recording, or click any mark on the timeline, to see the moment-by-moment
          note-taking decision.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <span className={cn("font-mono text-[10px] font-bold uppercase tracking-[0.2em]", tone[event.decision])}>
          👁 {label[event.decision]}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{fmtTime(event.t)}</span>
      </div>

      {segment ? (
        <p className="border-l-2 border-border pl-3 text-sm italic leading-relaxed text-muted-foreground">
          “{segment.text}”
        </p>
      ) : null}

      <div className="space-y-1">
        <p className="text-[15px] leading-relaxed text-foreground">{event.teacher.why}</p>
        {event.teacher.ignored ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-widest">ignored · </span>
            {event.teacher.ignored}
          </p>
        ) : null}
      </div>

      {event.teacher.rule ? (
        <div className="rounded-lg bg-teacher p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-teacher-foreground/70">
            rule I am applying
          </p>
          <p className="mt-1 text-sm leading-relaxed text-teacher-foreground">{event.teacher.rule}</p>
        </div>
      ) : null}

      {event.compression ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Chips title="preserved" items={event.compression.preserved} accent />
          <Chips title="removed" items={event.compression.removed} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Meter label="importance" value={event.importance} />
        <Meter label="confidence" value={event.confidence} />
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {event.eventType.replace(/_/g, " ")}
        </span>
      </div>

      {event.triggers.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {event.triggers.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-[2px] font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
            >
              {t.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      ) : null}

      {segment && segment.prosody.cues.length > 0 ? (
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            delivery signal · emphasis {Math.round(segment.prosody.emphasis * 100)}% · {segment.prosody.pitch} pitch ·{" "}
            {segment.prosody.rate}
            {segment.prosody.pauseAfter > 0.4 ? ` · ${segment.prosody.pauseAfter.toFixed(1)}s pause` : ""}
          </p>
          <ul className="mt-1 space-y-[2px]">
            {segment.prosody.cues.map((c) => (
              <li key={c} className="text-xs text-muted-foreground">
                — {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Chips({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((i) => (
          <span
            key={i}
            className={cn(
              "rounded px-1.5 py-[2px] font-mono text-[10px]",
              accent ? "bg-write/15 text-write" : "bg-secondary text-muted-foreground line-through",
            )}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function Meter({ label: l, value }: { label: string; value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{l}</span>
      <span className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
        <span className="block h-full rounded-full bg-primary" style={{ width: `${value * 100}%` }} />
      </span>
      <span className="font-mono text-[10px] text-foreground">{value.toFixed(2)}</span>
    </span>
  );
}
