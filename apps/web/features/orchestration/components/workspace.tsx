"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import type {
  ReplayRecording,
  ReplaySummary,
  RunSpeed,
  TaskEdge,
  TaskNode as DomainNode,
  TaskRun,
  TaskStage,
} from "@graph-agent/domain";
import {
  ArrowUp,
  ChevronsUp,
  CircleAlert,
  Clock3,
  FolderOpen,
  GitBranch,
  History,
  LayoutGrid,
  LocateFixed,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { ActivityConsole } from "./activity-console";
import { BrandMark } from "./brand-mark";
import { ContextPanel, type ContextView } from "./context-panel";
import { GraphEdge } from "./graph-edge";
import { TaskNode, type TaskNodeData } from "./task-node";
import { ThemeToggle } from "./theme-toggle";
import { DagWatermark } from "./dag-watermark";
import { WorkspacePickerModal } from "./workspace-picker-modal";
import { ReplayControls } from "./replay-controls";
import { layoutScheduler, type LayoutPerspective } from "../layout-scheduler";

const nodeTypes = { task: TaskNode };
const edgeTypes = { curved: GraphEdge };
const stages: TaskStage[] = [
  "Discover",
  "Design",
  "Build",
  "Verify",
  "Deliver",
];
const speedOptions: Array<{ value: RunSpeed; label: string }> = [
  { value: "deliberate", label: "10" },
  { value: "balanced", label: "20" },
  { value: "fast", label: "100" },
];
function inferredStage(
  node: DomainNode,
  level: number,
  maxLevel: number,
): TaskStage {
  if (node.stage) return node.stage;
  const title = `${node.title} ${node.task}`;
  if (/deliver|handoff|document|summary|release/i.test(title)) return "Deliver";
  if (/test|verify|validat|review|quality|integrat/i.test(title))
    return "Verify";
  if (/build|implement|create|develop|diagnostic/i.test(title)) return "Build";
  if (/design|architect|model|contract|experience/i.test(title))
    return "Design";
  const normalized = maxLevel ? level / maxLevel : 0;
  return stages[Math.min(4, Math.floor(normalized * 5))] ?? "Discover";
}

function elapsed(node: DomainNode, now = Date.now()): string {
  if (!node.startedAt) return "";
  const end = node.completedAt
    ? new Date(node.completedAt).getTime()
    : now;
  const seconds = Math.max(
    1,
    Math.round((end - new Date(node.startedAt).getTime()) / 1000),
  );
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}

function visibleIds(
  run: TaskRun,
  selectedNodeId: string | null,
  focused: boolean,
): Set<string> {
  const active = new Set(
    run.nodes
      .filter((node) => node.status !== "replaced")
      .map((node) => node.id),
  );
  if (!focused || !selectedNodeId) return active;
  const ids = new Set([selectedNodeId]);
  for (const edge of run.edges)
    if (edge.source === selectedNodeId) ids.add(edge.target);
    else if (edge.target === selectedNodeId) ids.add(edge.source);
  return new Set([...ids].filter((id) => active.has(id)));
}

const TRANSFER_ANIMATION_MS = 2200;
const TRANSFER_FLOW_CYCLE_MS = 1600;
const REFLOW_DISTANCE = 30;
const REFLOW_ANIMATION_MS = 760;

function boundedReflowDelta(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const deltaX = from.x - to.x;
  const deltaY = from.y - to.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= REFLOW_DISTANCE) return { x: deltaX, y: deltaY };
  const scale = REFLOW_DISTANCE / distance;
  return { x: deltaX * scale, y: deltaY * scale };
}

export function isDependencyTransferring(
  edge: TaskEdge,
  source: DomainNode | undefined,
  target: DomainNode | undefined,
  now: number,
): boolean {
  if (
    source?.status !== "succeeded" ||
    target?.status !== "running" ||
    !edge.transferStartedAt
  )
    return false;
  const startedAt = new Date(edge.transferStartedAt).getTime();
  return (
    Number.isFinite(startedAt) &&
    now >= startedAt &&
    now - startedAt <= TRANSFER_ANIMATION_MS
  );
}

