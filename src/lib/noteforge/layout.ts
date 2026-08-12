import type { Note } from "./types";

export type LaidOutNode = {
  note: Note;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Edge = { from: string; to: string; kind: "tree" | "radial" | "flow" };

export type Layout = { nodes: LaidOutNode[]; edges: Edge[]; width: number; height: number };

const NODE_W = 190;
const NODE_H = 58;
const H_GAP = 34;
const V_GAP = 92;

/** Tidy top-down tree: leaves are packed, parents centre over their children. */
export function treeLayout(roots: Note[]): Layout {
  const nodes: LaidOutNode[] = [];
  const edges: Edge[] = [];
  let cursor = 0;

  const place = (n: Note, depth: number): number => {
    let x: number;
    if (n.children.length === 0) {
      x = cursor;
      cursor += NODE_W + H_GAP;
    } else {
      const xs = n.children.map((c) => place(c, depth + 1));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
      for (const c of n.children) edges.push({ from: n.id, to: c.id, kind: "tree" });
    }
    nodes.push({ note: n, x, y: depth * V_GAP, w: NODE_W, h: NODE_H });
    return x;
  };

  for (const r of roots) {
    place(r, 0);
    cursor += NODE_W * 0.6;
  }

  return bounds(nodes, edges);
}

/** Radial mind map: central topic, branches fanned around it, leaves clustered. */
export function mindmapLayout(roots: Note[]): Layout {
  const nodes: LaidOutNode[] = [];
  const edges: Edge[] = [];
  const centre = roots[0];
  if (!centre) return { nodes, edges, width: 0, height: 0 };

  nodes.push({ note: centre, x: 0, y: 0, w: 210, h: 66 });

  const branches = centre.children.length ? centre.children : roots.slice(1);
  const R1 = 300;
  branches.forEach((b, i) => {
    const angle = (-Math.PI / 2) + (i / Math.max(1, branches.length)) * Math.PI * 2;
    const bx = Math.cos(angle) * R1 * 1.25;
    const by = Math.sin(angle) * R1 * 0.85;
    nodes.push({ note: b, x: bx, y: by, w: NODE_W, h: NODE_H });
    edges.push({ from: centre.id, to: b.id, kind: "radial" });

    b.children.forEach((c, j) => {
      const spread = 0.55;
      const a2 = angle - spread / 2 + (b.children.length === 1 ? spread / 2 : (j / (b.children.length - 1)) * spread);
      const cx = Math.cos(a2) * (R1 * 2.05);
      const cy = Math.sin(a2) * (R1 * 1.45);
      nodes.push({ note: c, x: cx, y: cy, w: 168, h: 50 });
      edges.push({ from: b.id, to: c.id, kind: "radial" });
    });
  });

  // extra roots orbit below when the map has several top-level topics
  roots.slice(1).forEach((r, i) => {
    if (nodes.some((n) => n.note.id === r.id)) return;
    nodes.push({ note: r, x: (i - 1) * 260, y: R1 * 1.6, w: NODE_W, h: NODE_H });
  });

  return bounds(nodes, edges);
}

/** Vertical causal / process chain. Branches sit beside the spine. */
export function flowLayout(roots: Note[], flat: Note[]): Layout {
  const nodes: LaidOutNode[] = [];
  const edges: Edge[] = [];
  const spine = flat.filter((n) => n.children.length > 0 || n.depth === 0);
  const chain = spine.length >= 2 ? spine : flat;

  chain.forEach((n, i) => {
    nodes.push({ note: n, x: 0, y: i * 118, w: 250, h: 62 });
    if (i > 0) edges.push({ from: chain[i - 1]!.id, to: n.id, kind: "flow" });
  });

  const inChain = new Set(chain.map((n) => n.id));
  let side = 0;
  for (const n of flat) {
    if (inChain.has(n.id)) continue;
    const parent = nodes.find((p) => p.note.id === n.parentId);
    const y = parent ? parent.y + 34 : side * 100;
    nodes.push({ note: n, x: 330, y, w: 210, h: 50 });
    if (parent) edges.push({ from: parent.note.id, to: n.id, kind: "flow" });
    side += 1;
  }

  void roots;
  return bounds(nodes, edges);
}

function bounds(nodes: LaidOutNode[], edges: Edge[]): Layout {
  if (nodes.length === 0) return { nodes, edges, width: 0, height: 0 };
  const minX = Math.min(...nodes.map((n) => n.x - n.w / 2));
  const minY = Math.min(...nodes.map((n) => n.y - n.h / 2));
  const shifted = nodes.map((n) => ({ ...n, x: n.x - minX + 40, y: n.y - minY + 40 }));
  const width = Math.max(...shifted.map((n) => n.x + n.w / 2)) + 40;
  const height = Math.max(...shifted.map((n) => n.y + n.h / 2)) + 40;
  return { nodes: shifted, edges, width, height };
}
