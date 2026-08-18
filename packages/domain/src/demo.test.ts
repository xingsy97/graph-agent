import { describe, expect, it } from "vitest";
import { assertDag, createDemoRun, runnableNodeIds } from "./index";

describe("demo workflow seed", () => {
  it("starts with a scheduler-runnable planner that can evolve the graph", () => {
    const run = createDemoRun("demo-run", "Build a demo", "C:\\workspace", "mock", Date.parse("2026-08-18T02:00:00.000Z"));

    assertDag(run.nodes.map((node) => node.id), run.edges);
    expect(run.nodes).toHaveLength(1);
    expect(run.nodes[0]).toMatchObject({ title: "Plan and decompose", status: "pending", stage: "Discover" });
    expect(run).toMatchObject({ speed: "balanced", workflow: "adaptive", graphVersion: 1 });
    expect(runnableNodeIds(run)).toEqual(["planner-demo-run"]);
  });

  it("is deterministic and does not seed fake running sessions", () => {
    const now = Date.parse("2026-08-18T02:00:00.000Z");
    const first = createDemoRun("demo-run", "Build a demo", "C:\\workspace", "mock", now);
    const second = createDemoRun("demo-run", "Build a demo", "C:\\workspace", "mock", now);

    expect(second).toEqual(first);
    expect(first.nodes.some((node) => node.status === "running")).toBe(false);
    first.nodes[0]!.progress = "Mutated by caller";
    expect(second.nodes[0]!.progress).not.toBe("Mutated by caller");
  });
});
