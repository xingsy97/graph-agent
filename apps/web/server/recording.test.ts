import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDemoRun } from "@graph-agent/domain";
import { RunRecordingService } from "./recording";

describe("RunRecordingService", () => {
  it("persists ordered full snapshots that another service can replay", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "graph-agent-recording-"),
    );
    const service = new RunRecordingService(root);
    const run = createDemoRun(
      "replay-run",
      "Build a demo",
      root,
      "mock",
      Date.parse("2026-08-18T00:00:00.000Z"),
    );
    service.record(run);
    service.record({
      ...run,
      updatedAt: "2026-08-18T00:00:05.000Z",
      nodes: run.nodes.map((node) => ({
        ...node,
        status: "running" as const,
        startedAt: "2026-08-18T00:00:05.000Z",
      })),
    });
    await service.flush(run.id);

    const restored = await new RunRecordingService(root).get(run.id);
    expect(restored?.frames).toHaveLength(2);
    expect(restored?.frames[1]).toMatchObject({
      sequence: 1,
      offsetMs: 5000,
      run: { nodes: [expect.objectContaining({ status: "running" })] },
    });
    expect(
      JSON.parse(await readFile(path.join(root, `${run.id}.json`), "utf8")),
    ).toMatchObject({ id: run.id, frames: expect.any(Array) });
  });

  it("freezes the final workspace report into a terminal recording", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "graph-agent-final-recording-"),
    );
    const service = new RunRecordingService(root);
    const run = createDemoRun(
      "terminal-run",
      "Build a demo",
      root,
      "mock",
      Date.parse("2026-08-18T00:00:00.000Z"),
    );
    service.record({
      ...run,
      status: "completed",
      updatedAt: "2026-08-18T00:01:00.000Z",
      nodes: run.nodes.map((node) => ({
        ...node,
        status: "succeeded" as const,
        result: "Done",
      })),
    });
    await service.flush(run.id);

    expect((await service.get(run.id))?.report).toMatchObject({
      workspacePath: root,
      changes: expect.any(Array),
      completedOutputs: expect.arrayContaining([
        expect.objectContaining({ result: "Done" }),
      ]),
    });
  });
});
