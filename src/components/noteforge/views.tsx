import { memo } from "react";
import type { Note, NoteRepresentation, NoteForgeSession, SemanticType } from "@/lib/noteforge/types";
import type { NoteState } from "@/lib/noteforge/session";
import { textAt } from "@/lib/noteforge/session";
import { flowLayout, mindmapLayout, treeLayout, type Layout } from "@/lib/noteforge/layout";
import { cn } from "@/lib/utils";

export type ViewProps = {
  session: NoteForgeSession;
  state: NoteState;
  level: number;
  representation: NoteRepresentation;
  selectedId: string | null;
  liveId: string | null;
  onSelect: (id: string) => void;
};

const TYPE_LABEL: Partial<Record<SemanticType, string>> = {
  definition: "def",
  cause: "cause",
  effect: "effect",
  example: "ex",
  contrast: "vs",
  process: "step",
  classification: "class",
  claim: "claim",
  evidence: "evid",
  summary: "sum",
  decision: "decision",
  action: "task",
  deadline: "due",
  constraint: "limit",
  commitment: "commit",
  change: "change",
};

function accent(n: Note) {
  if (n.semanticType === "topic") return "text-foreground";
  if (n.revisions > 0) return "text-update";
  return "text-foreground";
}

/* --------------------------------------------------------------- primitives */

const NoteText = memo(function NoteText({
  note,
  level,
  className,
}: {
  note: Note;
  level: number;
  className?: string;
}) {
  return (
    <span className={cn("whitespace-pre-wrap", className)}>{textAt(note.variants, level)}</span>
  );
});

const Tag = ({ note }: { note: Note }) => {
  const label = TYPE_LABEL[note.semanticType];
  if (!label) return null;
  return (
    <span className="ml-2 shrink-0 rounded border border-border bg-subtle px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {label}
    </span>
  );
};

