import type { NoteNode } from "@/lib/noteforge/types";
import { cn } from "@/lib/utils";

const kindClass: Record<NoteNode["kind"], string> = {
  heading: "font-mono text-[15px] font-bold uppercase tracking-[0.14em]",
  item: "font-mono text-[14px] font-medium",
  bullet: "font-mono text-[13.5px]",
  relation: "font-mono text-[13.5px] leading-6",
  definition: "font-mono text-[13.5px]",
  action: "font-mono text-[13.5px]",
};

function NoteLine({
  node,
  depth,
  activeId,
  onSelect,
}: {
  node: NoteNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <li className="ink-appear">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "group -mx-1 flex w-full items-start gap-2 rounded px-1 py-[2px] text-left transition-colors hover:bg-paper-line/60",
          activeId === node.id && "bg-paper-line",
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <span className={cn(kindClass[node.kind], "whitespace-pre-wrap")}>{node.text}</span>
        {node.star ? <span className="text-[11px] leading-5 text-primary">★</span> : null}
        {node.revisions > 0 ? (
          <span className="mt-[3px] rounded-sm bg-update/20 px-1 text-[9px] font-semibold uppercase tracking-wider text-update">
            rev {node.revisions}
          </span>
        ) : null}
      </button>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((c) => (
            <NoteLine key={c.id} node={c} depth={depth + 1} activeId={activeId} onSelect={onSelect} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function Notebook({
  notes,
  activeId,
  onSelect,
  hidden,
}: {
  notes: NoteNode[];
  activeId: string | null;
  onSelect: (id: string) => void;
  hidden?: boolean;
}) {
  return (
    <div className="notepaper relative min-h-[320px] px-6 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-12 w-px bg-destructive/30" />
      {hidden ? (
        <p className="pt-10 text-center font-mono text-xs uppercase tracking-widest opacity-50">
          notes hidden — decide for yourself first
        </p>
      ) : notes.length === 0 ? (
        <p className="pt-10 text-center font-mono text-xs uppercase tracking-widest opacity-40">
          nothing written yet
        </p>
      ) : (
        <ul className="space-y-1 pl-6">
          {notes.map((n) => (
            <NoteLine key={n.id} node={n} depth={0} activeId={activeId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  );
}
