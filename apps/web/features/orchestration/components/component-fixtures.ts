import type { TaskRun } from "@graph-agent/domain";

export function createRun(overrides: Partial<TaskRun> = {}): TaskRun {
  const timestamp = "2026-08-18T02:00:00.000Z";
  return {
    id: "run-1",
    task: "Coordinate the release",
    workspacePath: "C:\\workspace\\demo",
    runtime: "mock",
    status: "running",
    speed: "balanced",
    workflow: "adaptive",
    graphVersion: 1,
    nodes: [
      { id: "plan", title: "Plan release", task: "Create a release plan", status: "succeeded", progress: "Plan ready", depth: 0, stage: "Design", result: "Release plan" },
      { id: "build", title: "Build release", task: "Build the release", status: "running", progress: "Compiling artifacts", depth: 1, stage: "Build", startedAt: timestamp },
      { id: "verify", title: "Verify release", task: "Verify artifacts", status: "pending", progress: "Waiting for build", depth: 2, stage: "Verify" },
      { id: "obsolete", title: "Obsolete plan", task: "Old work", status: "replaced", progress: "Replaced", depth: 0 },
    ],
    edges: [
      { id: "plan-build", source: "plan", target: "build" },
      { id: "build-verify", source: "build", target: "verify" },
      { id: "obsolete-build", source: "obsolete", target: "build" },
    ],
    decisions: [],
    events: [
      { id: 1, type: "node", nodeId: "build", message: "Build started", createdAt: timestamp },
      { id: 2, type: "graph", message: "Added verification work", createdAt: "2026-08-18T02:01:00.000Z" },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}