function graphElements(
  run: TaskRun | null,
  selectedNodeId: string | null,
  focused: boolean,
  recentlyAdded: Set<string>,
  perspective: LayoutPerspective,
  now: number,
  viewport: { width: number; height: number },
): { nodes: Node<TaskNodeData>[]; edges: Edge[] } {
  if (!run) return { nodes: [], edges: [] };
  const visible = visibleIds(run, selectedNodeId, focused);
  const active = run.nodes.filter((node) => visible.has(node.id));
  const relevantEdges = run.edges.filter(
    (edge) => visible.has(edge.source) && visible.has(edge.target),
  );
  const schedule = layoutScheduler.schedule(
    active,
    relevantEdges,
    perspective,
    viewport,
  );
  const scheduledById = new Map(schedule.nodes.map((node) => [node.id, node]));
  const nodes = active.map((node) => {
    const scheduled = scheduledById.get(node.id)!;
    return {
      id: node.id,
      type: "task",
      position: scheduled.position,
      data: {
        title: node.title,
        status: node.status,
        progress: node.progress,
        selected: node.id === selectedNodeId,
        elapsed: elapsed(node, now),
        stage: scheduled.stage,
        isNew: recentlyAdded.has(node.id),
        layoutDirection: schedule.direction,
        sourcePosition: scheduled.sourcePosition,
        targetPosition: scheduled.targetPosition,
        ...(node.estimatedDurationMinutes
          ? { estimatedDurationMinutes: node.estimatedDurationMinutes }
          : {}),
      },
    };
  });
  const edges = relevantEdges.map((edge) => {
    const source = run.nodes.find((node) => node.id === edge.source);
    const target = run.nodes.find((node) => node.id === edge.target);
    const blocked = target?.status === "waiting_user";
    const complete = source?.status === "succeeded";
    const transferring = isDependencyTransferring(edge, source, target, now);
    const transferElapsed = edge.transferStartedAt
      ? Math.max(0, now - new Date(edge.transferStartedAt).getTime())
      : 0;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "curved",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      // A dependency moves only during the bounded handoff that starts its target node.
      animated: transferring && !blocked,
      data: { animationDelayMs: -(transferElapsed % TRANSFER_FLOW_CYCLE_MS) },
      className: blocked
        ? "edge-blocked"
        : transferring
          ? "edge-transferring"
          : complete
            ? "edge-complete"
            : "",
    };
  });
  return { nodes, edges };
}

function runSummary(run: TaskRun): string {
  const active = run.nodes.filter((node) => node.status !== "replaced");
  const running = active.filter((node) => node.status === "running");
  if (run.status === "completed")
    return "All workstreams completed. The run result is ready to review.";
  if (run.decisions.some((decision) => decision.status === "pending"))
    return "A principle-level decision needs you; independent work continues in parallel.";
  if (running.length > 1)
    return `${running
      .map((node) => node.title)
      .slice(0, 2)
      .join(" and ")} are running in parallel.`;
  if (running[0])
    return `${running[0].title} is active; dependent work will begin automatically.`;
  return "Evaluating dependencies and preparing the next workstream.";
}

