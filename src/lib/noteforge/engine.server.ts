// Server-only NoteForge engine: perception -> discourse/importance/decision
// -> compression -> organization -> teaching. Never imported by the client.

import { perceptionPrompt, policyPrompt } from "./prompts";
import type {
  AudioSignals,
  CompressionVariants,
  Mode,
  NoteForgeEvent,
  NoteForgeSession,
  NoteOp,
  NoteRepresentation,
  OrganizationRelation,
  Question,
  QuestionType,
  RelationshipType,
  Segment,
  SemanticType,
} from "./types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

type ChatMessage = { role: "system" | "user"; content: unknown };

export async function chat(messages: ChatMessage[], apiKey: string): Promise<string> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: MODEL, messages, response_format: { type: "json_object" } }),
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

export function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("The engine returned an unreadable response. Try again.");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: unknown, f = 0.5) => Math.min(1, Math.max(0, num(v, f)));
const str = (v: unknown, f = "") => (typeof v === "string" && v.trim() ? v.trim() : f);
const strArr = (v: unknown, max = 8): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max) : [];
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/* ------------------------------------------------------------------ perception */

export function normalizeSegments(raw: unknown, durationSec: number): Segment[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((s, i) => {
      const o = rec(s);
      const p = rec(o["prosody"]);
      const t = Math.min(num(o["t"]), durationSec);
      return {
        id: str(o["id"], `s${i + 1}`),
        t,
        end: Math.min(Math.max(num(o["end"], t + 4), t + 0.5), durationSec),
        speaker: str(o["speaker"], "S1"),
        text: str(o["text"]),
        discourse: strArr(o["discourse"], 3) as Segment["discourse"],
        prosody: {
          emphasis: clamp01(p["emphasis"]),
          pauseAfter: num(p["pauseAfter"]),
          rate: (["slow", "normal", "fast"].includes(String(p["rate"])) ? p["rate"] : "normal") as Segment["prosody"]["rate"],
          pitch: (["flat", "rising", "falling", "wide"].includes(String(p["pitch"]))
            ? p["pitch"]
            : "flat") as Segment["prosody"]["pitch"],
          cues: strArr(p["cues"], 3),
        },
      } satisfies Segment;
    })
    .filter((s) => s.text.length > 0)
    .sort((a, b) => a.t - b.t);
}

/* ------------------------------------------------------------------ policy */

const DECISIONS = ["write", "skip", "update", "connect", "wait", "question"] as const;
const SEMANTIC: SemanticType[] = [
  "topic", "concept", "definition", "cause", "effect", "example", "contrast", "process",
  "classification", "claim", "evidence", "summary", "question", "decision", "action",
  "deadline", "constraint", "commitment", "change",
];
const RELATIONS: RelationshipType[] = [
  "causes", "caused_by", "leads_to", "result_of", "contrasts_with", "similar_to", "example_of",
  "supports", "explains", "part_of", "contains", "precedes", "follows", "updates", "qualifies", "depends_on",
];
const QUESTION_KINDS: QuestionType[] = [
  "detail", "main_idea", "inference", "purpose", "organization", "relationship",
  "sequence", "example", "connecting_information",
];
const REPRESENTATIONS: NoteRepresentation[] = [
  "linear", "outline", "tree", "mindmap", "flow", "cornell", "compression",
];

function variants(raw: unknown, fallback: string): CompressionVariants {
  const o = rec(raw);
  const expanded = str(o["expanded"], fallback).slice(0, 90);
  const standard = str(o["standard"], expanded).slice(0, 70);
  const expert = str(o["expert"], standard).slice(0, 54);
  const extreme = str(o["extreme"], expert).slice(0, 44);
  return { expanded, standard, expert, extreme };
}

