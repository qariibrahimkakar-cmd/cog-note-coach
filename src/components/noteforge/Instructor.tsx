import { useState } from "react";
import { ChevronDown, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import type { NoteForgeEvent } from "@/lib/noteforge/types";
import { cn } from "@/lib/utils";

const HEAD: Record<NoteForgeEvent["type"], { label: string; tone: string; bg: string }> = {
  write: { label: "I wrote this", tone: "text-write", bg: "bg-write-soft" },
  update: { label: "Updated", tone: "text-update", bg: "bg-update-soft" },
  connect: { label: "Connected", tone: "text-update", bg: "bg-update-soft" },
  skip: { label: "Skipped", tone: "text-skip", bg: "bg-subtle" },
  wait: { label: "Waiting", tone: "text-wait", bg: "bg-subtle" },
  question: { label: "Question opportunity", tone: "text-question", bg: "bg-question-soft" },
};

const READABLE = (s: string) => s.replace(/_/g, " ");

export function Instructor({
  event,
  noteText,
  onOrganization,
  onExplain,
}: {
  event: NoteForgeEvent | null;
  noteText: string | null;
  onOrganization: () => void;
  onExplain: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  if (!event) {
    return (
      <aside className="surface flex h-full flex-col p-5">
        <p className="label">live instructor</p>
        <p className="mt-4 text-[16px] leading-relaxed text-secondary-foreground">
          I'll explain what I write, what I skip, and how the pieces connect.
        </p>
      </aside>
    );
  }

  const head = HEAD[event.type];
  const compactSkip = event.type === "skip" || event.type === "wait";

  return (
    <aside className="surface flex h-full flex-col overflow-y-auto p-5" aria-live="polite">
      <div className="flex items-center justify-between">
        <p className="label">live instructor</p>
        <span className="font-mono text-[11px] text-muted-foreground">
          {READABLE(event.reason.category)}
        </span>
      </div>

      <div className={cn("mt-4 rounded-lg px-4 py-3", head.bg)}>
        <p className={cn("font-mono text-[11px] uppercase tracking-[0.14em]", head.tone)}>{head.label}</p>
        {noteText ? (
          <p className="mt-2 text-[19px] leading-snug text-foreground">{noteText}</p>
        ) : null}
        <p className="mt-2 text-[15px] leading-relaxed text-secondary-foreground">
          {event.teaching.shortExplanation || event.reason.short}
        </p>
      </div>

      {compactSkip ? (
        <button
          type="button"
          onClick={onExplain}
          className="mt-3 self-start rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-subtle"
        >
          Explain
        </button>
      ) : (
        <>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowDetail((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-primary"
              aria-expanded={showDetail}
            >
              Why? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetail && "rotate-180")} />
            </button>
            {showDetail ? (
              <p className="mt-2 text-[15px] leading-relaxed text-secondary-foreground">
                {event.teaching.detailedExplanation || event.reason.detailed}
              </p>
            ) : null}
          </div>

          {event.teaching.principle ? (
            <div className="mt-4 border-l-2 border-teacher pl-3">
              <p className="label text-teacher">note-taking principle</p>
              <p className="mt-1 text-[16px] leading-relaxed text-foreground">{event.teaching.principle}</p>
            </div>
          ) : null}

          {(event.teaching.preserved?.length || event.teaching.removed?.length) ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="label">kept</p>
                <p className="mt-1 text-[14px] text-foreground">{event.teaching.preserved?.join(", ") || "—"}</p>
              </div>
              <div>
                <p className="label">dropped</p>
                <p className="mt-1 text-[14px] text-muted-foreground line-through">
                  {event.teaching.removed?.join(", ") || "—"}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOrganization}
              className="rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-subtle"
            >
              Organization
            </button>
            {event.audioSignals || event.teaching.audioEvidence ? (
              <button
                type="button"
                onClick={() => setShowAudio((v) => !v)}
                aria-expanded={showAudio}
                className="rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-subtle"
              >
                Audio evidence
              </button>
            ) : null}
          </div>

          {showAudio ? (
            <dl className="mt-3 space-y-1 rounded-lg bg-subtle p-3 text-[14px]">
              {(
                [
                  ["Lexical", event.audioSignals?.lexical],
                  ["Tempo", event.audioSignals?.tempo],
                  ["Pitch", event.audioSignals?.pitch],
                  ["Emphasis", event.audioSignals?.emphasis],
                  ["Decision impact", event.audioSignals?.impact ?? event.teaching.audioEvidence],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-32 shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {k}
                    </dt>
                    <dd className="text-secondary-foreground">{v}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
        </>
      )}

      {event.listeningFor?.length ? (
        <div className="mt-6">
          <p className="label">listening for</p>
          <ul className="mt-2 space-y-1">
            {event.listeningFor.map((l, i) => (
              <li key={l} className="flex items-center gap-2 text-[15px] text-secondary-foreground">
                <span className={cn("text-[13px]", i === 0 ? "text-primary" : "text-muted-foreground")}>
                  {i === 0 ? "●" : "○"}
                </span>
                {l}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <p className="label">expert attention</p>
        <div className="mt-2 h-[6px] w-full rounded-full bg-subtle">
          <div
            className="h-[6px] rounded-full bg-teacher transition-all duration-500"
            style={{ width: `${Math.round((event.attention ?? event.importance) * 100)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>low</span>
          <span>{READABLE(event.reason.category)}</span>
          <span>high</span>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"
        >
          advanced <ChevronDown className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-180")} />
        </button>
        {showAdvanced ? (
          <p className="mt-2 font-mono text-[12px] text-muted-foreground">
            importance {event.importance.toFixed(2)} · confidence {event.confidence.toFixed(2)} ·{" "}
            {event.source.speaker}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Was this useful?</span>
        <button
          type="button"
          aria-label="Helpful"
          onClick={() => setFeedback("up")}
          className={cn("rounded p-1 hover:bg-subtle", feedback === "up" && "text-update")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Not helpful"
          onClick={() => setFeedback("down")}
          className={cn("rounded p-1 hover:bg-subtle", feedback === "down" && "text-destructive")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