export function Workspace() {
  const [task, setTask] = useState(
    "Build a production-ready cross-platform Todo app with web and desktop clients. Synchronize tasks in real time across every connected device, with resilient reconnection and offline recovery. Use Node.js, Socket.IO, and SQLite, share domain contracts across clients, and deliver an iOS-inspired interface, automated tests, and clear local setup documentation.",
  );
  const [workspacePath, setWorkspacePath] = useState("");
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<string | null>(
    null,
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [runtimeMode, setRuntimeMode] = useState<"copilot" | "mock">("copilot");
  const [speed, setSpeed] = useState<RunSpeed>("fast");
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [run, setRun] = useState<TaskRun | null>(null);
  const [liveRuns, setLiveRuns] = useState<TaskRun[]>([]);
  const [recordings, setRecordings] = useState<ReplaySummary[]>([]);
  const [recording, setRecording] = useState<ReplayRecording | null>(null);
  const [replayFrame, setReplayFrame] = useState(0);
  const [replayTimeMs, setReplayTimeMs] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextView, setContextView] = useState<ContextView>("overview");
  const [focused, setFocused] = useState(false);
  const [graphToast, setGraphToast] = useState<string | null>(null);
  const [graphAnimating, setGraphAnimating] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [flowNodes, setFlowNodes] = useState<Node<TaskNodeData>[]>([]);
  const [activeStage, setActiveStage] = useState<TaskStage | null>(null);
  const [layoutPerspective, setLayoutPerspective] =
    useState<LayoutPerspective>("topology");
  const [autoFollow, setAutoFollow] = useState(true);
  const [animationClock, setAnimationClock] = useState(0);
  const [graphViewport, setGraphViewport] = useState({
    width: 1200,
    height: 720,
  });
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const graphPanelRef = useRef<HTMLDivElement>(null);
  const flowInstance = useRef<ReactFlowInstance<
    Node<TaskNodeData>,
    Edge
  > | null>(null);
  const flowNodesRef = useRef<Node<TaskNodeData>[]>([]);
  const layoutScope = useRef("");
  const reflowTimer = useRef<number | null>(null);
  const previousVersion = useRef<number | null>(null);
  const previousNodeIds = useRef<Set<string>>(new Set());
  const surfacedDecision = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    if (!run) return;
    const response = await fetch(`/api/runs/${run.id}`);
    if (response.ok) setRun((await response.json()) as TaskRun);
  }, [run]);

  const loadWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    setWorkspaceLoadError(null);
    try {
      const response = await fetch("/api/workspaces");
      if (!response.ok) {
        setWorkspaceLoadError(
          "Unable to load local workspaces. Check the connection and retry.",
        );
        return;
      }
      const data = (await response.json()) as {
        workspaces: Array<{ path: string; label: string }>;
        runtime: "copilot" | "mock";
      };
      setRuntimeMode(data.runtime);
      setWorkspacePath((current) => current || data.workspaces[0]?.path || "");
    } catch {
      setWorkspaceLoadError(
        "Unable to load local workspaces. Check the connection and retry.",
      );
    } finally {
      setWorkspacesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspaces();
    void fetch("/api/runs").then(async (response) => {
      if (!response.ok) return;
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) return;
      const active = (data as TaskRun[])
        .filter((item) => item.status === "running" || item.status === "paused")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      setLiveRuns(active);
      const latest = active[0];
      if (latest) {
        previousVersion.current = latest.graphVersion;
        previousNodeIds.current = new Set(
          latest.nodes
            .filter((node) => node.status !== "replaced")
            .map((node) => node.id),
        );
        setRun((current) => current ?? latest);
      }
    });
    void fetch("/api/replays").then(async (response) => {
      if (!response.ok) return;
      const data = (await response.json()) as { recordings?: ReplaySummary[] };
      setRecordings(Array.isArray(data.recordings) ? data.recordings : []);
    });
  }, [loadWorkspaces]);

  useEffect(() => {
    const panel = graphPanelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.max(
        320,
        Math.round(entry.contentRect.width / 80) * 80,
      );
      const height = Math.max(
        320,
        Math.round((entry.contentRect.height - 56) / 80) * 80,
      );
      setGraphViewport((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });
    observer.observe(panel);
    return () => observer.disconnect();
  }, [run]);

  useEffect(() => {
    if (!moreOpen) return;
    moreMenuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
    const closeMenu = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", closeMenu);
    return () => window.removeEventListener("keydown", closeMenu);
  }, [moreOpen]);

  useEffect(() => {
    if (!run || recording) return;
    const source = new EventSource(`/api/runs/${run.id}/events`);
    source.onmessage = (event) => setRun(JSON.parse(event.data) as TaskRun);
    return () => source.close();
  }, [run?.id, recording]);

  useEffect(() => {
    if (!recording || !replayPlaying) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      const elapsed = (current - previous) * replaySpeed;
      previous = current;
      setReplayTimeMs((value) =>
        Math.min(recording.durationMs, value + elapsed),
      );
    }, 50);
    return () => window.clearInterval(timer);
  }, [recording, replayPlaying, replaySpeed]);

  useEffect(() => {
    if (!recording) return;
    let index = 0;
    for (
      let candidate = 0;
      candidate < recording.frames.length;
      candidate += 1
    ) {
      if (recording.frames[candidate]!.offsetMs <= replayTimeMs)
        index = candidate;
      else break;
    }
    setReplayFrame(index);
    if (replayTimeMs >= recording.durationMs) setReplayPlaying(false);
  }, [recording, replayTimeMs]);

  useEffect(() => {
    if (!recording) return;
    const frame = recording.frames[replayFrame];
    if (!frame) return;
    setRun(frame.run);
    setSelectedNodeId((selected) =>
      selected && frame.run.nodes.some((node) => node.id === selected)
        ? selected
        : null,
    );
  }, [recording, replayFrame]);

  const openReplay = async (runId: string) => {
    const response = await fetch(`/api/replays/${runId}`);
    if (!response.ok) return;
    const loaded = (await response.json()) as ReplayRecording;
    if (loaded.frames.length === 0) return;
    previousVersion.current = loaded.frames[0]!.run.graphVersion;
    previousNodeIds.current = new Set(
      loaded.frames[0]!.run.nodes
        .filter((node) => node.status !== "replaced")
        .map((node) => node.id),
    );
    setRecording(loaded);
    setReplayFrame(0);
    setReplayTimeMs(0);
    setReplayPlaying(true);
    setRun(loaded.frames[0]!.run);
    setSelectedNodeId(null);
    setContextView("overview");
    setFocused(false);
    setAutoFollow(true);
    setMoreOpen(false);
  };

  const openLiveRun = (selected: TaskRun) => {
    previousVersion.current = selected.graphVersion;
    previousNodeIds.current = new Set(
      selected.nodes
        .filter((node) => node.status !== "replaced")
        .map((node) => node.id),
    );
    setRecording(null);
    setReplayPlaying(false);
    setReplayTimeMs(0);
    setRun(selected);
    setSelectedNodeId(null);
    setContextView("overview");
    setFocused(false);
    setAutoFollow(true);
    setMoreOpen(false);
  };

  useEffect(() => {
    if (!run) return;
    if (
      previousVersion.current !== null &&
      run.graphVersion > previousVersion.current
    ) {
      const latest = [...run.events]
        .reverse()
        .find((event) => event.type === "graph");
      setGraphToast(
        latest?.message ?? `Graph updated to version ${run.graphVersion}`,
      );
      const currentIds = new Set(
        run.nodes
          .filter((node) => node.status !== "replaced")
          .map((node) => node.id),
      );
      setRecentlyAdded(
        new Set(
          [...currentIds].filter((id) => !previousNodeIds.current.has(id)),
        ),
      );
      setGraphAnimating(true);
      const toastTimer = setTimeout(() => setGraphToast(null), 5000);
      const animationTimer = setTimeout(() => {
        setGraphAnimating(false);
        setRecentlyAdded(new Set());
      }, 1400);
      previousVersion.current = run.graphVersion;
      previousNodeIds.current = currentIds;
      return () => {
        clearTimeout(toastTimer);
        clearTimeout(animationTimer);
      };
    }
    previousVersion.current = run.graphVersion;
    previousNodeIds.current = new Set(
      run.nodes
        .filter((node) => node.status !== "replaced")
        .map((node) => node.id),
    );
  }, [run?.graphVersion]);

  const pendingDecisionId = run?.decisions.find(
    (decision) => decision.status === "pending",
  )?.id;
  useEffect(() => {
    if (!run) return;
    if (pendingDecisionId && pendingDecisionId !== surfacedDecision.current) {
      surfacedDecision.current = pendingDecisionId;
      setContextView("decision");
    } else if (!pendingDecisionId) {
      surfacedDecision.current = null;
      if (run.status === "completed") setContextView("result");
      else if (recording && contextView === "decision")
        setContextView("overview");
    }
  }, [run?.status, pendingDecisionId]);

  const createRun = async () => {
    if (task.trim().length < 3) {
      setWorkspaceError("Describe a task using at least 3 characters.");
      return;
    }
    if (!workspacePath.trim()) {
      setWorkspaceError("Choose or enter a working directory.");
      return;
    }
    setCreating(true);
    setWorkspaceError(null);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, workspacePath, speed }),
      });
      if (response.ok) {
        const created = (await response.json()) as TaskRun;
        previousVersion.current = created.graphVersion;
        setRun(created);
        setSelectedNodeId(null);
        setContextView("overview");
        setFocused(false);
        setAutoFollow(true);
      } else {
        const error = (await response.json()) as { error?: string };
        setWorkspaceError(error.error ?? "Unable to create the run");
      }
    } catch {
      setWorkspaceError(
        "Unable to create the run. Check the connection and try again.",
      );
    } finally {
      setCreating(false);
    }
  };
  const action = async (
    value: "pause" | "resume" | "cancel" | "reset" | "configure",
    configuration?: Partial<Pick<TaskRun, "speed">>,
  ) => {
    if (!run) return;
    setActionPending(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: value, ...configuration }),
      });
      if (response.ok) setRun((await response.json()) as TaskRun);
      else {
        const error = (await response.json()) as { error?: string };
        setActionError(error.error ?? "Unable to update this run.");
      }
    } catch {
      setActionError(
        "Unable to update this run. Check the connection and try again.",
      );
    } finally {
      setActionPending(false);
    }
  };
  const updateRunConfiguration = (
    configuration: Partial<Pick<TaskRun, "speed">>,
  ) => {
    if (!run) return;
    void action("configure", configuration);
  };
  const selectNode = (id: string) => {
    setSelectedNodeId(id);
    setContextView(
      run?.nodes.find((node) => node.id === id)?.status === "waiting_user"
        ? "decision"
        : "node",
    );
  };
  const startNewRun = () => {
    setRecording(null);
    setReplayTimeMs(0);
    setReplayPlaying(false);
    setRun(null);
    setSelectedNodeId(null);
    setContextView("overview");
    setFocused(false);
    setAutoFollow(true);
    setMoreOpen(false);
    previousVersion.current = null;
  };
  useEffect(() => {
    const now = Date.now();
    const remainingTransfers =
      run?.edges
        .filter((edge) => edge.transferStartedAt)
        .map(
          (edge) =>
            TRANSFER_ANIMATION_MS -
            (now - new Date(edge.transferStartedAt!).getTime()),
        )
        .filter((remaining) => remaining > 0) ?? [];
    setAnimationClock(now);
    if (remainingTransfers.length === 0) return;
    const timer = window.setInterval(() => setAnimationClock(Date.now()), 200);
    const stopTimer = window.setTimeout(
      () => {
        window.clearInterval(timer);
        setAnimationClock(Date.now());
      },
      Math.max(...remainingTransfers) + 50,
    );
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stopTimer);
    };
  }, [run]);
  const effectiveAnimationClock = recording
    ? new Date(recording.createdAt).getTime() + replayTimeMs
    : animationClock;
  const elements = useMemo(
    () =>
      graphElements(
        run,
        selectedNodeId,
        focused,
        recentlyAdded,
        layoutPerspective,
        effectiveAnimationClock,
        graphViewport,
      ),
    [
      run,
      selectedNodeId,
      focused,
      recentlyAdded,
      layoutPerspective,
      effectiveAnimationClock,
      graphViewport,
    ],
  );
  const scope = `${run?.id ?? "empty"}:${run?.graphVersion ?? 0}:${layoutPerspective}:${graphViewport.width}x${graphViewport.height}:${focused ? (selectedNodeId ?? "none") : "all"}`;
  const viewScope = `${run?.id ?? "empty"}:${layoutPerspective}:${graphViewport.width}x${graphViewport.height}:${focused ? (selectedNodeId ?? "none") : "all"}`;
  useEffect(() => {
    // React may replay updater functions in development. Resolve and record
    // the scope before entering the updater so replay cannot preserve stale
    // coordinates and place two nodes into the same layout slot.
    const keepPositions = layoutScope.current === scope;
    layoutScope.current = scope;
    setFlowNodes((current) => {
      const previousNodes = new Map(current.map((node) => [node.id, node]));
      const next = elements.nodes.map((node) => {
        const previous = previousNodes.get(node.id);
        if (keepPositions && previous)
          return {
            ...node,
            position: previous.position,
            data: {
              ...node.data,
              reflowing: previous.data.reflowing ?? false,
              reflowX: previous.data.reflowX ?? 0,
              reflowY: previous.data.reflowY ?? 0,
            },
          };
        if (!previous || node.data.isNew) return node;
        const delta = boundedReflowDelta(previous.position, node.position);
        const moved = Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1;
        return {
          ...node,
          data: {
            ...node.data,
            reflowing: moved,
            reflowX: delta.x,
            reflowY: delta.y,
          },
        };
      });
      if (!keepPositions && next.some((node) => node.data.reflowing)) {
        if (reflowTimer.current) window.clearTimeout(reflowTimer.current);
        reflowTimer.current = window.setTimeout(() => {
          setFlowNodes((nodes) =>
            nodes.map((node) => ({
              ...node,
              data: { ...node.data, reflowing: false, reflowX: 0, reflowY: 0 },
            })),
          );
          reflowTimer.current = null;
        }, REFLOW_ANIMATION_MS);
      }
      return next;
    });
  }, [elements.nodes, scope]);
  useEffect(
    () => () => {
      if (reflowTimer.current) window.clearTimeout(reflowTimer.current);
    },
    [],
  );
  useEffect(() => {
    flowNodesRef.current = flowNodes;
  }, [flowNodes]);
  const fitGraph = useCallback(() => {
    if (!flowInstance.current || flowNodesRef.current.length === 0) return;
    void flowInstance.current.fitView({
      nodes: flowNodesRef.current,
      padding: focused ? 0.24 : 0.08,
      duration: 1050,
      ease: (time) => 1 - Math.pow(1 - time, 4),
      interpolate: "smooth",
      minZoom: focused ? 0.82 : 0.64,
      maxZoom: focused ? 1.02 : 0.92,
    });
  }, [focused]);
  useEffect(() => {
    const timer = window.setTimeout(fitGraph, 120);
    return () => window.clearTimeout(timer);
  }, [viewScope, fitGraph]);
  useEffect(() => {
    if (!autoFollow) return;
    const timer = window.setTimeout(fitGraph, REFLOW_ANIMATION_MS + 90);
    return () => window.clearTimeout(timer);
  }, [run?.graphVersion, autoFollow, fitGraph]);
  const onNodesChange = useCallback(
    (changes: NodeChange<Node<TaskNodeData>>[]) =>
      setFlowNodes((nodes) => applyNodeChanges(changes, nodes)),
    [],
  );
  const resetLayout = () => {
    setActiveStage(null);
    setFlowNodes(elements.nodes);
    window.setTimeout(
      () =>
        flowInstance.current?.fitView({
          nodes: elements.nodes,
          padding: 0.06,
          duration: 650,
          minZoom: 0.68,
          maxZoom: 0.94,
        }),
      0,
    );
  };
  const changeLayoutPerspective = (perspective: LayoutPerspective) => {
    setActiveStage(null);
    setFocused(false);
    setLayoutPerspective(perspective);
  };
  const showStage = (stage: TaskStage) => {
    setFocused(false);
    setActiveStage(stage);
    window.setTimeout(() => {
      const ids = elements.nodes
        .filter((node) => node.data.stage === stage)
        .map(({ id }) => ({ id }));
      if (ids.length)
        flowInstance.current?.fitView({
          nodes: ids,
          padding: 0.42,
          duration: 650,
          minZoom: 0.82,
          maxZoom: 1.04,
        });
    }, 40);
  };
  const selectedNode = run?.nodes.find((node) => node.id === selectedNodeId);
  const active = run?.nodes.filter((node) => node.status !== "replaced") ?? [];
  const complete = active.filter((node) => node.status === "succeeded").length;
  const progress = active.length
    ? Math.round((complete / active.length) * 100)
    : 0;
  const pendingDecisions =
    run?.decisions.filter((decision) => decision.status === "pending").length ??
    0;
  const runningTasks = active.filter((node) => node.status === "running");

  return (
    <main
      className={`app-shell ${run ? "has-run" : ""} ${recording ? "is-replay" : ""} ${recording && !replayPlaying ? "replay-paused" : ""}`}
    >
      <div className="sr-only" role="status" aria-live="polite">
        {actionError ??
          (run
            ? `Run ${run.status}. ${complete} of ${active.length} tasks completed.`
            : "")}
      </div>
      <header className="topbar">
        <a className="brand" href="/">
          <BrandMark />
          <span>
            <b>Graph Agent</b>
            <small>Agent orchestration</small>
          </span>
        </a>
        {run && (
          <div className="run-title">
            <strong>{run.task}</strong>
            <span>
              <i className={`run-dot status-${run.status}`} />
              {run.runtime} · {run.status} · {complete}/{active.length} ·{" "}
              {progress}%
            </span>
          </div>
        )}
        <div className="header-actions">
          {!run && (
            <div className={`runtime-pill runtime-${runtimeMode}`}>
              <i />{" "}
              {runtimeMode === "copilot" ? "Copilot runtime" : "Mock fallback"}
            </div>
          )}
          {run && (
            <div className="top-actions">
              {pendingDecisions > 0 && (
                <button
                  className="attention-pill"
                  onClick={() => setContextView("decision")}
                >
                  <CircleAlert size={16} />
                  {pendingDecisions} needs you
                </button>
              )}
              <label className="run-control">
                <span>Max parallelism</span>
                <select
                  value={run.speed}
                  disabled={
                    Boolean(recording) ||
                    actionPending ||
                    run.status !== "running"
                  }
                  onChange={(event) =>
                    updateRunConfiguration({
                      speed: event.target.value as RunSpeed,
                    })
                  }
                >
                  {speedOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {!recording && run.status === "running" && (
                <button
                  disabled={actionPending}
                  onClick={() => void action("pause")}
                >
                  <Pause size={15} />
                  Pause
                </button>
              )}
              {!recording && run.status === "paused" && (
                <button
                  disabled={actionPending}
                  onClick={() => void action("resume")}
                >
                  <Play size={15} />
                  Resume
                </button>
              )}
              {!recording &&
                ["completed", "failed", "cancelled"].includes(run.status) && (
                  <button
                    disabled={actionPending}
                    onClick={() => void action("reset")}
                  >
                    <RotateCcw size={15} />
                    Run again
                  </button>
                )}
              <div className="more-wrap" ref={moreMenuRef}>
                <button
                  className="more-button"
                  aria-label="More run actions"
                  aria-expanded={moreOpen}
                  aria-controls="run-actions-menu"
                  onClick={() => setMoreOpen((value) => !value)}
                >
                  <MoreHorizontal size={18} />
                </button>
                {moreOpen && (
                  <div className="more-menu" id="run-actions-menu" role="menu">
                    <button role="menuitem" onClick={startNewRun}>
                      <Plus size={15} />
                      New run
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        void navigator.clipboard.writeText(run.id);
                        setMoreOpen(false);
                      }}
                    >
                      <GitBranch size={15} />
                      Copy Run ID
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => {
                        setContextView("change");
                        setMoreOpen(false);
                      }}
                    >
                      <History size={15} />
                      Graph history
                    </button>
                    {recordings
                      .filter((item) => item.id !== run.id)
                      .slice(0, 3)
                      .map((item) => (
                        <button
                          key={item.id}
                          role="menuitem"
                          onClick={() => void openReplay(item.id)}
                        >
                          <Play size={15} />
                          Replay · {item.task.slice(0, 28)}
                        </button>
                      ))}
                    {liveRuns
                      .filter((item) => item.id !== run.id)
                      .slice(0, 3)
                      .map((item) => (
                        <button
                          key={item.id}
                          role="menuitem"
                          onClick={() => openLiveRun(item)}
                        >
                          <LocateFixed size={15} />
                          Live · {item.task.slice(0, 28)}
                        </button>
                      ))}
                    {!recording &&
                      ["running", "paused"].includes(run.status) && (
                        <>
                          <i />
                          <button
                            role="menuitem"
                            className="danger"
                            disabled={actionPending}
                            onClick={() => {
                              void action("cancel");
                              setMoreOpen(false);
                            }}
                          >
                            <X size={15} />
                            Cancel run
                          </button>
                        </>
                      )}
                  </div>
                )}
              </div>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {run && (
        <section className="run-summary-bar">
          {actionError ? (
            <div className="summary-copy summary-error">
              <CircleAlert size={15} />
              <p>{actionError}</p>
            </div>
          ) : runningTasks.length ? (
            <div className="concurrency-overview">
              <div className="concurrency-count">
                <i />
                <strong>
                  {runningTasks.length}{" "}
                  {runningTasks.length === 1 ? "task" : "tasks"} live
                </strong>
                <span>
                  {runningTasks.length === 1
                    ? "Executing the active workstream"
                    : "Running independently in parallel"}
                </span>
              </div>
              <div className="running-task-chips" aria-label="Running tasks">
                {runningTasks.slice(0, 3).map((node) => (
                  <button
                    key={node.id}
                    aria-label={`View running task ${node.title}`}
                    title={node.title}
                    onClick={() => selectNode(node.id)}
                  >
                    <i />
                    {node.title}
                  </button>
                ))}
                {runningTasks.length > 3 && (
                  <span>+{runningTasks.length - 3}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="summary-copy">
              <span className="summary-spark">✦</span>
              <p>{actionError ?? runSummary(run)}</p>
            </div>
          )}
          <div className="summary-meta">
            <span className="workspace-meta" title={run.workspacePath}>
              ⌘ {run.workspacePath}
            </span>
            <span>Graph v{run.graphVersion}</span>
            <button
              className={contextView === "overview" ? "active" : ""}
              onClick={() => {
                setContextView("overview");
                setSelectedNodeId(null);
                setFocused(false);
              }}
            >
              Overview
            </button>
          </div>
        </section>
      )}
      {recording && (
        <ReplayControls
          recording={recording}
          timeMs={replayTimeMs}
          playing={replayPlaying}
          speed={replaySpeed}
          onTime={setReplayTimeMs}
          onPlaying={(playing) => {
            if (playing && replayTimeMs >= recording.durationMs)
              setReplayTimeMs(0);
            setReplayPlaying(playing);
          }}
          onSpeed={setReplaySpeed}
        />
      )}

      <section
        className={`workspace-grid ${run ? "with-context" : "without-context"}`}
      >
        <div
          ref={graphPanelRef}
          className={`graph-panel ${graphAnimating ? "graph-is-updating" : ""}`}
        >
          {!run ? (
            workspacesLoading ? (
              <div className="empty-state launch-loading" role="status">
                <div className="loading-graphic">
                  <Clock3 size={26} />
                </div>
                <div className="eyebrow">Preparing workspace</div>
                <h1>Finding local workspaces</h1>
                <p>Loading available directories and runtime settings.</p>
              </div>
            ) : workspaceLoadError ? (
              <div className="empty-state launch-error" role="alert">
                <div className="error-graphic">
                  <CircleAlert size={26} />
                </div>
                <div className="eyebrow">Connection needed</div>
                <h1>Workspace list unavailable</h1>
                <p>{workspaceLoadError}</p>
                <button
                  className="primary-button hero-button"
                  onClick={() => void loadWorkspaces()}
                >
                  Try again <RotateCcw size={17} />
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <DagWatermark />
                <div className="empty-graphic" aria-hidden="true">
                  <span className="empty-graphic-root">
                    <Workflow size={25} />
                  </span>
                  <i />
                  <span>
                    <GitBranch size={19} />
                  </span>
                  <i />
                  <span>
                    <Sparkles size={18} />
                  </span>
                </div>
                <div className="eyebrow">Adaptive task orchestration</div>
                <h1>Turn work into a living graph</h1>
                <p>
                  Describe an outcome once. The planner maps dependencies, runs
                  independent work in parallel, and pauses only for decisions
                  that need you.
                </p>
                <section className="command-bar" aria-label="Create a run">
                  <div className="launch-composer">
                    <div className="task-input">
                      <Sparkles className="sparkle" size={19} />
                      <input
                        suppressHydrationWarning
                        value={task}
                        onChange={(event) => setTask(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void createRun();
                        }}
                        placeholder="Describe the outcome you want…"
                      />
                      <button
                        className="primary-button"
                        disabled={creating || !workspacePath}
                        onClick={() => void createRun()}
                      >
                        {creating ? (
                          "Creating…"
                        ) : (
                          <>
                            <span>Start run</span>
                            <ArrowUp size={17} />
                          </>
                        )}
                      </button>
                    </div>
                    <div className="launch-settings">
                      <button
                        type="button"
                        className="workspace-picker"
                        onClick={() => setWorkspacePickerOpen(true)}
                      >
                        <FolderOpen size={18} />
                        <span className="workspace-picker-copy">
                          <small>Working directory</small>
                          <strong title={workspacePath}>
                            {workspacePath || "Choose a local folder"}
                          </strong>
                        </span>
                        <span className="workspace-browse">Browse…</span>
                      </button>
                      <div className="launch-controls">
                        <label>
                          <ChevronsUp size={15} />
                          <span>Parallel</span>
                          <select
                            aria-label="Max parallelism"
                            value={speed}
                            onChange={(event) =>
                              setSpeed(event.target.value as RunSpeed)
                            }
                          >
                            {speedOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    {workspaceError && (
                      <p className="workspace-error" role="alert">
                        {workspaceError}
                      </p>
                    )}
                    {(liveRuns.length > 0 || recordings.length > 0) && (
                      <div className="recent-replays">
                        <span>Runs</span>
                        {liveRuns.slice(0, 3).map((item) => (
                          <button
                            className="live-run-card"
                            key={item.id}
                            onClick={() => openLiveRun(item)}
                          >
                            <LocateFixed size={14} />
                            <strong>{item.task}</strong>
                            <small>
                              <i /> {item.status} · Graph v{item.graphVersion}
                            </small>
                          </button>
                        ))}
                        {recordings.slice(0, 3).map((item) => (
                          <button
                            key={item.id}
                            onClick={() => void openReplay(item.id)}
                          >
                            <Play size={14} />
                            <strong>{item.task}</strong>
                            <small>
                              {item.frameCount} events ·{" "}
                              {item.metrics.savedPercent}% faster
                            </small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )
          ) : (
            <>
              <div className="graph-toolbar">
                <div className="graph-view-controls">
                  <div className="segmented-control">
                    <button
                      className={!focused && !activeStage ? "active" : ""}
                      aria-pressed={!focused && !activeStage}
                      onClick={() => {
                        setFocused(false);
                        resetLayout();
                      }}
                    >
                      Full graph
                    </button>
                    <button
                      className={focused ? "active" : ""}
                      aria-pressed={focused}
                      disabled={!selectedNodeId}
                      onClick={() => {
                        setActiveStage(null);
                        setFocused(true);
                      }}
                    >
                      Focus
                    </button>
                  </div>
                  <div
                    className="layout-switch"
                    aria-label="Layout perspective"
                  >
                    <button
                      className={
                        layoutPerspective === "topology" ? "active" : ""
                      }
                      aria-pressed={layoutPerspective === "topology"}
                      onClick={() => changeLayoutPerspective("topology")}
                    >
                      <GitBranch size={14} />
                      Topology
                    </button>
                    <button
                      className={layoutPerspective === "stage" ? "active" : ""}
                      aria-pressed={layoutPerspective === "stage"}
                      onClick={() => changeLayoutPerspective("stage")}
                    >
                      <LayoutGrid size={14} />
                      Stage
                    </button>
                  </div>
                </div>
                {!focused && (
                  <nav className="stage-legend" aria-label="Workflow stages">
                    {stages.map((stage) => {
                      const stageNodes = active.filter(
                        (node) =>
                          (node.stage ??
                            inferredStage(
                              node,
                              node.depth,
                              Math.max(1, ...active.map((item) => item.depth)),
                            )) === stage,
                      );
                      return (
                        <button
                          key={stage}
                          className={activeStage === stage ? "active" : ""}
                          onClick={() => showStage(stage)}
                        >
                          <span>{stage}</span>
                          <small>
                            {
                              stageNodes.filter(
                                (node) => node.status === "succeeded",
                              ).length
                            }
                            /{stageNodes.length}
                          </small>
                          {stageNodes.some(
                            (node) => node.status === "running",
                          ) && <i />}
                        </button>
                      );
                    })}
                  </nav>
                )}
                <div className="graph-tools">
                  <button
                    className={`history-button follow-toggle ${autoFollow ? "active" : ""}`}
                    aria-pressed={autoFollow}
                    title={
                      autoFollow
                        ? "The camera follows graph expansion"
                        : "Resume following graph expansion"
                    }
                    onClick={() => setAutoFollow(true)}
                  >
                    <LocateFixed size={15} />
                    {autoFollow ? "Following" : "Follow graph"}
                  </button>
                  <button className="history-button" onClick={resetLayout}>
                    <RotateCcw size={15} />
                    Reset layout
                  </button>
                  <button
                    className="history-button"
                    onClick={() => setContextView("change")}
                  >
                    <History size={15} />
                    History
                  </button>
                </div>
              </div>
              {focused && selectedNode && (
                <div className="focus-banner">
                  <span>Focused on</span>
                  <strong>{selectedNode.title}</strong>
                  <button onClick={() => setFocused(false)}>Show all</button>
                </div>
              )}
              <ReactFlow
                className="graph-canvas"
                nodes={flowNodes}
                edges={elements.edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onInit={(instance) => {
                  flowInstance.current = instance;
                  window.setTimeout(
                    () =>
                      instance.fitView({
                        padding: 0.06,
                        duration: 0,
                        minZoom: 0.68,
                        maxZoom: 0.94,
                      }),
                    0,
                  );
                }}
                onNodesChange={onNodesChange}
                nodesDraggable
                nodesFocusable
                onMoveStart={(event) => {
                  if (event) setAutoFollow(false);
                }}
                onNodeDragStart={() => setActiveStage(null)}
                onNodeClick={(_, node) => selectNode(node.id)}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setContextView("overview");
                  setFocused(false);
                  setActiveStage(null);
                }}
                minZoom={0.45}
                maxZoom={1.35}
              >
                <Background color="var(--graph-grid)" gap={28} size={1} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor="var(--minimap-node)"
                  maskColor="var(--minimap-mask)"
                />
                <Controls showInteractive={false} />
              </ReactFlow>
              {graphToast && (
                <button
                  className="graph-toast"
                  onClick={() => {
                    setContextView("change");
                    setGraphToast(null);
                  }}
                >
                  <span>◇</span>
                  <div>
                    <strong>Graph updated</strong>
                    <small>{graphToast}</small>
                  </div>
                  <i>View</i>
                </button>
              )}
            </>
          )}
        </div>
        {run && (
          <ContextPanel
            run={run}
            selectedNode={selectedNode}
            requestedView={contextView}
            onView={setContextView}
            onSelectNode={selectNode}
            onAnswered={() => void refresh()}
            readOnly={Boolean(recording)}
            now={effectiveAnimationClock}
            {...(recording?.frames[replayFrame]?.metrics
              ? { metrics: recording.frames[replayFrame]!.metrics }
              : {})}
            {...(recording?.report ? { replayReport: recording.report } : {})}
          />
        )}
      </section>
      {run && <ActivityConsole run={run} />}
      <WorkspacePickerModal
        open={workspacePickerOpen}
        initialPath={workspacePath}
        onClose={() => setWorkspacePickerOpen(false)}
        onSelect={(path) => {
          setWorkspacePath(path);
          setWorkspaceError(null);
          setWorkspacePickerOpen(false);
        }}
      />
    </main>
  );
}
