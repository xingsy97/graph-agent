import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRun } from "@graph-agent/domain";
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
    return <div><button onClick={() => props.onPaneClick?.()}>Graph pane</button>{props.nodes.map((node) => <button key={node.id} onClick={() => props.onNodeClick?.(null, node)}>{node.data.title}</button>)}</div>;
  },
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  close = vi.fn();
  constructor(public url: string) { MockEventSource.instances.push(this); }
}

describe("Workspace", () => {
  const fetchMock = vi.fn();
  const run = createRun();

  beforeEach(() => {
    flowProps = undefined;
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === "/api/workspaces") return Promise.resolve(new Response(JSON.stringify({ workspaces: [{ path: "C:\\workspace\\demo", label: "Demo" }], runtime: "mock" })));
      if (input === "/api/runs" && init?.method === "POST") return Promise.resolve(new Response(JSON.stringify(run)));
      if (input === "/api/runs/run-1" && init?.method === "PATCH") return Promise.resolve(new Response(JSON.stringify({ ...run, status: "paused" })));
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
    await screen.findByDisplayValue("C:\\workspace\\demo");
    fireEvent.click(screen.getByRole("button", { name: /Start run/ }));
    await screen.findByRole("button", { name: "Build release" });

    expect(flowProps?.nodes.map((node) => node.id)).not.toContain("obsolete");
    fireEvent.click(screen.getByRole("button", { name: "Build release" }));
    expect(await screen.findByRole("heading", { name: "Build release" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Focus" }));
    expect(flowProps?.nodes.map((node) => node.id)).toEqual(["plan", "build", "verify"]);

    fireEvent.click(screen.getByRole("button", { name: "Graph pane" }));
    expect(await screen.findByRole("heading", { name: "Run overview" })).not.toBeNull();
    expect(flowProps?.nodes.map((node) => node.id)).not.toContain("obsolete");
  });

  it("sends pause requests and exposes run status through the live region", async () => {
    render(<Workspace />);
    await screen.findByDisplayValue("C:\\workspace\\demo");
    fireEvent.click(screen.getByRole("button", { name: /Start run/ }));
    await screen.findByRole("button", { name: "Pause" });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/runs/run-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "pause" }) })));
    expect(screen.getByRole("status").textContent).toContain("Run paused. 1 of 3 tasks completed.");
  });

  it("uses outcome-focused copy and names the concurrency control precisely", async () => {
    render(<Workspace />);
    await screen.findByDisplayValue("C:\\workspace\\demo");

    expect(screen.getByPlaceholderText("Describe the outcome you want…")).not.toBeNull();
    expect(screen.getByLabelText("Max parallelism")).not.toBeNull();
    expect(screen.queryByText(/Copilot sessions/i)).toBeNull();
  });

  it("animates only a short completed-dependency handoff into a newly running node", () => {
    const source = { ...run.nodes[0]!, status: "succeeded" as const };
    const startedAt = "2026-08-18T02:00:00.000Z";
    const target = { ...run.nodes[1]!, status: "running" as const, startedAt };
    const edge = { id: "handoff", source: source.id, target: target.id, transferStartedAt: startedAt };
    const start = new Date(startedAt).getTime();

    expect(isDependencyTransferring(edge, source, target, start + 1000)).toBe(true);
    expect(isDependencyTransferring(edge, source, target, start + 3000)).toBe(false);
    expect(isDependencyTransferring({ id: edge.id, source: edge.source, target: edge.target }, source, target, start + 1000)).toBe(false);
    expect(isDependencyTransferring(edge, { ...source, status: "running" }, target, start + 1000)).toBe(false);
    expect(isDependencyTransferring(edge, source, { ...target, status: "succeeded" }, start + 1000)).toBe(false);
  });
});
