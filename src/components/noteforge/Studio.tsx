import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Eye, EyeOff } from "lucide-react";
import type { Analysis, DecisionEvent } from "@/lib/noteforge/types";
import { activeSegment, fmtTime, foldNotes, stats } from "@/lib/noteforge/notestate";
import { Notebook } from "./Notebook";
import { DecisionTimeline } from "./DecisionTimeline";
import { TeacherPanel } from "./TeacherPanel";
import { cn } from "@/lib/utils";

type Coaching = "coach" | "expert" | "challenge";

export function Studio({
  analysis,
  audioSrc,
  onReset,
}: {
  analysis: Analysis;
  audioSrc: string;
  onReset: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<Coaching>("coach");
  const [pinned, setPinned] = useState<DecisionEvent | null>(null);
  const [revealed, setRevealed] = useState(false);

  const notes = useMemo(() => foldNotes(analysis.events, time), [analysis.events, time]);
  const s = useMemo(() => stats(analysis), [analysis]);

  const liveEvent = useMemo(() => {
    const past = analysis.events.filter((e) => e.t <= time + 0.25);
    return past.length ? past[past.length - 1]! : null;
  }, [analysis.events, time]);

  const shown = pinned ?? liveEvent;
  const shownSegment = shown ? analysis.segments.find((seg) => seg.id === shown.segId) : undefined;
  const heard = activeSegment(analysis.segments, time);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, t);
    setTime(Math.max(0, t));
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", () => setPlaying(true));
    a.addEventListener("pause", () => setPlaying(false));
    return () => a.removeEventListener("timeupdate", onTime);
  }, []);

  useEffect(() => {
    setPinned(null);
  }, [playing]);

  const hideNotes = mode === "challenge" && !revealed;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            {analysis.mode === "lecture" ? "lecture note-taker" : "conversation note-taker"}
          </p>
          <h1 className="text-3xl">{analysis.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1">
            {(
              [
                ["coach", "Coach"],
                ["expert", "Expert"],
                ["challenge", "Challenge"],
              ] as const
            ).map(([key, lbl]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setRevealed(false);
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors",
                  mode === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> new
          </button>
        </div>
      </header>

      <div className="panel mb-6 p-5">
        <audio ref={audioRef} src={audioSrc} preload="auto" />
        <div className="mb-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => (playing ? audioRef.current?.pause() : audioRef.current?.play())}
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105",
              playing && "pulse-ring",
            )}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-muted-foreground">
              {heard ? (
                <>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
                    {heard.speaker}
                  </span>{" "}
                  {heard.text}
                </>
              ) : (
                "Press play — the notebook writes itself in real time."
              )}
            </p>
          </div>
          <span className="font-mono text-sm tabular-nums text-muted-foreground">
            {fmtTime(time)} / {fmtTime(analysis.durationSec)}
          </span>
        </div>
        <DecisionTimeline
          analysis={analysis}
          currentTime={time}
          onSeek={seek}
          selected={pinned}
          onSelect={(e) => setPinned(e)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              expert notebook
            </h2>
            {mode === "challenge" ? (
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary"
              >
                {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {revealed ? "hide" : "reveal expert notes"}
              </button>
            ) : null}
          </div>
          <Notebook
            notes={notes}
            activeId={shown?.note?.id ?? null}
            hidden={hideNotes}
            onSelect={(id) => {
              const ev = [...analysis.events].reverse().find((e) => e.note?.id === id);
              if (ev) {
                setPinned(ev);
                audioRef.current?.pause();
              }
            }}
          />
          <div className="grid grid-cols-4 gap-2">
            <Stat label="written" value={String(s.written)} />
            <Stat label="updated" value={String(s.updated)} />
            <Stat label="ignored" value={String(s.skipped)} />
            <Stat label="selectivity" value={`${s.selectivity}%`} />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "expert" ? "note inspector" : "why this decision?"}
          </h2>
          {mode === "expert" && !pinned ? (
            <div className="panel flex min-h-[240px] items-center justify-center p-6 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                Expert mode: the note-taker works silently. Click a note or a timeline mark if you want
                the reasoning behind it.
              </p>
            </div>
          ) : mode === "challenge" && !revealed ? (
            <ChallengeCard event={shown} onReveal={() => setRevealed(true)} />
          ) : (
            <TeacherPanel event={shown} segment={shownSegment} />
          )}
        </div>
      </div>
    </div>
  );
}

function ChallengeCard({ event, onReveal }: { event: DecisionEvent | null; onReveal: () => void }) {
  return (
    <div className="panel space-y-4 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-wait">your call</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Listen. At each moment decide for yourself: <strong className="text-foreground">write</strong> or{" "}
        <strong className="text-foreground">don't write</strong>. Then compare.
      </p>
      {event ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            expert decision at {fmtTime(event.t)}
          </p>
          <button
            type="button"
            onClick={onReveal}
            className="mt-2 rounded-md bg-primary px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-primary-foreground"
          >
            reveal
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      <p className="font-mono text-lg text-foreground">{value}</p>
    </div>
  );
}
