import type { Analysis, DecisionEvent, NoteNode, Segment } from "./types";

/**
 * Fold the decision stream into a living note state.
 * `untilT` lets the UI replay the notebook exactly as it existed at any moment.
 */
export function foldNotes(events: DecisionEvent[], untilT = Infinity): NoteNode[] {
  const byId = new Map<string, NoteNode>();
  const order: string[] = [];

  for (const e of events) {
    if (e.t > untilT) break;
    const op = e.note;
    if (!op) continue;
    if (e.decision === "skip" || e.decision === "wait") continue;

    const existing = byId.get(op.id);
    if (existing) {
      existing.text = op.text;
      existing.star = op.star ?? existing.star;
      existing.kind = op.kind ?? existing.kind;
      existing.lastT = e.t;
      existing.revisions += 1;
    } else {
      byId.set(op.id, {
        ...op,
        children: [],
        firstT: e.t,
        lastT: e.t,
        revisions: 0,
      });
      order.push(op.id);
    }
  }

  const roots: NoteNode[] = [];
  for (const id of order) {
    const node = byId.get(id)!;
    node.children = [];
  }
  for (const id of order) {
    const node = byId.get(id)!;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function eventsUpTo(events: DecisionEvent[], t: number) {
  return events.filter((e) => e.t <= t);
}

export function activeSegment(segments: Segment[], t: number): Segment | undefined {
  return segments.find((s) => t >= s.t && t < s.end) ?? [...segments].reverse().find((s) => s.t <= t);
}

export function stats(analysis: Analysis) {
  const written = analysis.events.filter((e) => e.decision === "write").length;
  const updated = analysis.events.filter((e) => e.decision === "update" || e.decision === "connect").length;
  const skipped = analysis.events.filter((e) => e.decision === "skip" || e.decision === "wait").length;
  const total = analysis.events.length || 1;
  return {
    written,
    updated,
    skipped,
    selectivity: Math.round((skipped / total) * 100),
    perMinute: analysis.durationSec ? (written + updated) / (analysis.durationSec / 60) : 0,
  };
}

export function fmtTime(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
