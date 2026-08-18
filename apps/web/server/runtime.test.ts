import { createDemoRun, type TaskNode } from "@graph-agent/domain";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COPILOT_PLANNER_SYSTEM_PROMPT, COPILOT_WORKER_SYSTEM_PROMPT, MockAgentRuntime } from "./runtime";

describe("MockAgentRuntime", () => {
  afterEach(() => vi.useRealTimers());

  it("builds a demo graph with a mandatory human delivery decision", async () => {
    vi.useFakeTimers();
    const runtime = new MockAgentRuntime();
    const run = createDemoRun("demo", "Build a polished demo", "C:\\workspace\\demo", "mock");
    const planner = run.nodes[0]!;
    const planning = runtime.execute({ run, node: planner, progress: vi.fn() });
    await vi.advanceTimersByTimeAsync(500);
    const plan = await planning;

    expect(plan.type).toBe("replace");
    if (plan.type !== "replace") return;
    const decisionNode = plan.patch.newGraph.nodes.find((node) => node.title === "Confirm delivery boundary");
    expect(decisionNode).toBeDefined();
    expect(plan.patch.newGraph.edges).toContainEqual(expect.objectContaining({
      source: decisionNode?.id,
      target: plan.patch.newGraph.nodes.find((node) => node.title === "Prepare deliverables")?.id,
    }));

    const deciding = runtime.execute({
      run,
      node: { ...decisionNode, status: "running", progress: "Starting", depth: 1 } as TaskNode,
      progress: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(250);
    const outcome = await deciding;
    expect(outcome).toMatchObject({
      type: "question",
      question: { riskLevel: "L3", recommendation: "Keep changes local" },
    });
  });

  it("returns a stable result after deterministic simulated work", async () => {
    vi.useFakeTimers();
    const runtime = new MockAgentRuntime();
    const run = createDemoRun("demo", "Build a polished demo", "C:\\workspace\\demo", "mock");
    const node: TaskNode = {
      id: "task",
      title: "Implement feature",
      task: "Implement the requested feature",
      status: "running",
      progress: "Starting agent",
      depth: 1,
    };
    const execution = runtime.execute({ run, node, progress: vi.fn() });

    await vi.advanceTimersByTimeAsync(1_060);

    await expect(execution).resolves.toEqual({
      type: "completed",
      result: "Completed: Implement the requested feature",
    });
  });

  it("instructs Copilot to create real output dependencies and broad parallel work", () => {
    expect(COPILOT_PLANNER_SYSTEM_PROMPT).toContain("expose 5-8 runnable nodes");
    expect(COPILOT_PLANNER_SYSTEM_PROMPT).toContain("What exact output is unavailable?");
    expect(COPILOT_PLANNER_SYSTEM_PROMPT).toContain("non-overlapping file ownership");
    expect(COPILOT_PLANNER_SYSTEM_PROMPT).toContain("must not become a single global gate");
    expect(COPILOT_PLANNER_SYSTEM_PROMPT).toContain("Keep independent branches runnable");
    expect(COPILOT_WORKER_SYSTEM_PROMPT).toContain("Resolve reversible implementation choices yourself");
  });
});
