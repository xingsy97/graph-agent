import { describe, expect, it } from "vitest";
import { RunStore } from "./store";

describe("RunStore", () => {
  it("returns in-flight nodes to the ready queue when a run is paused", () => {
    const store = new RunStore();
    const run = store.create("Build a demo", "C:\\workspace\\demo", {
      speed: "balanced",
      workflow: "adaptive",
    });

    store.schedule(run.id);
    store.startNode(run.id, run.nodes[0]!.id);
    expect(store.pause(run.id)).toEqual([run.nodes[0]!.id]);

    expect(store.snapshot(run.id)).toMatchObject({
      status: "paused",
      nodes: [expect.objectContaining({
        id: run.nodes[0]!.id,
        status: "ready",
        progress: "Paused; ready to resume",
      })],
    });
  });
});
