// NoteForge core data model.
// The pipeline is: audio -> perception (segments + prosody) -> policy (decisions)
// -> note state. The transcript is a SENSOR inside perception, never the brain.

export type Mode = "lecture" | "conversation";

export type Prosody = {
  emphasis: number; // 0..1 acoustic stress / loudness prominence
  pauseAfter: number; // seconds of silence following the segment
  rate: "slow" | "normal" | "fast";
  pitch: "flat" | "rising" | "falling" | "wide";
  cues: string[]; // e.g. "contrastive stress on 'most'", "hesitation", "self-repair"
};

export type DiscourseEvent =
  | "topic_start"
  | "topic_shift"
  | "definition"
  | "list_start"
  | "new_point"
  | "example"
  | "cause"
  | "effect"
  | "contrast"
  | "comparison"
  | "process"
  | "classification"
  | "elaboration"
  | "repetition"
  | "correction"
  | "summary"
  | "emphasis"
  | "conclusion"
  | "filler"
  // conversation ontology
  | "question"
  | "answer"
  | "request"
  | "proposal"
  | "acceptance"
  | "rejection"
  | "negotiation"
  | "decision"
  | "task"
  | "deadline"
  | "constraint"
  | "preference"
  | "change"
  | "commitment";

export type Segment = {
  id: string;
  t: number; // start seconds
  end: number;
  speaker: string; // "S1", "Professor", "Sara"...
  text: string; // sensor output, not the note
  discourse: DiscourseEvent[];
  prosody: Prosody;
};

export type NoteKind =
  | "heading"
  | "item" // numbered / enumerated child
  | "bullet"
  | "relation" // A -> B chain
  | "definition"
  | "action";

export type NoteOp = {
  id: string; // note id (stable, reused by update)
  parentId: string | null;
  kind: NoteKind;
  text: string; // compressed note text, may contain "→", "↓", "≠"
  star?: boolean | undefined;
};

export type Decision = "write" | "skip" | "update" | "connect" | "wait";

export type DecisionEvent = {
  segId: string;
  t: number;
  decision: Decision;
  eventType: DiscourseEvent;
  importance: number; // 0..1
  confidence: number; // 0..1
  triggers: string[]; // "new_major_topic", "enumerated_point", "prosodic_emphasis"
  note?: NoteOp; // present for write / update / connect
  compression?: { preserved: string[]; removed: string[] };
  teacher: {
    why: string; // why this decision was made
    rule: string; // the transferable note-taking principle
    ignored?: string; // what was deliberately not written
  };
};

export type Analysis = {
  mode: Mode;
  title: string;
  durationSec: number;
  segments: Segment[];
  events: DecisionEvent[];
};

/** Rendered note state: a tree folded from the ops up to a point in time. */
export type NoteNode = NoteOp & {
  children: NoteNode[];
  firstT: number;
  lastT: number;
  revisions: number;
};
