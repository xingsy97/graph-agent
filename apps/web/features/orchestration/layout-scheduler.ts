import type { TaskEdge, TaskNode, TaskStage } from "@graph-agent/domain";

export type LayoutPerspective = "topology" | "stage";
export type LayoutDirection = "horizontal" | "vertical" | "wrapped";
export type LayoutHandlePosition = "left" | "right" | "top" | "bottom";

export interface LayoutViewport { width: number; height: number; }

export interface ScheduledNode {
  id: string;
  position: { x: number; y: number };
  stage: TaskStage;
  topologyLevel: number;
  sourcePosition: LayoutHandlePosition;
  targetPosition: LayoutHandlePosition;
}

export interface LayoutSchedule {
  nodes: ScheduledNode[];
  topologyDepth: number;
  direction: LayoutDirection;
  bounds: { width: number; height: number };
}

const stages: TaskStage[] = ["Discover", "Design", "Build", "Verify", "Deliver"];
const NODE_WIDTH = 252;
const NODE_HEIGHT = 164;
const COLUMN_GAP = 62;
const ROW_GAP = 48;
const HORIZONTAL_LEVEL_STEP = NODE_WIDTH + COLUMN_GAP;
const HORIZONTAL_ROW_STEP = NODE_HEIGHT + ROW_GAP;
const VERTICAL_LEVEL_STEP = NODE_HEIGHT + 66;
const VERTICAL_ROW_STEP = NODE_WIDTH + 54;
const BAND_GAP = 104;

interface WrappedLayout {
  columns: number;
  bounds: { width: number; height: number };
  bandTops: number[];
  bandHeights: number[];
}

function wrappedLayout(laneSizes: number[], columns: number): WrappedLayout {
  const bandCount = Math.ceil(laneSizes.length / columns);
  const bandHeights = Array.from({ length: bandCount }, (_, band) => {
    const sizes = laneSizes.slice(band * columns, (band + 1) * columns);
    const largestLane = Math.max(1, ...sizes);
    return NODE_HEIGHT + Math.max(0, largestLane - 1) * HORIZONTAL_ROW_STEP;
  });
  const bandTops: number[] = [];
  let top = 0;
  for (const height of bandHeights) {
    bandTops.push(top);
    top += height + BAND_GAP;
  }
  return {
    columns,
    bounds: {
      width: NODE_WIDTH + Math.max(0, Math.min(columns, laneSizes.length) - 1) * HORIZONTAL_LEVEL_STEP,
      height: Math.max(0, top - BAND_GAP),
    },
    bandTops,
    bandHeights,
  };
}

function inferStage(node: TaskNode, level: number, maxLevel: number): TaskStage {
  if (node.stage) return node.stage;
  const description = node.title + " " + node.task;
  if (/deliver|handoff|document|summary|release/i.test(description)) return "Deliver";
  if (/test|verify|validat|review|quality|integrat/i.test(description)) return "Verify";
  if (/build|implement|create|develop|diagnostic/i.test(description)) return "Build";
  if (/design|architect|model|contract|experience/i.test(description)) return "Design";
  const normalized = maxLevel ? level / maxLevel : 0;
  return stages[Math.min(stages.length - 1, Math.floor(normalized * stages.length))] ?? "Discover";
}

function estimatedBounds(laneCount: number, largestLane: number, direction: "horizontal" | "vertical"): { width: number; height: number } {
  if (direction === "vertical") return {
    width: NODE_WIDTH + Math.max(0, largestLane - 1) * VERTICAL_ROW_STEP,
    height: NODE_HEIGHT + Math.max(0, laneCount - 1) * VERTICAL_LEVEL_STEP,
  };
  return {
    width: NODE_WIDTH + Math.max(0, laneCount - 1) * HORIZONTAL_LEVEL_STEP,
    height: NODE_HEIGHT + Math.max(0, largestLane - 1) * HORIZONTAL_ROW_STEP,
  };
}

