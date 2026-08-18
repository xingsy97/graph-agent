import type { NodeStatus, RunStatus, TaskNode, TaskRun } from "./types";

export class StateTransitionError extends Error {}

const nodeTransitions: Readonly<Record<NodeStatus, readonly NodeStatus[]>> = {
  pending: ["ready", "running", "cancelled"],
  ready: ["running", "cancelled"],
  running: ["ready", "waiting_user", "expanding", "succeeded", "failed", "cancelled", "replaced"],
  waiting_user: ["ready", "cancelled"],
  expanding: ["replaced", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
  replaced: [],
};

const runTransitions: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  running: ["paused", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransitionNode(from: NodeStatus, to: NodeStatus): boolean {
  return nodeTransitions[from].includes(to);
}

export function assertNodeTransition(from: NodeStatus, to: NodeStatus): void {
  if (!canTransitionNode(from, to)) {
    throw new StateTransitionError(`Cannot transition node from ${from} to ${to}`);
  }
}

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return runTransitions[from].includes(to);
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRun(from, to)) {
    throw new StateTransitionError(`Cannot transition run from ${from} to ${to}`);
  }
}

export function transitionNode(
  node: TaskNode,
  status: NodeStatus,
  at: string,
  update: Omit<Partial<TaskNode>, "id" | "status" | "startedAt" | "completedAt"> = {},
): TaskNode {
  assertNodeTransition(node.status, status);
  return {
    ...node,
    ...update,
    status,
    ...(status === "running" && !node.startedAt ? { startedAt: at } : {}),
    ...(["succeeded", "failed", "cancelled", "replaced"].includes(status) ? { completedAt: at } : {}),
  };
}

export function scheduleReadyNodes(run: TaskRun, at: string): TaskRun {
  if (run.status !== "running") return run;
  const completed = new Set(
    run.nodes
      .filter((node) => node.status === "succeeded" || node.status === "replaced")
      .map((node) => node.id),
  );
  const nodes = run.nodes.map((node) => {
    if (node.status !== "pending") return node;
    const dependencies = run.edges.filter((edge) => edge.target === node.id);
    if (!dependencies.every((edge) => completed.has(edge.source))) return node;
    return transitionNode(node, "ready", at, { progress: "Ready to run" });
  });
  return nodes.some((node, index) => node !== run.nodes[index])
    ? { ...run, nodes, updatedAt: at }
    : run;
}

export function cancelBlockedNodes(run: TaskRun, at: string): TaskRun {
  const terminallyBlocked = new Set(
    run.nodes
      .filter((node) => node.status === "failed" || node.status === "cancelled")
      .map((node) => node.id),
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of run.nodes) {
      if (node.status !== "pending" && node.status !== "ready") continue;
      if (!run.edges.some((edge) => edge.target === node.id && terminallyBlocked.has(edge.source))) continue;
      if (!terminallyBlocked.has(node.id)) {
        terminallyBlocked.add(node.id);
        changed = true;
      }
    }
  }
  const nodes = run.nodes.map((node) => {
    if (node.status !== "pending" && node.status !== "ready") return node;
    if (!terminallyBlocked.has(node.id)) return node;
    return transitionNode(node, "cancelled", at, {
      progress: "Cancelled because a dependency did not complete",
    });
  });
  return nodes.some((node, index) => node !== run.nodes[index])
    ? { ...run, nodes, updatedAt: at }
    : run;
}

export function resetRun(run: TaskRun, at: string): TaskRun {
  const nodes = run.nodes.map((node) => {
    if (node.status === "replaced") return node;
    const { completedAt: _completedAt, error: _error, result: _result, sessionId: _sessionId, startedAt: _startedAt, ...resetNode } = node;
    return { ...resetNode, status: "pending" as const, progress: "Waiting for dependencies" };
  });
  return {
    ...run,
    status: "running",
    nodes,
    decisions: [],
    updatedAt: at,
  };
}
