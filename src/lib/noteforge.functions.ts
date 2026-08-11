import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { perceptionPrompt, policyPrompt } from "./noteforge/prompts";
import type { Analysis, DecisionEvent, Mode, Segment } from "./noteforge/types";

const Input = z.object({
  mode: z.enum(["lecture", "conversation"]),
  format: z.enum(["mp3", "wav", "webm", "m4a", "ogg"]),
  audioBase64: z.string().min(100),
  durationSec: z.number().min(1).max(1800),
});

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

type ChatMessage = { role: "system" | "user"; content: unknown };

async function chat(messages: ChatMessage[], apiKey: string): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("RATE_LIMIT: too many requests right now — try again in a moment.");
    if (res.status === 402) throw new Error("NO_CREDITS: AI credits are exhausted for this workspace.");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The engine returned an unreadable response. Try again.");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: unknown) => Math.min(1, Math.max(0, num(v, 0.5)));
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 6) : [];

function normalizeSegments(raw: unknown, durationSec: number): Segment[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((s, i) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const p = (o["prosody"] ?? {}) as Record<string, unknown>;
      const t = Math.min(num(o["t"]), durationSec);
      return {
        id: typeof o["id"] === "string" ? o["id"] : `s${i + 1}`,
        t,
        end: Math.min(Math.max(num(o["end"], t + 4), t + 0.5), durationSec),
        speaker: typeof o["speaker"] === "string" ? o["speaker"] : "S1",
        text: typeof o["text"] === "string" ? o["text"] : "",
        discourse: strArr(o["discourse"]) as Segment["discourse"],
        prosody: {
          emphasis: clamp01(p["emphasis"]),
          pauseAfter: num(p["pauseAfter"]),
          rate: (["slow", "normal", "fast"].includes(String(p["rate"])) ? p["rate"] : "normal") as Segment["prosody"]["rate"],
          pitch: (["flat", "rising", "falling", "wide"].includes(String(p["pitch"])) ? p["pitch"] : "flat") as Segment["prosody"]["pitch"],
          cues: strArr(p["cues"]),
        },
      } satisfies Segment;
    })
    .filter((s) => s.text.length > 0)
    .sort((a, b) => a.t - b.t);
}

const DECISIONS = ["write", "skip", "update", "connect", "wait"] as const;
const KINDS = ["heading", "item", "bullet", "relation", "definition", "action"] as const;

function normalizeEvents(raw: unknown, segments: Segment[]): DecisionEvent[] {
  const list = Array.isArray(raw) ? raw : [];
  const segById = new Map(segments.map((s) => [s.id, s]));
  return list
    .map((e, i) => {
      const o = (e ?? {}) as Record<string, unknown>;
      const segId = typeof o["segId"] === "string" ? o["segId"] : segments[i]?.id ?? `s${i + 1}`;
      const seg = segById.get(segId);
      const decision = (DECISIONS.includes(o["decision"] as never) ? o["decision"] : "skip") as DecisionEvent["decision"];
      const teacher = (o["teacher"] ?? {}) as Record<string, unknown>;
      const noteRaw = o["note"] as Record<string, unknown> | undefined;
      const comp = o["compression"] as Record<string, unknown> | undefined;

      const event: DecisionEvent = {
        segId,
        t: num(o["t"], seg?.t ?? 0),
        decision,
        eventType: (typeof o["eventType"] === "string" ? o["eventType"] : "elaboration") as DecisionEvent["eventType"],
        importance: clamp01(o["importance"]),
        confidence: clamp01(o["confidence"]),
        triggers: strArr(o["triggers"]),
        teacher: {
          why: typeof teacher["why"] === "string" ? teacher["why"] : "",
          rule: typeof teacher["rule"] === "string" ? teacher["rule"] : "",
          ...(typeof teacher["ignored"] === "string" && teacher["ignored"]
            ? { ignored: teacher["ignored"] }
            : {}),
        },
      };

      if (noteRaw && decision !== "skip" && decision !== "wait" && typeof noteRaw["text"] === "string") {
        event.note = {
          id: typeof noteRaw["id"] === "string" ? noteRaw["id"] : `n${i + 1}`,
          parentId: typeof noteRaw["parentId"] === "string" ? noteRaw["parentId"] : null,
          kind: (KINDS.includes(noteRaw["kind"] as never)
            ? noteRaw["kind"]
            : "bullet") as NonNullable<DecisionEvent["note"]>["kind"],
          text: String(noteRaw["text"]).slice(0, 120),
          star: noteRaw["star"] === true,
        };
        if (comp) {
          event.compression = { preserved: strArr(comp["preserved"]), removed: strArr(comp["removed"]) };
        }
      }
      return event;
    })
    .sort((a, b) => a.t - b.t);
}

/**
 * Two-pass engine.
 * Pass 1 hears the audio (words + prosody). Pass 2 never hears audio — it only
 * makes note-taking decisions over perceived events. Transcript = sensor.
 */
export const analyzeRecording = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<Analysis> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const mode = data.mode as Mode;

    const perception = parseJson<{ title?: string; segments?: unknown }>(
      await chat(
        [
          { role: "system", content: perceptionPrompt(mode) },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This recording is ${Math.round(data.durationSec)} seconds long. Segment it and report delivery.`,
              },
              { type: "input_audio", input_audio: { data: data.audioBase64, format: data.format } },
            ],
          },
        ],
        apiKey,
      ),
    );

    const segments = normalizeSegments(perception.segments, data.durationSec);
    if (segments.length === 0) throw new Error("No speech was detected in that recording.");

    const policy = parseJson<{ events?: unknown }>(
      await chat(
        [
          { role: "system", content: policyPrompt(mode, data.durationSec) },
          {
            role: "user",
            content: JSON.stringify(
              segments.map((s) => ({
                id: s.id,
                t: s.t,
                speaker: s.speaker,
                text: s.text,
                discourse: s.discourse,
                prosody: s.prosody,
              })),
            ),
          },
        ],
        apiKey,
      ),
    );

    return {
      mode,
      title: typeof perception.title === "string" && perception.title ? perception.title : "Untitled recording",
      durationSec: data.durationSec,
      segments,
      events: normalizeEvents(policy.events, segments),
    };
  });
