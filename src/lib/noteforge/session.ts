import type {
  CompressionLevel,
  CompressionVariants,
  Note,
  NoteForgeEvent,
  NoteForgeSession,
  NoteRepresentation,
  Segment,
  StudentProfile,
} from "./types";

export const COMPRESSION_LEVELS: CompressionLevel[] = [25, 50, 75, 100];

export function variantKey(level: number): keyof CompressionVariants {
  if (level <= 25) return "expanded";
  if (level <= 50) return "standard";
  if (level <= 75) return "expert";
  return "extreme";
}

export function textAt(variants: CompressionVariants, level: number): string {
  const key = variantKey(level);
  return (
    variants[key] ||
    variants.standard ||
    variants.expanded ||
    variants.expert ||
    variants.extreme ||
    ""
  );
}

/**
 * Higher compression does NOT mean fewer ideas — it means more information
 * represented in fewer characters, so the importance floor DROPS as
 * compression rises.
 */
export function importanceFloor(level: number): number {
  if (level <= 25) return 0.55;
  if (level <= 50) return 0.42;
  if (level <= 75) return 0.28;
  return 0.12;
}

type BuildOptions = {
  untilT?: number;
  level: number;
  overrides?: Record<string, { text?: string; flagged?: boolean; pinned?: boolean; deleted?: boolean }>;
};

export type NoteState = {
  roots: Note[];
  flat: Note[];
  byId: Map<string, Note>;
  latestNoteId: string | null;
};

/** Fold the decision stream into the notebook exactly as it stood at `untilT`. */
export function buildNotes(session: NoteForgeSession, opts: BuildOptions): NoteState {
  const untilT = opts.untilT ?? Infinity;
  const floor = importanceFloor(opts.level);
  const byId = new Map<string, Note>();
  const order: string[] = [];
  let latestNoteId: string | null = null;

  for (const e of session.events) {
    if (e.timestamp > untilT) break;
    const op = e.note;
    if (!op) continue;
    if (e.type === "skip" || e.type === "wait" || e.type === "question") continue;

    const existing = byId.get(op.id);
    if (existing) {
      existing.previousText = existing.variants.standard;
      existing.variants = op.variants;
      existing.semanticType = op.semanticType ?? existing.semanticType;
      existing.cue = op.cue ?? existing.cue;
      existing.star = op.star ?? existing.star;
      existing.owner = op.owner ?? existing.owner;
      existing.lastT = e.timestamp;
      existing.revisions += 1;
      existing.importance = Math.max(existing.importance, e.importance);
      existing.eventIds.push(e.id);
      latestNoteId = op.id;
    } else {
      byId.set(op.id, {
        ...op,
        children: [],
        depth: 0,
        index: 0,
        importance: e.importance,
        firstT: e.timestamp,
        lastT: e.timestamp,
        revisions: 0,
        relatedIds: [],
        eventIds: [e.id],
      });
      order.push(op.id);
      latestNoteId = op.id;
    }
  }

  for (const rel of session.relationships) {
    if (rel.targetTimestamp > untilT) continue;
    const a = byId.get(rel.sourceNoteId);
    const b = byId.get(rel.targetNoteId);
    if (a && b) {
      if (!a.relatedIds.includes(b.id)) a.relatedIds.push(b.id);
      if (!b.relatedIds.includes(a.id)) b.relatedIds.push(a.id);
    }
  }

  // Density filter: keep notes above the floor, and always keep notes that
  // have kept descendants so hierarchy never breaks.
  const kept = new Set<string>();
  for (const id of order) {
    const n = byId.get(id)!;
    const ov = opts.overrides?.[id];
    if (ov?.deleted) continue;
    if (n.importance >= floor || n.star || n.parentId === null || ov?.pinned) kept.add(id);
  }
  for (const id of order) {
    if (!kept.has(id)) continue;
    let p = byId.get(id)!.parentId;
    while (p) {
      kept.add(p);
      p = byId.get(p)?.parentId ?? null;
    }
  }

  const roots: Note[] = [];
  for (const id of order) {
    if (!kept.has(id)) continue;
    const n = byId.get(id)!;
    n.children = [];
    const ov = opts.overrides?.[id];
    if (ov?.text) {
      n.variants = { ...n.variants, [variantKey(opts.level)]: ov.text } as CompressionVariants;
      n.edited = true;
    }
    n.flagged = ov?.flagged ?? false;
    n.pinned = ov?.pinned ?? false;
  }
  for (const id of order) {
    if (!kept.has(id)) continue;
    const n = byId.get(id)!;
    let parentId = n.parentId;
    while (parentId && !kept.has(parentId)) parentId = byId.get(parentId)?.parentId ?? null;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent && parent !== n) {
      n.depth = 0;
      n.index = parent.children.length;
      parent.children.push(n);
    } else {
      n.index = roots.length;
      roots.push(n);
    }
  }

  const flat: Note[] = [];
  const walk = (list: Note[], depth: number) => {
    for (const n of list) {
      n.depth = depth;
      flat.push(n);
      walk(n.children, depth + 1);
    }
  };
  walk(roots, 0);

  const keptMap = new Map(flat.map((n) => [n.id, n]));
  return { roots, flat, byId: keptMap, latestNoteId };
}

