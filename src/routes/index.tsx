import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { GraduationCap, MessagesSquare, Upload, Loader2, AudioLines } from "lucide-react";
import { analyzeRecording } from "@/lib/noteforge.functions";
import type { Analysis, Mode } from "@/lib/noteforge/types";
import { Studio } from "@/components/noteforge/Studio";
import { cn } from "@/lib/utils";
import lectureAsset from "@/assets/sample-lecture.mp3.asset.json";
import conversationAsset from "@/assets/sample-conversation.mp3.asset.json";
import uploadAsset from "@/assets/sample-upload.mp3.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NoteForge AI — Learn when, what and how to take notes" },
      {
        name: "description",
        content:
          "NoteForge listens to a lecture or conversation, takes notes like an expert student, and shows you the write / don't-write decision behind every line.",
      },
      { property: "og:title", content: "NoteForge AI — the note-taking teacher" },
      {
        property: "og:description",
        content:
          "An expert student sitting beside you: WRITE, SKIP, UPDATE decisions on real audio, with the reasoning exposed.",
      },
    ],
  }),
  component: Home,
});

type Source = { key: string; label: string; sub: string; url: string; mode: Mode; seconds: number };

const SAMPLES: Source[] = [
  {
    key: "lecture",
    label: "Decline of Rome",
    sub: "academic lecture · 0:50",
    url: lectureAsset.url,
    mode: "lecture",
    seconds: 50,
  },
  {
    key: "conversation",
    label: "Launch sync",
    sub: "2-person meeting · 0:41",
    url: conversationAsset.url,
    mode: "conversation",
    seconds: 41,
  },
  {
    key: "upload",
    label: "Your uploaded clip",
    sub: "unknown content · 0:31",
    url: uploadAsset.url,
    mode: "lecture",
    seconds: 31,
  },
];

function Home() {
  const analyze = useServerFn(analyzeRecording);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("lecture");
  const [selected, setSelected] = useState<string>("lecture");
  const [audioSrc, setAudioSrc] = useState<string>(SAMPLES[0]!.url);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async (payload: {
      audioBase64: string;
      format: "mp3" | "wav" | "webm" | "m4a" | "ogg";
      durationSec: number;
      mode: Mode;
    }) => (await analyze({ data: payload })) as Analysis,
    onSuccess: (a) => setAnalysis(a),
    onError: (e: Error) => setError(e.message.replace(/^[A-Z_]+:\s*/, "")),
  });

  async function toBase64(blob: Blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) {
      bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return btoa(bin);
  }

  function formatOf(type: string, name: string): "mp3" | "wav" | "webm" | "m4a" | "ogg" {
    const t = `${type} ${name}`.toLowerCase();
    if (t.includes("wav")) return "wav";
    if (t.includes("webm")) return "webm";
    if (t.includes("m4a") || t.includes("mp4")) return "m4a";
    if (t.includes("ogg")) return "ogg";
    return "mp3";
  }

  async function durationOf(url: string) {
    return new Promise<number>((resolve) => {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.src = url;
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 60);
      a.onerror = () => resolve(60);
    });
  }

  async function startSample(sample: Source) {
    setError(null);
    setSelected(sample.key);
    setAudioSrc(sample.url);
    const res = await fetch(sample.url);
    const blob = await res.blob();
    run.mutate({
      audioBase64: await toBase64(blob),
      format: "mp3",
      durationSec: Math.round((await durationOf(sample.url)) || sample.seconds),
      mode,
    });
  }

  async function startUpload(file: File) {
    setError(null);
    if (file.size > 12 * 1024 * 1024) {
      setError("That file is larger than 12 MB. Try a shorter clip for now.");
      return;
    }
    const url = URL.createObjectURL(file);
    setSelected("custom");
    setAudioSrc(url);
    run.mutate({
      audioBase64: await toBase64(file),
      format: formatOf(file.type, file.name),
      durationSec: Math.round(await durationOf(url)),
      mode,
    });
  }

  if (analysis) {
    return (
      <Studio
        analysis={analysis}
        audioSrc={audioSrc}
        onReset={() => {
          setAnalysis(null);
          run.reset();
        }}
      />
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-primary">NoteForge AI</p>
      <h1 className="mt-3 max-w-3xl text-4xl leading-[1.1] sm:text-6xl">
        It doesn't tell you what to remember.
        <br />
        <span className="italic text-primary">It shows you how it decides.</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
        NoteForge listens like an expert student with a pen and scarce notebook space. Every few seconds it
        makes a real decision — <span className="text-foreground">write, ignore, update, connect</span> — and
        it will explain the signal it reacted to: the wording, the structure, the pause, the stress in the
        voice.
      </p>

      <section className="mt-10 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["lecture", GraduationCap, "Lecture", "Builds a knowledge structure: concepts, causes, contrasts, hierarchy."],
            ["conversation", MessagesSquare, "Conversation", "Tracks interaction state: decisions, changes, owners, deadlines."],
          ] as const
        ).map(([key, Icon, title, desc]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              "panel flex gap-3 p-5 text-left transition-colors",
              mode === key ? "border-primary" : "hover:border-muted-foreground/40",
            )}
          >
            <Icon className={cn("mt-[2px] h-5 w-5 shrink-0", mode === key ? "text-primary" : "text-muted-foreground")} />
            <span>
              <span className="block font-mono text-[11px] uppercase tracking-[0.2em]">{title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{desc}</span>
            </span>
          </button>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          pick a recording
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={run.isPending}
              onClick={() => startSample(s)}
              className={cn(
                "panel flex flex-col items-start gap-1 p-4 text-left transition-colors disabled:opacity-50",
                selected === s.key ? "border-accent" : "hover:border-muted-foreground/40",
              )}
            >
              <AudioLines className="h-4 w-4 text-accent" />
              <span className="mt-1 text-sm font-medium">{s.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.sub}
              </span>
            </button>
          ))}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void startUpload(f);
          }}
        />
        <button
          type="button"
          disabled={run.isPending}
          onClick={() => fileRef.current?.click()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> or upload your own audio (mp3, wav, m4a · up to 12 MB)
        </button>

        {run.isPending ? (
          <div className="panel mt-4 flex items-center gap-3 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              perception → discourse events → importance → note decision…
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-3">
        {[
          ["It refuses to write", "Most of a lecture is framing, repetition and elaboration. Ignoring it is the skill."],
          ["It edits itself", "A correction updates the existing note instead of appending a new line."],
          ["It hears delivery", "Stress, pauses and pitch nudge importance — but never decide it alone."],
        ].map(([t, d]) => (
          <div key={t}>
            <h3 className="text-lg">{t}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
