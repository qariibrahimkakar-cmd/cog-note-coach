// NoteForge 2.0 core data model.
//
// Pipeline:
//   AUDIO -> PERCEPTION -> INFORMATION EVENT -> IMPORTANCE -> NOTE DECISION
//         -> COMPRESSION -> ORGANIZATION -> NOTE -> TEACHER EXPLANATION
//
// Transcription is a perception SENSOR. It is never the note architecture.

export type Mode = "lecture" | "conversation";

/* ------------------------------------------------------------------ perception */

export type Prosody = {
  emphasis: number; // 0..1 acoustic prominence
  pauseAfter: number; // seconds of silence after the segment
  rate: "slow" | "normal" | "fast";
  pitch: "flat" | "rising" | "falling" | "wide";
  cues: string[];
};

export type DiscourseEvent =
  | "topic_start"
  | "topic_shift"
  | "definition"
  | "list_start"
  | "list_item"
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
  | "commitment"
  | "speaker_change";

export type Segment = {
  id: string;
  t: number;
  end: number;
  speaker: string;
  text: string; // sensor output, not the note
  discourse: DiscourseEvent[];
  prosody: Prosody;
};

/* ------------------------------------------------------------------ decisions */

export type NoteDecision = "write" | "skip" | "update" | "connect" | "wait" | "question";

export type SkipReason =
  | "repetition"
  | "elaboration"
  | "background"
  | "conversational_bridge"
  | "low_information"
  | "already_captured"
  | "minor_example"
  | "obvious_inference"
  | "redundant_wording";

export type RelationshipType =
  | "causes"
  | "caused_by"
  | "leads_to"
  | "result_of"
  | "contrasts_with"
  | "similar_to"
  | "example_of"
  | "supports"
  | "explains"
  | "part_of"
  | "contains"
  | "precedes"
  | "follows"
  | "updates"
  | "qualifies"
  | "depends_on";

export type SemanticType =
  | "topic"
  | "concept"
  | "definition"
  | "cause"
  | "effect"
  | "example"
  | "contrast"
  | "process"
  | "classification"
  | "claim"
  | "evidence"
  | "summary"
  | "question"
  // conversation state
  | "decision"
  | "action"
  | "deadline"
  | "constraint"
  | "commitment"
  | "change";

/* ------------------------------------------------------------------ notes */

export type NoteRepresentation =
  | "linear"
  | "outline"
  | "tree"
  | "mindmap"
  | "flow"
  | "cornell"
  | "compression";

export type CompressionLevel = 25 | 50 | 75 | 100;

/** Four genuinely different representations of the same information event. */
export type CompressionVariants = {
  expanded: string; // 25% — natural concise phrase
  standard: string; // 50% — student notes, arrows appear
  expert: string; // 75% — abbreviations + symbols
  extreme: string; // 100% — dense symbolic notation
};

export type NoteOp = {
  id: string;
  parentId: string | null;
  semanticType: SemanticType;
  variants: CompressionVariants;
  cue?: string | undefined; // Cornell cue-column question
  star?: boolean | undefined;
  owner?: string | undefined; // conversation mode
};

export type Note = NoteOp & {
  children: Note[];
  depth: number;
  index: number; // sibling order
  importance: number;
  firstT: number;
  lastT: number;
  revisions: number;
  previousText?: string | undefined; // pre-update text (standard variant)
  relatedIds: string[];
  eventIds: string[];
  edited?: boolean;
  flagged?: boolean;
  pinned?: boolean;
};

/* ------------------------------------------------------------------ teaching */

export type TeacherExplanation = {
  headline: string;
  shortExplanation: string;
  detailedExplanation: string;
  principle: string;
  preserved?: string[];
  removed?: string[];
  organization?: string | undefined;
  audioEvidence?: string | undefined;
};

export type AudioSignals = {
  lexical?: string | undefined;
  tempo?: string | undefined;
  pitch?: string | undefined;
  emphasis?: string | undefined;
  impact?: string | undefined;
};

export type OrganizationRelation = {
  id: string;
  sourceNoteId: string;
  targetNoteId: string;
  type: RelationshipType;
  explanation: string;
  sourceTimestamp: number;
  targetTimestamp: number;
};

export type NoteForgeEvent = {
  id: string;
  timestamp: number;
  type: NoteDecision;
  importance: number; // internal signal
  confidence: number; // internal signal
  segId: string;
  source: { start: number; end: number; speaker: string; text: string };
  reason: { category: string; short: string; detailed: string };
  noteId?: string | undefined;
  relatedNoteIds?: string[];
  organization?: OrganizationRelation | undefined;
  note?: NoteOp | undefined;
  teaching: TeacherExplanation;
  audioSignals?: AudioSignals | undefined;
  listeningFor?: string[]; // what the expert is scanning for next
  attention?: number | undefined; // 0..1 cognitive attention spent
};

/* ------------------------------------------------------------------ questions */

export type QuestionType =
  | "detail"
  | "main_idea"
  | "inference"
  | "purpose"
  | "organization"
  | "relationship"
  | "sequence"
  | "example"
  | "connecting_information";

export type QuestionEvidence = {
  requiredNoteIds: string[];
  requiredRelationshipIds?: string[];
};

export type Question = {
  id: string;
  t: number;
  kind: QuestionType;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  evidence: QuestionEvidence;
  lesson: string;
};

/* ------------------------------------------------------------------ session */

export type SessionMetrics = {
  strengths: string[];
  practice: string[];
  informationEvents: number;
  relationships: number;
  examples: number;
  density: "low" | "moderate" | "high";
};

export type NoteForgeSession = {
  version: 2;
  mode: Mode;
  title: string;
  subject?: string | undefined;
  durationSec: number;
  segments: Segment[];
  events: NoteForgeEvent[];
  relationships: OrganizationRelation[];
  questions: Question[];
  summary: { text: string; cues: string[] };
  metrics: SessionMetrics;
  suggestedRepresentation: NoteRepresentation;
};

/** Legacy alias kept so existing imports keep type-checking. */
export type Analysis = NoteForgeSession;

export type StudentProfile = {
  selection: number;
  compression: number;
  relationships: number;
  hierarchy: number;
  accuracy: number;
  redundancy: number;
  advice: string;
};