export function activeSegment(segments: Segment[], t: number): Segment | undefined {
  return segments.find((s) => t >= s.t && t < s.end) ?? [...segments].reverse().find((s) => s.t <= t);
}

export function eventAt(events: NoteForgeEvent[], t: number): NoteForgeEvent | null {
  const past = events.filter((e) => e.timestamp <= t + 0.25);
  return past.length ? past[past.length - 1]! : null;
}

/** Auto representation: pick the structure the discourse actually has. */
export function autoRepresentation(session: NoteForgeSession): NoteRepresentation {
  if (session.mode === "conversation") return "linear";
  const labels = session.segments.flatMap((s) => s.discourse);
  const count = (...keys: string[]) => labels.filter((l) => keys.includes(l)).length;
  const causal = count("cause", "effect", "process");
  const classification = count("classification", "list_start", "list_item");
  const contrast = count("contrast", "comparison");
  const topics = count("topic_start", "topic_shift");
  if (causal >= 3 && causal >= classification) return "flow";
  if (classification >= 3) return "tree";
  if (topics >= 3 && contrast >= 1) return "mindmap";
  if (classification >= 2) return "outline";
  return session.suggestedRepresentation ?? "linear";
}

export function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Multi-dimensional comparison of student notes against the expert stream. */
export function scoreStudentNotes(session: NoteForgeSession, raw: string): StudentProfile | null {
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9↑↓→←↔≠≈+/ ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const studentWords = new Set(lines.flatMap(norm));
  const expertNotes = session.events.filter((e) => e.note).map((e) => e.note!);
  const expertConcepts = expertNotes.map((n) => norm(n.variants.expanded || n.variants.standard));

  const covered = expertConcepts.filter((words) =>
    words.some((w) => studentWords.has(w)),
  ).length;
  const coverage = expertConcepts.length ? covered / expertConcepts.length : 0;

  const relationChars = /[→←↔↑↓≠≈]|->|leads|because|causes|due to/i;
  const relLines = lines.filter((l) => relationChars.test(l)).length;
  const relationships = session.relationships.length
    ? Math.min(1, relLines / Math.max(1, session.relationships.length))
    : relLines > 0
      ? 1
      : 0;

  const avgWords = lines.reduce((a, l) => a + norm(l).length, 0) / lines.length;
  const compression = Math.max(0, Math.min(1, 1 - (avgWords - 4) / 12));

  const indented = lines.filter((l) => /^(\s{2,}|[-•*\d]+[.)]?\s)/.test(l)).length;
  const hierarchy = Math.min(1, indented / Math.max(1, lines.length * 0.5));

  const uniq = new Set(lines.map((l) => norm(l).join(" ")));
  const redundancy = uniq.size / lines.length;

  const accuracy = Math.min(1, 0.55 + coverage * 0.45);

  const pct = (n: number) => Math.round(n * 100);
  const profile: StudentProfile = {
    selection: pct(coverage),
    compression: pct(compression),
    relationships: pct(relationships),
    hierarchy: pct(hierarchy),
    accuracy: pct(accuracy),
    redundancy: pct(redundancy),
    advice: "",
  };

  const weakest = (
    [
      ["relationships", profile.relationships, "You identify the right concepts but often drop the relationship between them. Write the arrow, not just the two nouns."],
      ["compression", profile.compression, "Your lines are close to full sentences. Cut grammar words and let symbols carry the meaning."],
      ["hierarchy", profile.hierarchy, "Your notes are flat. Indent sub-points under the concept they belong to so structure survives review."],
      ["selection", profile.selection, "Several major information events never reached your page. Listen for structural signals like 'three reasons' and 'the key point'."],
      ["redundancy", profile.redundancy, "You re-wrote information you already had. Update the existing line instead of adding a new one."],
    ] as const
  ).reduce((min, cur) => (cur[1] < min[1] ? cur : min));
  profile.advice = weakest[2];
  return profile;
}
