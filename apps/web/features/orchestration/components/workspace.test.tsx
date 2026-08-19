import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReplayRecording, TaskRun } from "@graph-agent/domain";
import { isDependencyTransferring, Workspace } from "./workspace";
import { createRun } from "./component-fixtures";

interface FlowProps {
  nodes: Array<{ id: string; data: { title: string } }>;
  onNodeClick?: (_: unknown, node: { id: string }) => void;
  onPaneClick?: () => void;
}

let flowProps: FlowProps | undefined;

vi.mock("@xyflow/react", () => ({
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  MarkerType: { ArrowClosed: "arrowclosed" },
  Position: { Left: "left", Right: "right" },
  Handle: () => null,
  ReactFlow: (props: FlowProps) => {
    flowProps = props;
    return (
      <div>
        <button onClick={() => props.onPaneClick?.()}>Graph pane</button>
        {props.nodes.map((node) => (
          <button key={node.id} onClick={() => props.onNodeClick?.(null, node)}>
            {node.data.title}
          </button>
        ))}
      </div>
    );
  },
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }
}

describe("Workspace", () => {
  const fetchMock = vi.fn();
  const run = createRun();

  beforeEach(() => {
    flowProps = undefined;
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === "/api/workspaces")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              workspaces: [{ path: "C:\\workspace\\demo", label: "Demo" }],
              runtime: "mock",
            }),
          ),
        );
      if (input.startsWith("/api/workspaces?path="))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              path: "C:\\workspace\\demo",
              parent: "C:\\workspace",
              entries: [
                {
                  name: "src",
                  path: "C:\\workspace\\demo\\src",
                },
              ],
            }),
          ),
        );
      if (input === "/api/runs" && init?.method === "POST")
        return Promise.resolve(new Response(JSON.stringify(run)));
      if (input === "/api/runs/run-1" && init?.method === "PATCH")
        return Promise.resolve(
          new Response(JSON.stringify({ ...run, status: "paused" })),
        );
      return Promise.resolve(new Response(JSON.stringify(run)));
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("selects graph nodes, focuses active neighbors, and restores the overview from the pane", async () => {
    render(<Workspace />);
    await screen.findByText("C:\\workspace\\demo");
    fireEvent.click(screen.getByRole("button", { name: /Start run/ }));
    await screen.findByRole("button", { name: "Build release" });

    expect(flowProps?.nodes.map((node) => node.id)).not.toContain("obsolete");
    fireEvent.click(screen.getByRole("button", { name: "Build release" }));
    expect(
      await screen.findByRole("heading", { name: "Build release" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(flowProps?.nodes.map((node) => node.id)).toEqual([
      "plan",
      "build",
      "verify",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Graph pane" }));
    expect(
      await screen.findByRole("heading", { name: "Run overview" }),
    ).not.toBeNull();
    expect(flowProps?.nodes.map((node) => node.id)).not.toContain("obsolete");
  });

  it("sends pause requests and exposes run status through the live region", async () => {
    render(<Workspace />);
    await screen.findByText("C:\\workspace\\demo");
    fireEvent.click(screen.getByRole("button", { name: /Start run/ }));
    await screen.findByRole("button", { name: "Pause" });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/runs/run-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ action: "pause" }),
        }),
      ),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Run paused. 1 of 3 tasks completed.",
    );
  });

  it("uses outcome-focused copy and names the concurrency control precisely", async () => {
    render(<Workspace />);
    await screen.findByText("C:\\workspace\\demo");

    expect(
      screen.getByPlaceholderText("Describe the outcome you want…"),
    ).not.toBeNull();
    expect(screen.getByLabelText("Task").tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText("Max parallelism")).not.toBeNull();
    expect(screen.queryByLabelText("Workflow")).toBeNull();
    expect(screen.queryByLabelText("Workflow stages")).toBeNull();
    expect(
      screen.getByRole("heading", {
        name: /Easier to understand.*Faster to execute. Smarter by design/,
      }),
    ).not.toBeNull();
    expect(screen.queryByText(/Describe the outcome once/)).toBeNull();
    expect(screen.queryByText(/Copilot sessions/i)).toBeNull();
  });

  it("restores the most recently updated active run after a page load", async () => {
    const older = createRun({ id: "older-run", updatedAt: "2026-08-18T02:00:00.000Z" });
    const latest = createRun({
      id: "latest-run",
      task: "Continue the active Todo build",
      graphVersion: 7,
      updatedAt: "2026-08-18T03:00:00.000Z",
    });
    fetchMock.mockImplementation((input: string) => {
      if (input === "/api/workspaces")
        return Promise.resolve(
          new Response(
            JSON.stringify({
              workspaces: [{ path: latest.workspacePath, label: "Demo" }],
              runtime: "mock",
            }),
          ),
        );
      if (input === "/api/runs")
        return Promise.resolve(new Response(JSON.stringify([older, latest])));
      if (input === "/api/replays")
        return Promise.resolve(new Response(JSON.stringify({ recordings: [] })));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<Workspace />);

    expect(await screen.findByText("Graph v7")).not.toBeNull();
    expect(await screen.findByText("Continue the active Todo build")).not.toBeNull();
    expect(MockEventSource.instances[0]?.url).toBe(
      "/api/runs/latest-run/events",
    );
  });

  it("browses and confirms a working directory in a modal", async () => {
    render(<Workspace />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Working directory/ }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: "Choose working directory",
      }),
    ).not.toBeNull();
    expect(await screen.findByRole("button", { name: /src/ })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use this folder" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("animates only a short completed-dependency handoff into a newly running node", () => {
    const source = { ...run.nodes[0]!, status: "succeeded" as const };
    const startedAt = "2026-08-18T02:00:00.000Z";
    const target = { ...run.nodes[1]!, status: "running" as const, startedAt };
    const edge = {
      id: "handoff",
      source: source.id,
      target: target.id,
      transferStartedAt: startedAt,
    };
    const start = new Date(startedAt).getTime();

    expect(isDependencyTransferring(edge, source, target, start + 1000)).toBe(
      true,
    );
    expect(isDependencyTransferring(edge, source, target, start + 3000)).toBe(
      false,
    );
    expect(
      isDependencyTransferring(
        { id: edge.id, source: edge.source, target: edge.target },
        source,
        target,
        start + 1000,
      ),
    ).toBe(false);
    expect(
      isDependencyTransferring(
        edge,
        { ...source, status: "running" },
        target,
        start + 1000,
      ),
    ).toBe(false);
    expect(
      isDependencyTransferring(
        edge,
        source,
        { ...target, status: "succeeded" },
        start + 1000,
      ),
    ).toBe(false);
  });

  it("replays a recorded run from the beginning and rolls future state back when scrubbed", async () => {
    const initial = createRun({
      task: "Replay the Todo build",
      graphVersion: 1,
      nodes: [
        {
          id: "plan",
          title: "Plan Todo architecture",
          task: "Plan",
          status: "running",
          progress: "Mapping workstreams",
          depth: 0,
          startedAt: "2026-08-18T02:00:00.000Z",
        },
      ],
      edges: [],
      decisions: [],
      events: [],
    });
    const decision = {
      id: "decision-1",
      runId: initial.id,
      nodeId: "platform-choice",
      question: "Which desktop signing identity should be used?",
      context: "This affects release ownership.",
      choices: ["Team A", "Team B"],
      allowFreeform: false,
      reason: "Only the owner can choose the signing identity.",
      riskLevel: "L3" as const,
      status: "pending" as const,
      createdAt: "2026-08-18T02:00:05.000Z",
    };
    const evolved = createRun({
      task: initial.task,
      graphVersion: 2,
      nodes: [
        ...initial.nodes.map((node) => ({
          ...node,
          status: "succeeded" as const,
          progress: "Architecture ready",
          completedAt: "2026-08-18T02:00:04.000Z",
        })),
        {
          id: "platform-choice",
          title: "Confirm signing owner",
          task: "Confirm signing owner",
          status: "waiting_user",
          progress: "Waiting for a principle-level decision",
          depth: 1,
        },
      ],
      edges: [
        { id: "plan-choice", source: "plan", target: "platform-choice" },
      ],
      decisions: [decision],
      events: [
        {
          id: 1,
          type: "graph",
          message: "Graph expanded",
          createdAt: "2026-08-18T02:00:05.000Z",
        },
      ],
      updatedAt: "2026-08-18T02:00:05.000Z",
    });
    const recording: ReplayRecording = {
      id: initial.id,
      task: initial.task,
      runtime: "mock",
      workspacePath: initial.workspacePath,
      createdAt: initial.createdAt,
      updatedAt: evolved.updatedAt,
      status: "running",
      durationMs: 5000,
      metrics: { serialMinutes: 10, parallelMinutes: 6, savedMinutes: 4, savedPercent: 40, actualElapsedMinutes: 0.1 },
      frames: [
        { sequence: 0, offsetMs: 0, recordedAt: initial.createdAt, run: initial, metrics: { serialMinutes: 5, parallelMinutes: 5, savedMinutes: 0, savedPercent: 0, actualElapsedMinutes: 0 } },
        { sequence: 1, offsetMs: 5000, recordedAt: evolved.updatedAt, run: evolved, metrics: { serialMinutes: 10, parallelMinutes: 6, savedMinutes: 4, savedPercent: 40, actualElapsedMinutes: 0.1 } },
      ],
    };
    fetchMock.mockImplementation((input: string) => {
      if (input === "/api/workspaces")
        return Promise.resolve(new Response(JSON.stringify({ workspaces: [{ path: initial.workspacePath, label: "Demo" }], runtime: "mock" })));
      if (input === "/api/replays")
        return Promise.resolve(new Response(JSON.stringify({ recordings: [{ ...recording, frames: undefined, frameCount: 2 }] })));
      if (input === `/api/replays/${initial.id}`)
        return Promise.resolve(new Response(JSON.stringify(recording)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    render(<Workspace />);
    expect(await screen.findByText("History")).not.toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: /Replay the Todo build/ }));
    expect(await screen.findByLabelText("Pause replay")).not.toBeNull();
    expect(await screen.findByRole("button", { name: "Plan Todo architecture" })).not.toBeNull();
    expect(MockEventSource.instances).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Replay timeline"), { target: { value: "5000" } });
    expect(await screen.findByText(decision.question)).not.toBeNull();
    expect(screen.getByText("Replay is read-only")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Replay timeline"), { target: { value: "0" } });
    await waitFor(() => expect(screen.queryByText(decision.question)).toBeNull());
    await waitFor(() =>
      expect(flowProps?.nodes.map((node) => node.id)).toEqual(["plan"]),
    );
  });
});
