import { describe, expect, it } from "vitest";
import { calculateTimeSavings } from "./metrics";
import type { TaskRun } from "./types";

describe("time savings metrics", () => {
  it("compares total serial effort with the DAG critical path", () => {
    const run = {
      id: "metrics",
      task: "demo",
      workspacePath: "C:\\tmp",
      runtime: "mock",
      status: "completed",
      speed: "fast",
      workflow: "adaptive",
      graphVersion: 1,
      decisions: [],
      events: [],
      nodes: [
        {
          id: "entry",
          title: "Entry",
          task: "entry",
          status: "succeeded",
          progress: "done",
          depth: 0,
          estimatedDurationMinutes: 2,
        },
        {
          id: "a",
          title: "A",
          task: "a",
          status: "succeeded",
          progress: "done",
          depth: 1,
          estimatedDurationMinutes: 8,
        },
        {
          id: "b",
          title: "B",
          task: "b",
          status: "succeeded",
          progress: "done",
          depth: 1,
          estimatedDurationMinutes: 5,
        },
        {
          id: "end",
          title: "End",
          task: "end",
          status: "succeeded",
          progress: "done",
          depth: 2,
          estimatedDurationMinutes: 3,
        },
      ],
      edges: [
        { id: "1", source: "entry", target: "a" },
        { id: "2", source: "entry", target: "b" },
        { id: "3", source: "a", target: "end" },
        { id: "4", source: "b", target: "end" },
      ],
      createdAt: "2026-08-18T00:00:00.000Z",
      updatedAt: "2026-08-18T00:10:00.000Z",
    } satisfies TaskRun;
    expect(calculateTimeSavings(run)).toMatchObject({
      serialMinutes: 18,
      parallelMinutes: 13,
      savedMinutes: 5,
      savedPercent: 28,
      actualElapsedMinutes: 10,
    });
  });
});
