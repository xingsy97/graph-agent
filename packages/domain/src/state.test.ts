import { describe, expect, it } from "vitest";
import { assertNodeTransition, assertRunTransition, canTransitionNode, canTransitionRun, cancelBlockedNodes, resetRun, scheduleReadyNodes, StateTransitionError, transitionNode } from "./state";
import type { TaskNode, TaskRun } from "./types";

const node: TaskNode = {
  id: "node",
  title: "Node",
  task: "Do work",
  status: "pending",
  progress: "Waiting",
  depth: 0,
};

describe("state transitions", () => {
  it("applies lifecycle timestamps from its explicit clock", () => {
    const started = transitionNode(node, "running", "2026-08-18T02:00:00.000Z", { progress: "Starting agent" });
    const completed = transitionNode(started, "succeeded", "2026-08-18T02:01:00.000Z", { progress: "Completed", result: "Done" });

    expect(completed).toMatchObject({
      status: "succeeded",
      progress: "Completed",
      result: "Done",
      startedAt: "2026-08-18T02:00:00.000Z",
      completedAt: "2026-08-18T02:01:00.000Z",
    });
  });

  it("schedules only nodes whose dependencies completed", () => {
    const run: TaskRun = {
      id: "run", task: "Test", workspacePath: "C:\\test", runtime: "mock", status: "running", speed: "balanced", workflow: "adaptive", graphVersion: 1,
      nodes: [
        { ...node, id: "complete", status: "succeeded" },
        { ...node, id: "ready", status: "pending" },
        { ...node, id: "blocked", status: "pending" },
        { ...node, id: "in-progress", status: "running" },
      ],
      edges: [
        { id: "complete-ready", source: "complete", target: "ready" },
        { id: "in-progress-blocked", source: "in-progress", target: "blocked" },
      ],
      decisions: [], events: [], createdAt: "2026-08-18T02:00:00.000Z", updatedAt: "2026-08-18T02:00:00.000Z",
    };

    const scheduled = scheduleReadyNodes(run, "2026-08-18T02:01:00.000Z");
    expect(scheduled.nodes.find((candidate) => candidate.id === "ready")).toMatchObject({ status: "ready", progress: "Ready to run" });
    expect(scheduled.nodes.find((candidate) => candidate.id === "blocked")?.status).toBe("pending");
  });

  it("schedules roots and nodes whose dependencies were replaced, but leaves terminal runs unchanged", () => {
    const run: TaskRun = {
      id: "run", task: "Test", workspacePath: "C:\\test", runtime: "mock", status: "running", speed: "balanced", workflow: "adaptive", graphVersion: 1,
      nodes: [
        { ...node, id: "root", status: "pending" },
        { ...node, id: "replaced", status: "replaced", replacedBy: "replacement" },
        { ...node, id: "replacement", status: "succeeded" },
        { ...node, id: "after-replacement", status: "pending" },
      ],
      edges: [
        { id: "replaced-replacement", source: "replaced", target: "replacement" },
        { id: "replaced-after", source: "replaced", target: "after-replacement" },
      ],
      decisions: [], events: [], createdAt: "2026-08-18T02:00:00.000Z", updatedAt: "2026-08-18T02:00:00.000Z",
    };

    const scheduled = scheduleReadyNodes(run, "2026-08-18T02:01:00.000Z");
    expect(scheduled.nodes.filter((candidate) => candidate.status === "ready").map((candidate) => candidate.id)).toEqual([
      "root",
      "after-replacement",
    ]);

    const terminal = { ...scheduled, status: "completed" as const };
    expect(scheduleReadyNodes(terminal, "2026-08-18T02:02:00.000Z")).toBe(terminal);
  });

  it("cancels downstream work after a dependency failure and resets a run", () => {
      const run: TaskRun = {
        id: "run", task: "Test", workspacePath: "C:\\test", runtime: "mock", status: "failed", speed: "balanced", workflow: "adaptive", graphVersion: 1,
        nodes: [
          { ...node, id: "failed", status: "failed", error: "Agent error", completedAt: "2026-08-18T02:01:00.000Z" },
          { ...node, id: "downstream", status: "pending" },
          { ...node, id: "done", status: "succeeded", result: "Old output", completedAt: "2026-08-18T02:01:00.000Z" },
        ],
        edges: [{ id: "failed-downstream", source: "failed", target: "downstream" }],
        decisions: [], events: [], createdAt: "2026-08-18T02:00:00.000Z", updatedAt: "2026-08-18T02:00:00.000Z",
      };

      const blocked = cancelBlockedNodes(run, "2026-08-18T02:02:00.000Z");
      expect(blocked.nodes.find((candidate) => candidate.id === "downstream")?.status).toBe("cancelled");

      const reset = resetRun(blocked, "2026-08-18T02:03:00.000Z");
      expect(reset.status).toBe("running");
      expect(reset.nodes).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "failed", status: "pending", progress: "Waiting for dependencies" }),
        expect.objectContaining({ id: "downstream", status: "pending" }),
        expect.objectContaining({ id: "done", status: "pending" }),
      ]));
      expect(reset.nodes.find((candidate) => candidate.id === "failed")).not.toHaveProperty("error");
      expect(reset.nodes.find((candidate) => candidate.id === "done")).not.toHaveProperty("result");
     expect(reset.nodes.find((candidate) => candidate.id === "failed")).not.toHaveProperty("startedAt");
     expect(reset.nodes.find((candidate) => candidate.id === "done")).not.toHaveProperty("completedAt");
     expect(reset.edges).toBe(blocked.edges);
     expect(reset.events).toBe(blocked.events);
  });

  it("allows documented lifecycle transitions and makes terminal outcomes immutable", () => {
   expect(canTransitionNode("pending", "ready")).toBe(true);
   expect(canTransitionNode("running", "failed")).toBe(true);
   expect(canTransitionNode("expanding", "replaced")).toBe(true);
   expect(canTransitionRun("running", "completed")).toBe(true);
   expect(canTransitionRun("running", "failed")).toBe(true);
   expect(canTransitionRun("running", "cancelled")).toBe(true);

   for (const status of ["succeeded", "failed", "cancelled", "replaced"] as const) {
     expect(canTransitionNode(status, "running")).toBe(false);
     expect(() => assertNodeTransition(status, "running")).toThrow(StateTransitionError);
   }
   for (const status of ["completed", "failed", "cancelled"] as const) {
     expect(canTransitionRun(status, "running")).toBe(false);
     expect(() => assertRunTransition(status, "running")).toThrow(StateTransitionError);
   }
  });
});