export function normalizePolicy(
  raw: unknown,
  segments: Segment[],
): { events: NoteForgeEvent[]; relationships: OrganizationRelation[] } {
  const list = Array.isArray(raw) ? raw : [];
  const segById = new Map(segments.map((s) => [s.id, s]));
  const relationships: OrganizationRelation[] = [];
  const knownNotes = new Set<string>();

  const events = list
    .map((e, i): NoteForgeEvent => {
      const o = rec(e);
      const segId = str(o["segId"], segments[i]?.id ?? `s${i + 1}`);
      const seg = segById.get(segId) ?? segments[i];
      const t = num(o["t"], seg?.t ?? 0);
      let type = (DECISIONS.includes(o["type"] as never) ? o["type"] : "skip") as NoteForgeEvent["type"];
      const reason = rec(o["reason"]);
      const teaching = rec(o["teaching"]);
      const noteRaw = rec(o["note"]);
      const signals = rec(o["audioSignals"]);

      let note: NoteOp | undefined;
      const hasNote = typeof noteRaw["variants"] === "object" || typeof noteRaw["id"] === "string";
      if (hasNote && (type === "write" || type === "update" || type === "connect")) {
        const id = str(noteRaw["id"], `n${i + 1}`);
        const parentRaw = noteRaw["parentId"];
        const parentId = typeof parentRaw === "string" && parentRaw && parentRaw !== id && knownNotes.has(parentRaw)
          ? parentRaw
          : null;
        note = {
          id,
          parentId,
          semanticType: (SEMANTIC.includes(noteRaw["semanticType"] as SemanticType)
            ? noteRaw["semanticType"]
            : "concept") as SemanticType,
          variants: variants(noteRaw["variants"], str(seg?.text, "note").slice(0, 80)),
          cue: str(noteRaw["cue"]) || undefined,
          owner: str(noteRaw["owner"]) || undefined,
          star: noteRaw["star"] === true,
        };
        if (type === "update" && !knownNotes.has(id)) type = "write";
        knownNotes.add(id);
      } else if (type === "write" || type === "update" || type === "connect") {
        type = "skip";
      }

      const audioSignals: AudioSignals | undefined =
        Object.keys(signals).length > 0
          ? {
              lexical: str(signals["lexical"]) || undefined,
              tempo: str(signals["tempo"]) || undefined,
              pitch: str(signals["pitch"]) || undefined,
              emphasis: str(signals["emphasis"]) || undefined,
              impact: str(signals["impact"]) || undefined,
            }
          : undefined;

      const event: NoteForgeEvent = {
        id: `e${i + 1}`,
        timestamp: t,
        segId,
        type,
        importance: clamp01(o["importance"]),
        confidence: clamp01(o["confidence"]),
        attention: clamp01(o["attention"], 0.5),
        listeningFor: strArr(o["listeningFor"], 4),
        source: {
          start: seg?.t ?? t,
          end: seg?.end ?? t + 3,
          speaker: seg?.speaker ?? "S1",
          text: seg?.text ?? "",
        },
        reason: {
          category: str(reason["category"], type === "skip" ? "low_information" : type),
          short: str(reason["short"], str(teaching["shortExplanation"])),
          detailed: str(reason["detailed"], str(teaching["detailedExplanation"])),
        },
        teaching: {
          headline: str(teaching["headline"], type === "skip" ? "Skipped" : "Decision"),
          shortExplanation: str(teaching["shortExplanation"]),
          detailedExplanation: str(teaching["detailedExplanation"]),
          principle: str(teaching["principle"]),
          preserved: strArr(teaching["preserved"], 6),
          removed: strArr(teaching["removed"], 6),
          organization: str(teaching["organization"]) || undefined,
          audioEvidence: str(teaching["audioEvidence"]) || undefined,
        },
        ...(note ? { note, noteId: note.id } : {}),
        ...(audioSignals ? { audioSignals } : {}),
      };

      const org = rec(o["organization"]);
      const src = str(org["sourceNoteId"]);
      const tgt = str(org["targetNoteId"]);
      if (src && tgt && src !== tgt && knownNotes.has(src) && knownNotes.has(tgt)) {
        const relation: OrganizationRelation = {
          id: `r${relationships.length + 1}`,
          sourceNoteId: src,
          targetNoteId: tgt,
          type: (RELATIONS.includes(org["type"] as RelationshipType) ? org["type"] : "leads_to") as RelationshipType,
          explanation: str(org["explanation"]),
          sourceTimestamp: t,
          targetTimestamp: t,
        };
        relationships.push(relation);
        event.organization = relation;
        event.relatedNoteIds = [src, tgt];
      }

      return event;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  return { events, relationships };
}

export function normalizeQuestions(raw: unknown, noteIds: Set<string>): Question[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((q, i): Question => {
      const o = rec(q);
      const ev = rec(o["evidence"]);
      const options = strArr(o["options"], 4);
      while (options.length < 4) options.push("—");
      return {
        id: `q${i + 1}`,
        t: num(o["t"]),
        kind: (QUESTION_KINDS.includes(o["kind"] as QuestionType) ? o["kind"] : "detail") as QuestionType,
        prompt: str(o["prompt"]),
        options,
        answerIndex: Math.min(3, Math.max(0, Math.round(num(o["answerIndex"])))),
        explanation: str(o["explanation"]),
        lesson: str(o["lesson"]),
        evidence: {
          requiredNoteIds: strArr(ev["requiredNoteIds"], 6).filter((id) => noteIds.has(id)),
          requiredRelationshipIds: strArr(ev["requiredRelationshipIds"], 6),
        },
      };
    })
    .filter((q) => q.prompt.length > 0)
    .sort((a, b) => a.t - b.t);
}

/* ------------------------------------------------------------------ pipeline */

export async function runSession(input: {
  mode: Mode;
  format: string;
  audioBase64: string;
  durationSec: number;
}): Promise<NoteForgeSession> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this project yet.");

  const perception = parseJson<{ title?: string; subject?: string; segments?: unknown }>(
    await chat(
      [
        { role: "system", content: perceptionPrompt(input.mode) },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `This recording is ${Math.round(input.durationSec)} seconds long. Segment it into information events and report delivery.`,
            },
            { type: "input_audio", input_audio: { data: input.audioBase64, format: input.format } },
          ],
        },
      ],
      apiKey,
    ),
  );

  const segments = normalizeSegments(perception.segments, input.durationSec);
  if (segments.length === 0) throw new Error("No speech was detected in that recording.");

  const policy = parseJson<{
    events?: unknown;
    questions?: unknown;
    summary?: unknown;
    metrics?: unknown;
    suggestedRepresentation?: unknown;
  }>(
    await chat(
      [
        { role: "system", content: policyPrompt(input.mode, input.durationSec) },
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

  const { events, relationships } = normalizePolicy(policy.events, segments);
  const noteIds = new Set(events.filter((e) => e.note).map((e) => e.note!.id));
  const questions = normalizeQuestions(policy.questions, noteIds);
  const summary = rec(policy.summary);
  const metrics = rec(policy.metrics);

  return {
    version: 2,
    mode: input.mode,
    title: str(perception.title, "Untitled recording"),
    subject: str(perception.subject) || undefined,
    durationSec: input.durationSec,
    segments,
    events,
    relationships,
    questions,
    summary: {
      text: str(summary["text"]),
      cues: strArr(summary["cues"], 6),
    },
    metrics: {
      strengths: strArr(metrics["strengths"], 3),
      practice: strArr(metrics["practice"], 3),
      informationEvents: Math.round(num(metrics["informationEvents"], events.length)),
      relationships: Math.round(num(metrics["relationships"], relationships.length)),
      examples: Math.round(num(metrics["examples"])),
      density: (["low", "moderate", "high"].includes(String(metrics["density"]))
        ? metrics["density"]
        : "moderate") as NoteForgeSession["metrics"]["density"],
    },
    suggestedRepresentation: (REPRESENTATIONS.includes(policy.suggestedRepresentation as NoteRepresentation)
      ? policy.suggestedRepresentation
      : "linear") as NoteRepresentation,
  };
}
