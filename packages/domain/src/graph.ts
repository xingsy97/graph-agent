import type { NewEdge, NewNode, ReplaceNodePatch, TaskEdge, TaskNode, TaskRun } from "./types";

export class GraphError extends Error {}

export function assertDag(nodeIds: string[], edges: Array<Pick<TaskEdge, "source" | "target">>): void {
  const ids = new Set(nodeIds);
  if (ids.size !== nodeIds.length) throw new GraphError("Node IDs must be unique");

  const indegree = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map(nodeIds.map((id) => [id, [] as string[]]));
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new GraphError("Edge references an unknown node");
    if (edge.source === edge.target) throw new GraphError("Self edges are not allowed");
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source)?.push(edge.target);
  }

  const queue = nodeIds.filter((id) => indegree.get(id) === 0);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    if (!id) break;
    visited += 1;
    for (const target of outgoing.get(id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  if (visited !== nodeIds.length) throw new GraphError("Graph must be acyclic");
}

export function runnableNodeIds(run: TaskRun): string[] {
  if (run.status !== "running") return [];
  const successful = new Set(run.nodes.filter((node) => node.status === "succeeded" || node.status === "replaced").map((node) => node.id));
  return run.nodes
    .filter((node) => node.status === "pending" || node.status === "ready")
    .filter((node) => run.edges.filter((edge) => edge.target === node.id).every((edge) => successful.has(edge.source)))
    .map((node) => node.id);
}

function reachableFrom(entry: string, nodes: NewNode[], edges: NewEdge[]): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    for (const edge of edges.filter((candidate) => candidate.source === id)) queue.push(edge.target);
  }
  return seen;
}

export function replaceNode(run: TaskRun, patch: ReplaceNodePatch): TaskRun {
  if (patch.expectedGraphVersion !== run.graphVersion) throw new GraphError("Graph version conflict");
  const oldNode = run.nodes.find((node) => node.id === patch.replacedNodeId);
  if (!oldNode) throw new GraphError("Replaced node does not exist");
  if (oldNode.status !== "running" && oldNode.status !== "expanding") throw new GraphError("Only the running node can replace itself");
  if (patch.newGraph.nodes.length === 0 || patch.newGraph.nodes.length > 50) throw new GraphError("Replacement graph must contain 1–50 nodes");
  if (!patch.newGraph.nodes.some((node) => node.id === patch.entryNodeId)) throw new GraphError("Entry node is missing");

  const existingIds = new Set(run.nodes.map((node) => node.id));
  for (const node of patch.newGraph.nodes) if (existingIds.has(node.id)) throw new GraphError(`Node ID already exists: ${node.id}`);
  assertDag(patch.newGraph.nodes.map((node) => node.id), patch.newGraph.edges);
  if (reachableFrom(patch.entryNodeId, patch.newGraph.nodes, patch.newGraph.edges).size !== patch.newGraph.nodes.length) {
    throw new GraphError("Every replacement node must be reachable from the entry node");
  }

  const predecessors = run.edges.filter((edge) => edge.target === oldNode.id).map((edge) => edge.source);
  const successors = run.edges.filter((edge) => edge.source === oldNode.id).map((edge) => edge.target);
  const outgoing = new Set(patch.newGraph.edges.map((edge) => edge.source));
  const exits = patch.newGraph.nodes.filter((node) => !outgoing.has(node.id)).map((node) => node.id);
  const now = new Date().toISOString();
  const nodes: TaskNode[] = [
    ...run.nodes.map((node) => node.id === oldNode.id
      ? { ...node, status: "replaced" as const, replacedBy: patch.entryNodeId, completedAt: now, progress: "Expanded into a subgraph" }
      : node),
    ...patch.newGraph.nodes.map((node) => ({ ...node, status: "pending" as const, progress: "Waiting for dependencies", depth: oldNode.depth + 1 })),
  ];
  const preserved = run.edges.filter((edge) => edge.source !== oldNode.id && edge.target !== oldNode.id);
  const edges: TaskEdge[] = [
    ...preserved,
    ...patch.newGraph.edges.map((edge) => ({ ...edge, id: crypto.randomUUID() })),
    ...predecessors.map((source) => ({ id: crypto.randomUUID(), source, target: patch.entryNodeId })),
    ...exits.flatMap((source) => successors.map((target) => ({ id: crypto.randomUUID(), source, target }))),
  ];
  assertDag(nodes.filter((node) => node.status !== "replaced").map((node) => node.id), edges);
  return { ...run, nodes, edges, graphVersion: run.graphVersion + 1, updatedAt: now };
}
