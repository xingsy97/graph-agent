import type { TaskRun } from "./types";

/**
 * Every run starts with a real planner node. The planner may replace itself with
 * a richer graph, which lets both mock and Copilot runtimes exercise the same
 * dynamic-graph path instead of presenting a frozen, mid-flight fixture.
 */
export function createDemoRun(
  id: string,
  task: string,
  workspacePath: string,
  runtime: TaskRun["runtime"],
  now = Date.now(),
  options: Pick<TaskRun, "speed" | "workflow"> = { speed: "balanced", workflow: "adaptive" },
): TaskRun {
  const createdAt = new Date(now).toISOString();
  return {
    id,
    task,
    workspacePath,
    runtime,
    status: "running",
    speed: options.speed,
    workflow: options.workflow,
    graphVersion: 1,
    nodes: [{
      id: `planner-${id}`,
      title: "Plan and decompose",
      task: `Create a dependency-aware execution graph for: ${task}`,
      stage: "Discover",
      status: "pending",
      progress: "Waiting for the scheduler",
      depth: 0,
    }],
    edges: [],
    decisions: [],
    // Runtime events start at 1 in the store; keep the synthetic creation event distinct.
    events: [{ id: 0, type: "run", message: "Run created; planner is ready for scheduling", createdAt }],
    createdAt,
    updatedAt: createdAt,
  };
}
