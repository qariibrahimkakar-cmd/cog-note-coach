import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type {
  NoteForgeEvent,
  NoteForgeSession,
  NoteRepresentation,
  Question,
} from "@/lib/noteforge/types";
import {
  autoRepresentation,
  buildNotes,
  eventAt,
  fmtTime,
  scoreStudentNotes,
  textAt,
} from "@/lib/noteforge/session";
import { Whiteboard } from "./Whiteboard";
import { Instructor } from "./Instructor";
import { TransportBar } from "./TransportBar";
import { cn } from "@/lib/utils";

type Sheet = "none" | "explain" | "organization" | "replay" | "student" | "summary";
type QuestionMode = "off" | "occasional" | "adaptive";

const REPRESENTATIONS: Array<NoteRepresentation | "auto"> = [
  "auto",
  "linear",
  "outline",
  "tree",
  "mindmap",
  "flow",
  "cornell",
  "compression",
];

export function Studio({
  analysis: session,
  audioSrc,
  onReset,
}: {
  analysis: NoteForgeSession;
  audioSrc: string;
  onReset: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [ended, setEnded] = useState(false);
  const [level, setLevel] = useState(75);
  const [repChoice, setRepChoice] = useState<NoteRepresentation | "auto">("auto");
  const [teacherOn, setTeacherOn] = useState(true);
  const [questionMode, setQuestionMode] = useState<QuestionMode>("occasional");
  const [pinned, setPinned] = useState<NoteForgeEvent | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const [question, setQuestion] = useState<Question | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const [answer, setAnswer] = useState<number | null>(null);
  const [studentNotes, setStudentNotes] = useState("");

  const representation = repChoice === "auto" ? autoRepresentation(session) : repChoice;
  const state = useMemo(
    () => buildNotes(session, { untilT: time + 0.25, level }),
    [session, time, level],
  );
  const liveEvent = useMemo(() => eventAt(session.events, time), [session.events, time]);
  const shown = pinned ?? liveEvent;
  const shownNote = shown?.noteId ? state.byId.get(shown.noteId) : undefined;
  const profile = useMemo(() => scoreStudentNotes(session, studentNotes), [session, studentNotes]);

  const seek = useCallback((t: number) => {
    const a = audioRef.current;
    const next = Math.max(0, t);
    if (a) a.currentTime = next;
    setTime(next);
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onPlay = () => {
      setPlaying(true);
      setPinned(null);
    };
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      setEnded(true);
      setSheet("summary");
    };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  // Question timing: only at flagged assessment moments, never mid-idea.
  useEffect(() => {
    if (questionMode === "off" || question) return;
    const due = session.questions.find(
      (q) => q.t <= time && !asked.includes(q.id) && time - q.t < 6,
    );
    if (!due) return;
    if (questionMode === "adaptive" && due.evidence.requiredNoteIds.some((id) => !state.byId.has(id))) return;
    setAsked((a) => [...a, due.id]);
    setQuestion(due);
    setAnswer(null);
    audioRef.current?.pause();
  }, [time, questionMode, question, asked, session.questions, state]);

  const relationsFor = (noteId: string | null | undefined) =>
    session.relationships.filter((r) => !noteId || r.sourceNoteId === noteId || r.targetNoteId === noteId);

  const noteLabel = (id: string) => {
    const n = state.byId.get(id);
    return n ? textAt(n.variants, level) : id;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <audio ref={audioRef} src={audioSrc} preload="auto" />

      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-card px-5 py-3">
        <div className="mr-auto min-w-0">
          <p className="label">note forge</p>
          <h1 className="truncate text-[22px] leading-tight">{session.title}</h1>
        </div>

        <Select
          label="Mode"
          value={session.mode}
          options={[session.mode]}
          onChange={() => undefined}
          disabled
        />
        <Select
          label="Representation"
          value={repChoice}
          options={REPRESENTATIONS}
          onChange={(v) => setRepChoice(v as NoteRepresentation | "auto")}
        />

        <label className="flex items-center gap-2">
          <span className="label">compression</span>
          <input
            type="range"
            min={25}
            max={100}
            step={25}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
            className="w-28 accent-[var(--color-primary)]"
            aria-label="Compression level"
          />
          <span className="w-10 font-mono text-[12px] text-secondary-foreground">{level}%</span>
        </label>

        <Toggle label="Teacher" on={teacherOn} onClick={() => setTeacherOn((v) => !v)} />
        <Select
          label="Questions"
          value={questionMode}
          options={["off", "occasional", "adaptive"]}
          onChange={(v) => setQuestionMode(v as QuestionMode)}
        />

        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {fmtTime(time)} / {fmtTime(session.durationSec)}
        </span>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-secondary-foreground transition-colors hover:bg-subtle"
        >
          <RotateCcw className="h-3.5 w-3.5" /> New session
        </button>
      </header>

      <nav className="flex items-center gap-1 border-b border-border bg-background px-5 py-2">
        {(
          [
            ["Notes", "none"],
            ["Relations", "organization"],
            ["Replay", "replay"],
            ["Your notes", "student"],
            ["Session", "summary"],
          ] as const
        ).map(([label, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSheet(key as Sheet)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[14px] font-medium transition-colors",
              sheet === key ? "bg-card text-foreground shadow-[var(--shadow-card)]" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        {ended ? (
          <span className="ml-auto font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            recording complete
          </span>
        ) : null}
      </nav>

      <main className="flex min-h-0 flex-1 gap-4 p-4">
        {sheet !== "none" ? (
          <SideSheet title={sheetTitle(sheet)} onClose={() => setSheet("none")}>
            {sheet === "explain" && shown ? (
              <div className="space-y-3">
                <p className="label">{shown.reason.category.replace(/_/g, " ")}</p>
                <p className="text-[16px] leading-relaxed text-foreground">
                  {shown.teaching.detailedExplanation || shown.reason.detailed}
                </p>
                {shown.teaching.principle ? (
                  <p className="border-l-2 border-teacher pl-3 text-[15px] text-secondary-foreground">
                    {shown.teaching.principle}
                  </p>
                ) : null}
                <p className="rounded-md bg-subtle p-3 text-[14px] italic text-muted-foreground">
                  “{shown.source.text}”
                </p>
              </div>
            ) : null}

            {sheet === "organization" ? (
              <div className="space-y-4">
                {relationsFor(selectedNote).length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">
                    No relationships have been established yet. They appear as the speaker reveals them.
                  </p>
                ) : (
                  relationsFor(selectedNote).map((r) => (
                    <div key={r.id} className="rounded-lg border border-border p-3">
                      <p className="text-[16px] text-foreground">{noteLabel(r.sourceNoteId)}</p>
                      <p className="my-1 font-mono text-[11px] uppercase tracking-wider text-update">
                        ↓ {r.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-[16px] text-foreground">{noteLabel(r.targetNoteId)}</p>
                      <p className="mt-2 text-[14px] leading-relaxed text-secondary-foreground">
                        {r.explanation}
                      </p>
                      <button
                        type="button"
                        onClick={() => seek(r.sourceTimestamp)}
                        className="mt-2 font-mono text-[11px] uppercase tracking-wider text-primary"
                      >
                        jump to {fmtTime(r.sourceTimestamp)}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {sheet === "replay" ? (
              <ol className="space-y-1">
                {session.events.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPinned(e);
                        seek(e.timestamp);
                        if (e.noteId) setSelectedNote(e.noteId);
                      }}
                      className="flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-subtle"
                    >
                      <span className="font-mono text-[12px] text-muted-foreground">{fmtTime(e.timestamp)}</span>
                      <span className="w-20 font-mono text-[11px] uppercase tracking-wider text-secondary-foreground">
                        {e.type}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">
                        {e.note ? textAt(e.note.variants, level) : e.reason.short}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : null}

            {sheet === "student" ? (
              <div className="space-y-3">
                <p className="text-[15px] text-secondary-foreground">
                  Take your own notes while you listen, then compare with the expert stream.
                </p>
                <textarea
                  value={studentNotes}
                  onChange={(e) => setStudentNotes(e.target.value)}
                  placeholder={"economic weakness\n  → military funding ↓"}
                  className="h-56 w-full resize-none rounded-lg border border-border bg-card p-3 text-[16px] leading-relaxed"
                />
                {profile ? (
                  <div className="space-y-2">
                    <p className="label">your note-taking profile</p>
                    {(
                      [
                        ["Selection", profile.selection],
                        ["Compression", profile.compression],
                        ["Relationships", profile.relationships],
                        ["Hierarchy", profile.hierarchy],
                        ["Accuracy", profile.accuracy],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <span className="w-28 text-[14px] text-secondary-foreground">{k}</span>
                        <div className="h-[6px] flex-1 rounded-full bg-subtle">
                          <div className="h-[6px] rounded-full bg-primary" style={{ width: `${v}%` }} />
                        </div>
                        <span className="w-8 font-mono text-[12px] text-muted-foreground">{v}</span>
                      </div>
                    ))}
                    <p className="mt-2 rounded-md bg-subtle p-3 text-[15px] leading-relaxed text-foreground">
                      {profile.advice}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {sheet === "summary" ? (
              <div className="space-y-4">
                <p className="text-[16px] leading-relaxed text-foreground">{session.summary.text}</p>
                <div>
                  <p className="label">what this recording asked of you</p>
                  <ul className="mt-2 space-y-1 text-[15px] text-secondary-foreground">
                    {session.metrics.strengths.map((s) => (
                      <li key={s}>✓ {s}</li>
                    ))}
                    {session.metrics.practice.map((s) => (
                      <li key={s}>→ practise: {s}</li>
                    ))}
                  </ul>
                </div>
                <p className="text-[15px] text-secondary-foreground">
                  {session.metrics.informationEvents} information events ·{" "}
                  {session.metrics.relationships} relationships · note density {session.metrics.density}
                </p>
                {session.summary.cues.length ? (
                  <div>
                    <p className="label">recall cues</p>
                    <ul className="mt-2 space-y-1 text-[15px] text-foreground">
                      {session.summary.cues.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </SideSheet>
        ) : null}

        <div className="min-w-0 flex-1">
          <Whiteboard
            session={session}
            state={state}
            level={level}
            representation={representation}
            selectedId={selectedNote}
            liveId={state.latestNoteId}
            empty={state.flat.length === 0}
            onSelect={(id) => {
              setSelectedNote(id);
              const ev = [...session.events].reverse().find((e) => e.noteId === id);
              if (ev) {
                setPinned(ev);
                audioRef.current?.pause();
              }
            }}
          />
        </div>

        {teacherOn ? (
          <div className="hidden w-[340px] shrink-0 lg:block xl:w-[380px]">
            <Instructor
              event={shown}
              noteText={shownNote ? textAt(shownNote.variants, level) : null}
              onOrganization={() => {
                setSelectedNote(shown?.noteId ?? null);
                setSheet("organization");
              }}
              onExplain={() => setSheet("explain")}
            />
          </div>
        ) : null}
      </main>

      <footer className="px-4 pb-4">
        <TransportBar
          session={session}
          time={time}
          playing={playing}
          rate={rate}
          onRate={setRate}
          onToggle={() => (playing ? audioRef.current?.pause() : void audioRef.current?.play())}
          onSeek={seek}
          selectedEventId={shown?.id ?? null}
          onSelectEvent={(e) => {
            setPinned(e);
            seek(e.timestamp);
            if (e.noteId) setSelectedNote(e.noteId);
            audioRef.current?.pause();
          }}
        />
      </footer>

      {question ? (
        <QuestionOverlay
          question={question}
          answer={answer}
          capturedNoteIds={[...state.byId.keys()]}
          noteLabel={noteLabel}
          onAnswer={setAnswer}
          onClose={() => {
            setQuestion(null);
            setAnswer(null);
            void audioRef.current?.play();
          }}
        />
      ) : null}
    </div>
  );
}

function sheetTitle(s: Sheet) {
  return s === "explain"
    ? "Why I skipped this"
    : s === "organization"
      ? "Organization"
      : s === "replay"
        ? "Decision replay"
        : s === "student"
          ? "Your notes"
          : "Session";
}

function SideSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside className="surface hidden w-[320px] shrink-0 flex-col overflow-y-auto p-5 md:flex">
      <div className="mb-3 flex items-center justify-between">
        <p className="label">{title}</p>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1 hover:bg-subtle">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {children}
    </aside>
  );
}

function QuestionOverlay({
  question,
  answer,
  capturedNoteIds,
  noteLabel,
  onAnswer,
  onClose,
}: {
  question: Question;
  answer: number | null;
  capturedNoteIds: string[];
  noteLabel: (id: string) => string;
  onAnswer: (i: number) => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<number | null>(null);
  const missing = question.evidence.requiredNoteIds.filter((id) => !capturedNoteIds.includes(id));
  const have = question.evidence.requiredNoteIds.filter((id) => capturedNoteIds.includes(id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-6">
      <div role="dialog" aria-modal="true" className="surface w-full max-w-xl p-6">
        <p className="label text-question">{question.kind.replace(/_/g, " ")} question</p>
        <h2 className="mt-2 text-[24px] leading-snug">{question.prompt}</h2>
        <div className="mt-4 space-y-2">
          {question.options.map((o, i) => (
            <button
              key={o}
              type="button"
              onClick={() => setChoice(i)}
              disabled={answer !== null}
              className={cn(
                "block w-full rounded-lg border px-4 py-2.5 text-left text-[16px] transition-colors",
                choice === i ? "border-primary bg-write-soft" : "border-border hover:bg-subtle",
                answer !== null && i === question.answerIndex && "border-update bg-update-soft",
              )}
            >
              <span className="mr-2 font-mono text-[12px] text-muted-foreground">
                {String.fromCharCode(65 + i)}
              </span>
              {o}
            </button>
          ))}
        </div>

        {answer === null ? (
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[14px] text-muted-foreground">
              Skip
            </button>
            <button
              type="button"
              disabled={choice === null}
              onClick={() => onAnswer(choice!)}
              className="rounded-md bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-[16px] leading-relaxed text-foreground">{question.explanation}</p>
            <div className="rounded-lg bg-subtle p-3 text-[15px]">
              <p className="text-update">
                Your notes contained: {have.map(noteLabel).join(", ") || "—"}
              </p>
              {missing.length ? (
                <p className="mt-1 text-question">Missing: {missing.map(noteLabel).join(", ")}</p>
              ) : null}
            </div>
            <p className="border-l-2 border-teacher pl-3 text-[15px] text-secondary-foreground">
              {question.lesson}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-primary px-4 py-2 text-[14px] font-medium text-primary-foreground"
              >
                Continue listening
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="label">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-[14px] capitalize text-foreground disabled:opacity-70"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex items-center gap-2 text-[14px] text-secondary-foreground"
    >
      <span className="label">{label}</span>
      <span className={cn("h-3 w-3 rounded-full border", on ? "border-primary bg-primary" : "border-border bg-card")} />
    </button>
  );
}
