import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  TaskRun,
  WorkspaceChange,
  WorkspaceReport,
} from "@graph-agent/domain";

const execFileAsync = promisify(execFile);
const ignored = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
]);
type Fingerprint = { size: number; modified: number };

class WorkspaceService {
  private readonly baselines = new Map<string, Map<string, Fingerprint>>();

  async validate(input: string): Promise<string> {
    const resolved = path.resolve(input.trim());
    const info = await stat(resolved).catch(() => undefined);
    if (!info?.isDirectory())
      throw new Error("Workspace path must be an existing directory");
    return resolved;
  }

  async suggestions(): Promise<Array<{ path: string; label: string }>> {
    const current = process.cwd();
    const parent = path.dirname(current);
    const siblings = await readdir(/* turbopackIgnore: true */ parent, {
      withFileTypes: true,
    }).catch(() => []);
    return [
      { path: current, label: "Current project" },
      ...siblings
        .filter(
          (entry) =>
            entry.isDirectory() &&
            !entry.name.startsWith(".") &&
            path.join(/* turbopackIgnore: true */ parent, entry.name) !==
              current,
        )
        .slice(0, 8)
        .map((entry) => ({
          path: path.join(/* turbopackIgnore: true */ parent, entry.name),
          label: entry.name,
        })),
    ];
  }

  async browse(
    input?: string,
  ): Promise<{
    path: string;
    parent: string | null;
    entries: Array<{ name: string; path: string }>;
  }> {
    const requested = input?.trim() || process.cwd();
    const current = await this.validate(requested);
    const entries = await readdir(/* turbopackIgnore: true */ current, {
      withFileTypes: true,
    });
    const parent = path.dirname(current);
    return {
      path: current,
      parent: parent === current ? null : parent,
      entries: entries
        .filter(
          (entry) =>
            entry.isDirectory() &&
            !entry.name.startsWith(".") &&
            !ignored.has(entry.name),
        )
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, 200)
        .map((entry) => ({
          name: entry.name,
          path: path.join(/* turbopackIgnore: true */ current, entry.name),
        })),
    };
  }

  async captureBaseline(runId: string, workspacePath: string): Promise<void> {
    this.baselines.set(runId, await this.scan(workspacePath));
  }

  async report(run: TaskRun): Promise<WorkspaceReport> {
    const before = this.baselines.get(run.id) ?? new Map<string, Fingerprint>();
    const after = await this.scan(run.workspacePath);
    const changes: WorkspaceChange[] = [];
    for (const [file, fingerprint] of after) {
      const previous = before.get(file);
      if (!previous) changes.push({ path: file, kind: "created" });
      else if (
        previous.size !== fingerprint.size ||
        previous.modified !== fingerprint.modified
      )
        changes.push({ path: file, kind: "modified" });
    }
    for (const file of before.keys())
      if (!after.has(file)) changes.push({ path: file, kind: "deleted" });
    const gitBranch = await this.branch(run.workspacePath);
    const verificationPattern =
      /test|verify|validation|build|lint|quality|review/i;
    return {
      workspacePath: run.workspacePath,
      ...(gitBranch ? { gitBranch } : {}),
      changes: changes.slice(0, 250),
      completedOutputs: run.nodes
        .filter((node) => node.result)
        .map((node) => ({
          nodeId: node.id,
          title: node.title,
          result: node.result!,
        })),
      verifications: run.nodes
        .filter((node) =>
          verificationPattern.test(`${node.title} ${node.task}`),
        )
        .map((node) => ({
          nodeId: node.id,
          title: node.title,
          status: node.status,
          ...(node.result ? { result: node.result } : {}),
        })),
      generatedAt: new Date().toISOString(),
    };
  }

  private async scan(root: string): Promise<Map<string, Fingerprint>> {
    const files = new Map<string, Fingerprint>();
    const queue = [root];
    while (queue.length && files.size < 5_000) {
      const directory = queue.shift();
      if (!directory) break;
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        () => [],
      );
      for (const entry of entries) {
        if (ignored.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) queue.push(absolute);
        else if (entry.isFile()) {
          const info = await stat(absolute).catch(() => undefined);
          if (info)
            files.set(path.relative(root, absolute).replaceAll("\\", "/"), {
              size: info.size,
              modified: info.mtimeMs,
            });
        }
      }
    }
    return files;
  }

  private async branch(root: string): Promise<string | undefined> {
    try {
      return (
        (
          await execFileAsync("git", ["branch", "--show-current"], {
            cwd: root,
            timeout: 5_000,
          })
        ).stdout.trim() || undefined
      );
    } catch {
      return undefined;
    }
  }
}

declare global {
  var graphAgentWorkspaceService: WorkspaceService | undefined;
}
export const workspaceService = (globalThis.graphAgentWorkspaceService ??=
  new WorkspaceService());
