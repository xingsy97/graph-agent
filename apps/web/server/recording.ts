import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  calculateTimeSavings,
  type ReplayRecording,
  type ReplaySummary,
  type TaskRun,
  type WorkspaceReport,
} from "@graph-agent/domain";
import { workspaceService } from "./workspace";

const recordingsRoot =
  process.env.GRAPH_AGENT_RECORDINGS_DIR ??
  path.join(
    process.env.LOCALAPPDATA ?? os.tmpdir(),
    "GraphAgent",
    "recordings",
  );

export class RunRecordingService {
  private writes = new Map<string, Promise<void>>();
  private memory = new Map<string, ReplayRecording>();
  constructor(private readonly root = recordingsRoot) {}

  record(run: TaskRun): void {
    const snapshot = structuredClone(run);
    const previous = this.writes.get(run.id) ?? Promise.resolve();
    const next = previous
      .then(() => this.persist(snapshot))
      .catch((error) => console.error("Unable to persist replay", error));
    this.writes.set(run.id, next);
  }

  async flush(runId?: string): Promise<void> {
    if (runId) await this.writes.get(runId)?.catch(() => undefined);
    else
      await Promise.all(
        [...this.writes.values()].map((write) => write.catch(() => undefined)),
      );
  }

  async attachReport(runId: string, report: WorkspaceReport): Promise<void> {
    const previous =
      this.writes.get(runId)?.catch(() => undefined) ?? Promise.resolve();
    const next = previous.then(async () => {
      const recording =
        this.memory.get(runId) ?? (await this.getFromDisk(runId));
      if (!recording) return;
      const updated = { ...recording, report: structuredClone(report) };
      this.memory.set(runId, updated);
      await this.writeRecording(updated);
    });
    this.writes.set(runId, next);
    await next;
  }

  async get(runId: string): Promise<ReplayRecording | undefined> {
    await this.flush(runId);
    if (this.memory.has(runId)) return structuredClone(this.memory.get(runId)!);
    try {
      return JSON.parse(
        await readFile(path.join(this.root, `${runId}.json`), "utf8"),
      ) as ReplayRecording;
    } catch {
      return undefined;
    }
  }

  async list(): Promise<ReplaySummary[]> {
    await this.flush();
    const files = await readdir(this.root).catch(() => []);
    const recordings = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map((file) =>
          readFile(path.join(this.root, file), "utf8")
            .then((text) => JSON.parse(text) as ReplayRecording)
            .catch(() => undefined),
        ),
    );
    return recordings
      .filter((recording): recording is ReplayRecording => Boolean(recording))
      .map(({ frames, ...recording }) => ({
        ...recording,
        frameCount: frames.length,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async persist(run: TaskRun): Promise<void> {
    const existing =
      this.memory.get(run.id) ?? (await this.getFromDisk(run.id));
    const first = existing?.frames[0]?.run.createdAt ?? run.createdAt;
    const offsetMs = Math.max(
      0,
      new Date(run.updatedAt).getTime() - new Date(first).getTime(),
    );
    const metrics = calculateTimeSavings(run);
    const frames = existing?.frames ?? [];
    const last = frames.at(-1);
    const signature = JSON.stringify(run);
    if (!last || JSON.stringify(last.run) !== signature)
      frames.push({
        sequence: frames.length,
        offsetMs,
        recordedAt: new Date().toISOString(),
        run,
        metrics,
      });
    const terminal = ["completed", "failed", "cancelled"].includes(
      run.status,
    );
    const report =
      existing?.report ??
      (terminal ? await workspaceService.report(run).catch(() => undefined) : undefined);
    const recording: ReplayRecording = {
      id: run.id,
      task: run.task,
      runtime: run.runtime,
      workspacePath: run.workspacePath,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      status: run.status,
      durationMs: offsetMs,
      frames,
      metrics,
      ...(report ? { report } : {}),
    };
    this.memory.set(run.id, recording);
    await this.writeRecording(recording);
  }

  private async writeRecording(recording: ReplayRecording): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const file = path.join(this.root, `${recording.id}.json`);
    const temporary = `${file}.${process.pid}.tmp`;
    const contents = JSON.stringify(recording);
    await writeFile(temporary, contents, "utf8");
    try {
      await rename(temporary, file);
    } catch {
      // Antivirus/indexers can briefly lock the destination on Windows. The
      // complete temp file remains the source of truth for this fallback.
      await writeFile(file, contents, "utf8");
      await rm(temporary, { force: true });
    }
  }

  private async getFromDisk(
    runId: string,
  ): Promise<ReplayRecording | undefined> {
    try {
      return JSON.parse(
        await readFile(path.join(this.root, `${runId}.json`), "utf8"),
      ) as ReplayRecording;
    } catch {
      return undefined;
    }
  }
}

declare global {
  var graphAgentRecordingService: RunRecordingService | undefined;
}
export const recordingService = (globalThis.graphAgentRecordingService ??=
  new RunRecordingService());
