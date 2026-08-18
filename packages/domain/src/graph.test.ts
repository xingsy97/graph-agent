import { describe, expect, it } from "vitest";
import { assertDag, GraphError, replaceNode, runnableNodeIds } from "./graph";
import type { TaskRun } from "./types";

function runFixture(): TaskRun {
  return {
    id: "run", task: "ship", workspacePath: "C:/workspace", runtime: "mock", status: "running", speed: "balanced", workflow: "adaptive", graphVersion: 1, decisions: [], events: [],
    createdAt: "2026-01-01", updatedAt: "2026-01-01",
    nodes: [
      { id: "a", title: "A", task: "A", status: "succeeded", progress: "done", depth: 0 },
      { id: "b", title: "B", task: "B", status: "running", progress: "run", depth: 0 },
      { id: "c", title: "C", task: "C", status: "pending", progress: "wait", depth: 0 },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }, { id: "bc", source: "b", target: "c" }],
  };
}

describe("DAG domain", () => {
  it("rejects cycles", () => {
    expect(() => assertDag(["a", "b"], [{ source: "a", target: "b" }, { source: "b", target: "a" }])).toThrow(GraphError);
  });

  it("only returns dependency-free pending nodes", () => {
    const run = runFixture();
    run.nodes[1]!.status = "succeeded";
    expect(runnableNodeIds(run)).toEqual(["c"]);
  });

  it("reconnects all subgraph exits to the old successor", () => {
    const result = replaceNode(runFixture(), {
      expectedGraphVersion: 1, replacedNodeId: "b", entryNodeId: "entry",
      newGraph: {
        nodes: [
          { id: "entry", title: "Entry", task: "entry" },
          { id: "left", title: "Left", task: "left" },
          { id: "right", title: "Right", task: "right" },
        ],
        edges: [{ source: "entry", target: "left" }, { source: "entry", target: "right" }],
      },
    });
    expect(result.graphVersion).toBe(2);
    expect(result.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "a", target: "entry" }),
      expect.objectContaining({ source: "left", target: "c" }),
      expect.objectContaining({ source: "right", target: "c" }),
    ]));
  });
});