function fitPenalty(bounds: { width: number; height: number }, viewport: LayoutViewport): number {
  const scale = Math.min(viewport.width / bounds.width, viewport.height / bounds.height, 1);
  const unusedArea = 1 - Math.min(1, (bounds.width * scale * bounds.height * scale) / (viewport.width * viewport.height));
  const aspectMismatch = Math.abs(Math.log((bounds.width / bounds.height) / (viewport.width / viewport.height)));
  return (1 - scale) * 2.2 + unusedArea * .25 + aspectMismatch * .18;
}

/** Deterministic layered layout that adapts its direction to the available canvas. */
export class LayoutScheduler {
  schedule(nodes: TaskNode[], edges: TaskEdge[], perspective: LayoutPerspective = "topology", viewport: LayoutViewport = { width: 1200, height: 720 }): LayoutSchedule {
    if (!nodes.length) return { nodes: [], topologyDepth: 0, direction: "horizontal", bounds: { width: 0, height: 0 } };
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const relevantEdges = edges.filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target));
    const parents = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    const indegree = new Map(nodes.map((node) => [node.id, 0]));

    for (const edge of relevantEdges) {
      parents.set(edge.target, [...(parents.get(edge.target) ?? []), edge.source]);
      children.set(edge.source, [...(children.get(edge.source) ?? []), edge.target]);
      indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    }

    const levels = new Map(nodes.map((node) => [node.id, 0]));
    const queue = nodes.filter((node) => indegree.get(node.id) === 0).sort((a, b) => a.title.localeCompare(b.title));
    const processed = new Set<string>();
    while (queue.length) {
      const node = queue.shift()!;
      processed.add(node.id);
      for (const childId of children.get(node.id) ?? []) {
        levels.set(childId, Math.max(levels.get(childId) ?? 0, (levels.get(node.id) ?? 0) + 1));
        indegree.set(childId, (indegree.get(childId) ?? 1) - 1);
        if (indegree.get(childId) === 0) {
          const child = nodeById.get(childId);
          if (child) queue.push(child);
          queue.sort((a, b) => a.title.localeCompare(b.title));
        }
      }
    }

    const resolvedDepth = Math.max(0, ...levels.values());
    for (const node of nodes) if (!processed.has(node.id)) levels.set(node.id, resolvedDepth + 1);
    const topologyDepth = Math.max(0, ...levels.values());
    const stageById = new Map(nodes.map((node) => [node.id, inferStage(node, levels.get(node.id) ?? 0, topologyDepth)]));
    const laneFor = (node: TaskNode) => perspective === "topology"
      ? levels.get(node.id) ?? 0
      : Math.max(0, stages.indexOf(stageById.get(node.id) ?? "Discover"));
    const lanes = new Map<number, TaskNode[]>();
    for (const node of nodes) {
      const lane = laneFor(node);
      lanes.set(lane, [...(lanes.get(lane) ?? []), node]);
    }

    // Barycentric sweeps keep connected branches near each other and reduce crossings.
    const rank = new Map<string, number>();
    for (const [, laneNodes] of [...lanes].sort(([a], [b]) => a - b)) {
      laneNodes.sort((a, b) => (levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0) || a.title.localeCompare(b.title));
      laneNodes.forEach((node, index) => rank.set(node.id, index));
    }
    for (let sweep = 0; sweep < 6; sweep += 1) {
      const orderedLanes = [...lanes].sort(([a], [b]) => sweep % 2 === 0 ? a - b : b - a);
      for (const [, laneNodes] of orderedLanes) {
        const score = (node: TaskNode) => {
          const neighbors = [...(parents.get(node.id) ?? []), ...(children.get(node.id) ?? [])];
          const ranked = neighbors.map((id) => rank.get(id)).filter((value): value is number => value !== undefined);
          return ranked.length ? ranked.reduce((total, value) => total + value, 0) / ranked.length : rank.get(node.id) ?? 0;
        };
        laneNodes.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title));
        laneNodes.forEach((node, index) => rank.set(node.id, index));
      }
    }

    const orderedLanes = [...lanes].sort(([a], [b]) => a - b);
    const laneCount = orderedLanes.length;
    const laneIndexByValue = new Map(orderedLanes.map(([lane], index) => [lane, index]));
    const laneSizes = orderedLanes.map(([, laneNodes]) => laneNodes.length);
    const largestLane = Math.max(1, ...orderedLanes.map(([, laneNodes]) => laneNodes.length));
    const horizontalBounds = estimatedBounds(laneCount, largestLane, "horizontal");
    const verticalBounds = estimatedBounds(laneCount, largestLane, "vertical");
    const safeViewport = { width: Math.max(320, viewport.width), height: Math.max(320, viewport.height) };
    let wrapped: WrappedLayout | null = null;
    if (perspective === "topology" && laneCount >= 5) {
      for (let columns = 2; columns < laneCount; columns += 1) {
        const candidate = wrappedLayout(laneSizes, columns);
        if (!wrapped || fitPenalty(candidate.bounds, safeViewport) < fitPenalty(wrapped.bounds, safeViewport)) wrapped = candidate;
      }
    }
    const candidates: Array<{ direction: LayoutDirection; bounds: { width: number; height: number }; penalty: number }> = [
      { direction: "horizontal", bounds: horizontalBounds, penalty: fitPenalty(horizontalBounds, safeViewport) },
      { direction: "vertical", bounds: verticalBounds, penalty: fitPenalty(verticalBounds, safeViewport) },
    ];
    if (wrapped) candidates.push({ direction: "wrapped", bounds: wrapped.bounds, penalty: fitPenalty(wrapped.bounds, safeViewport) });
    const choice = perspective === "stage" ? candidates[0]! : candidates.sort((a, b) => a.penalty - b.penalty)[0]!;
    const direction = choice.direction;
    const bounds = choice.bounds;
    const rowById = new Map<string, number>();
    for (const [, laneNodes] of lanes) laneNodes.forEach((node, index) => rowById.set(node.id, index));

    return {
      topologyDepth,
      direction,
      bounds,
      nodes: nodes.map((node) => {
        const lane = laneFor(node);
        const laneIndex = laneIndexByValue.get(lane) ?? 0;
        const row = rowById.get(node.id) ?? 0;
        const laneSize = lanes.get(lane)?.length ?? 1;
        const band = wrapped && direction === "wrapped" ? Math.floor(laneIndex / wrapped.columns) : 0;
        const laneWithinBand = wrapped && direction === "wrapped" ? laneIndex % wrapped.columns : 0;
        const visualColumn = wrapped && direction === "wrapped" && band % 2 === 1
          ? Math.min(wrapped.columns, laneCount - band * wrapped.columns) - 1 - laneWithinBand
          : laneWithinBand;
        const crossesBand = direction === "wrapped" && wrapped !== null && laneWithinBand === wrapped.columns - 1 && laneIndex < laneCount - 1;
        const beginsBand = direction === "wrapped" && laneWithinBand === 0 && band > 0;
        const sourcePosition: LayoutHandlePosition = direction === "vertical" ? "bottom" : crossesBand ? "bottom" : direction === "wrapped" && band % 2 === 1 ? "left" : "right";
        const targetPosition: LayoutHandlePosition = direction === "vertical" ? "top" : beginsBand ? "top" : direction === "wrapped" && band % 2 === 1 ? "right" : "left";
        return {
          id: node.id,
          position: direction === "vertical"
            ? { x: row * VERTICAL_ROW_STEP - ((laneSize - 1) * VERTICAL_ROW_STEP) / 2, y: laneIndex * VERTICAL_LEVEL_STEP }
            : direction === "wrapped" && wrapped
              ? {
                  x: visualColumn * HORIZONTAL_LEVEL_STEP,
                  y: wrapped.bandTops[band]! + (wrapped.bandHeights[band]! - (NODE_HEIGHT + (laneSize - 1) * HORIZONTAL_ROW_STEP)) / 2 + row * HORIZONTAL_ROW_STEP,
                }
              : { x: laneIndex * HORIZONTAL_LEVEL_STEP, y: row * HORIZONTAL_ROW_STEP - ((laneSize - 1) * HORIZONTAL_ROW_STEP) / 2 },
          stage: stageById.get(node.id) ?? "Discover",
          topologyLevel: levels.get(node.id) ?? 0,
          sourcePosition,
          targetPosition,
        };
      }),
    };
  }
}

export const layoutScheduler = new LayoutScheduler();
