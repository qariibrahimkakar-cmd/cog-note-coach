import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import type { NoteRepresentation } from "@/lib/noteforge/types";
import { VIEWS, type ViewProps } from "./views";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.4;
const SPATIAL: NoteRepresentation[] = ["tree", "mindmap", "flow", "compression"];

/**
 * The whiteboard is the product: a large pannable / zoomable canvas whose
 * internal layout is decided entirely by the active representation.
 */
export function Whiteboard(props: ViewProps & { empty: boolean }) {
  const { representation, empty } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stateRef = useRef({ zoom, offset });
  stateRef.current = { zoom, offset };
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const spatial = SPATIAL.includes(representation);

  const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    const { zoom: z, offset: o } = stateRef.current;
    const next = clamp(z * factor);
    const k = next / z;
    setZoom(next);
    setOffset({ x: px - (px - o.x) * k, y: py - (py - o.y) * k });
  }, []);

  const wheelRef = useRef((e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) < 1) {
      zoomAt(Math.exp(-dy * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    } else {
      setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - dy }));
    }
  });
  wheelRef.current = (e: WheelEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    if (e.ctrlKey || e.metaKey) {
      zoomAt(Math.exp(-dy * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    } else {
      setOffset((o) => ({ x: o.x - e.deltaX, y: o.y - dy }));
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fit = useCallback(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const cw = content.scrollWidth;
    const ch = content.scrollHeight;
    if (!cw || !ch) return;
    const next = clamp(Math.min((el.clientWidth - 64) / cw, (el.clientHeight - 64) / ch, 1));
    setZoom(next);
    setOffset({
      x: (el.clientWidth - cw * next) / 2,
      y: Math.max(24, (el.clientHeight - ch * next) / 2),
    });
  }, []);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    if (spatial) {
      const id = window.setTimeout(fit, 60);
      return () => window.clearTimeout(id);
    }
    return;
  }, [representation, spatial, fit]);

  const View = VIEWS[representation];

  return (
    <section
      aria-label="Expert whiteboard"
      className="whiteboard relative h-full min-h-[420px] overflow-hidden"
    >
      <div
        ref={containerRef}
        className={cn("h-full w-full", drag.current ? "cursor-grabbing" : "cursor-grab")}
        onPointerDown={(e) => {
          if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div
          ref={contentRef}
          className="origin-top-left"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, width: "max-content" }}
        >
          {empty ? (
            <div className="flex h-[420px] w-[min(70vw,760px)] flex-col items-center justify-center px-10 text-center">
              <h2 className="display text-[30px]">Ready to listen.</h2>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-muted-foreground">
                Your notes will appear here as NoteForge makes decisions in real time — what to write,
                what to ignore, and how the pieces connect.
              </p>
            </div>
          ) : (
            <View {...props} />
          )}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-border bg-card/95 p-1 shadow-[var(--shadow-card)] backdrop-blur">
        <IconBtn label="Zoom out" onClick={() => zoomAt(1 / 1.2, 0, 0)}>
          <Minus className="h-4 w-4" />
        </IconBtn>
        <span className="w-12 text-center font-mono text-[11px] text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <IconBtn label="Zoom in" onClick={() => zoomAt(1.2, 0, 0)}>
          <Plus className="h-4 w-4" />
        </IconBtn>
        <IconBtn label="Fit to content" onClick={fit}>
          <Maximize2 className="h-4 w-4" />
        </IconBtn>
      </div>
    </section>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground"
    >
      {children}
    </button>
  );
}