function Selectable({
  note,
  liveId,
  selectedId,
  onSelect,
  children,
  className,
}: {
  note: Note;
  liveId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isLive = liveId === note.id;
  const isSel = selectedId === note.id;
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      aria-current={isSel ? "true" : undefined}
      className={cn(
        "note-enter group w-full rounded-md px-2 py-1 text-left transition-colors",
        isSel ? "bg-write-soft ring-1 ring-primary/40" : "hover:bg-subtle",
        isLive && "live-note",
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- 1. linear */

export function LinearView({ state, level, selectedId, liveId, onSelect }: ViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-1 px-8 py-8">
      {state.flat.map((n) => (
        <Selectable key={n.id} note={n} liveId={liveId} selectedId={selectedId} onSelect={onSelect}>
          <div className="flex items-baseline">
            {n.depth === 0 && n.semanticType === "topic" ? (
              <span className="display text-[26px] leading-tight tracking-tight">
                {textAt(n.variants, level).toUpperCase()}
              </span>
            ) : (
              <>
                <span className="mr-3 font-mono text-[11px] text-muted-foreground">
                  {n.depth === 0 ? "→" : n.children.length ? "▸" : "•"}
                </span>
                <NoteText
                  note={n}
                  level={level}
                  className={cn("text-[19px] leading-snug", accent(n), n.star && "font-semibold")}
                />
              </>
            )}
            <Tag note={n} />
            {n.revisions > 0 ? (
              <span className="ml-2 font-mono text-[10px] text-update">updated</span>
            ) : null}
          </div>
        </Selectable>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- 2. outline */

export function OutlineView({ state, level, selectedId, liveId, onSelect }: ViewProps) {
  const marker = (n: Note) => (n.depth === 0 ? "" : n.depth === 1 ? `${n.index + 1}.` : "•");
  return (
    <div className="mx-auto max-w-3xl space-y-[2px] px-8 py-8">
      {state.flat.map((n) => (
        <Selectable key={n.id} note={n} liveId={liveId} selectedId={selectedId} onSelect={onSelect}>
          <div className="flex items-baseline" style={{ paddingLeft: `${n.depth * 30}px` }}>
            {marker(n) ? (
              <span className="mr-2 w-5 shrink-0 font-mono text-[12px] text-muted-foreground">
                {marker(n)}
              </span>
            ) : null}
            <NoteText
              note={n}
              level={level}
              className={cn(
                n.depth === 0
                  ? "display text-[24px] uppercase tracking-tight"
                  : n.depth === 1
                    ? "text-[19px] font-medium"
                    : "text-[17px] text-secondary-foreground",
                accent(n),
              )}
            />
            <Tag note={n} />
          </div>
        </Selectable>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------- spatial base */

function SpatialView({
  layout,
  level,
  selectedId,
  liveId,
  onSelect,
  variant,
}: {
  layout: Layout;
  level: number;
  selectedId: string | null;
  liveId: string | null;
  onSelect: (id: string) => void;
  variant: "tree" | "mindmap" | "flow";
}) {
  const pos = new Map(layout.nodes.map((n) => [n.note.id, n]));
  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg
        className="pointer-events-none absolute inset-0"
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
      >
        <defs>
          <marker id="nf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--color-muted-foreground)" />
          </marker>
        </defs>
        {layout.edges.map((e) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x;
          const y1 = a.y + a.h / 2;
          const x2 = b.x;
          const y2 = b.y - b.h / 2;
          const d =
            variant === "mindmap"
              ? `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 30} ${b.x} ${b.y}`
              : `M ${x1} ${y1} C ${x1} ${y1 + 34}, ${x2} ${y2 - 34}, ${x2} ${y2}`;
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={d}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth={1.5}
              className="draw-edge"
              markerEnd={variant === "mindmap" ? undefined : "url(#nf-arrow)"}
            />
          );
        })}
      </svg>
      {layout.nodes.map((ln) => {
        const n = ln.note;
        const isSel = selectedId === n.id;
        const isLive = liveId === n.id;
        const isRoot = n.depth === 0;
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n.id)}
            className={cn(
              "note-enter absolute flex items-center justify-center rounded-lg border px-3 text-center transition-colors",
              isRoot ? "border-primary/30 bg-write-soft" : "border-border bg-card",
              isSel && "ring-2 ring-primary/50",
              isLive && "live-note",
              "hover:border-primary/40",
            )}
            style={{
              left: ln.x - ln.w / 2,
              top: ln.y - ln.h / 2,
              width: ln.w,
              minHeight: ln.h,
              boxShadow: "var(--shadow-card)",
            }}
          >
            <span
              className={cn(
                "py-2 leading-snug",
                isRoot ? "display text-[20px] uppercase tracking-tight" : "text-[16px]",
                accent(n),
              )}
            >
              {textAt(n.variants, level)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- 3-5 spatial */

export function TreeView(p: ViewProps) {
  return (
    <SpatialView
      layout={treeLayout(p.state.roots)}
      level={p.level}
      selectedId={p.selectedId}
      liveId={p.liveId}
      onSelect={p.onSelect}
      variant="tree"
    />
  );
}

export function MindmapView(p: ViewProps) {
  return (
    <SpatialView
      layout={mindmapLayout(p.state.roots)}
      level={p.level}
      selectedId={p.selectedId}
      liveId={p.liveId}
      onSelect={p.onSelect}
      variant="mindmap"
    />
  );
}

export function FlowView(p: ViewProps) {
  return (
    <SpatialView
      layout={flowLayout(p.state.roots, p.state.flat)}
      level={p.level}
      selectedId={p.selectedId}
      liveId={p.liveId}
      onSelect={p.onSelect}
      variant="flow"
    />
  );
}

/* --------------------------------------------------------------- 6. cornell */

export function CornellView({ session, state, level, selectedId, liveId, onSelect }: ViewProps) {
  const cues = state.flat.filter((n) => n.cue);
  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="grid grid-cols-[210px_minmax(0,1fr)] border border-border">
        <div className="border-r border-border bg-subtle px-4 py-3">
          <p className="label">cues</p>
          <div className="mt-3 space-y-4">
            {cues.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n.id)}
                className={cn(
                  "block w-full text-left text-[15px] leading-snug text-secondary-foreground hover:text-foreground",
                  selectedId === n.id && "font-medium text-primary",
                )}
              >
                {n.cue}
              </button>
            ))}
            {cues.length === 0 ? (
              <p className="text-sm text-muted-foreground">Recall questions appear as notes are written.</p>
            ) : null}
          </div>
        </div>
        <div className="px-5 py-3">
          <p className="label">notes</p>
          <div className="mt-3 space-y-1">
            {state.flat.map((n) => (
              <Selectable key={n.id} note={n} liveId={liveId} selectedId={selectedId} onSelect={onSelect}>
                <div className="flex items-baseline" style={{ paddingLeft: `${n.depth * 22}px` }}>
                  <NoteText
                    note={n}
                    level={level}
                    className={cn(
                      n.depth === 0 ? "text-[19px] font-medium uppercase tracking-wide" : "text-[17px]",
                      accent(n),
                    )}
                  />
                  <Tag note={n} />
                </div>
              </Selectable>
            ))}
          </div>
        </div>
      </div>
      <div className="border border-t-0 border-border bg-card px-5 py-4">
        <p className="label">summary</p>
        <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-secondary-foreground">
          {session.summary.text || "The summary is written once the recording has been heard."}
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- 7. compression */

export function CompressionView({ state, selectedId, liveId, onSelect }: ViewProps) {
  const chains = state.roots;
  return (
    <div className="flex flex-wrap items-start gap-10 px-10 py-10">
      {chains.map((root) => {
        const line = [root, ...flatten(root.children)];
        return (
          <div key={root.id} className="min-w-[220px]">
            {line.map((n, i) => (
              <div key={n.id} className="flex flex-col items-start">
                {i > 0 ? <span className="ml-3 font-mono text-[16px] text-muted-foreground">↓</span> : null}
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className={cn(
                    "note-enter rounded px-2 py-[3px] font-mono transition-colors hover:bg-subtle",
                    i === 0
                      ? "text-[22px] font-bold uppercase tracking-tight"
                      : "text-[19px] tracking-tight",
                    selectedId === n.id && "bg-write-soft ring-1 ring-primary/40",
                    liveId === n.id && "live-note",
                  )}
                >
                  {textAt(n.variants, 100)}
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function flatten(list: Note[]): Note[] {
  return list.flatMap((n) => [n, ...flatten(n.children)]);
}

export const VIEWS: Record<NoteRepresentation, (p: ViewProps) => React.ReactNode> = {
  linear: LinearView,
  outline: OutlineView,
  tree: TreeView,
  mindmap: MindmapView,
  flow: FlowView,
  cornell: CornellView,
  compression: CompressionView,
};
