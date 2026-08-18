import { EventEmitter } from "node:events";
import {
  assertNodeTransition,
  assertRunTransition,
  cancelBlockedNodes,
  createDemoRun,
  resetRun,
  scheduleReadyNodes,
  type DecisionRequest,
  type NodeStatus,
  type RunEvent,
  type RunSpeed,
  type TaskRun,
  type WorkflowMode,
} from "@graph-agent/domain";
import { recordingService } from "./recording";

export class RunStore {
  private readonly runs = new Map<string, TaskRun>();
  private readonly emitter = new EventEmitter();
  private eventId = 0;

  create(
    task: string,
    workspacePath: string,
    options: Pick<TaskRun, "speed" | "workflow">,
  ): TaskRun {
    const run = createDemoRun(
      crypto.randomUUID(),
      task,
      workspacePath,
      process.env.AGENT_RUNTIME === "mock" ? "mock" : "copilot",
      Date.now(),
      options,
    );
    this.runs.set(run.id, run);
    recordingService.record(run);
    return this.snapshot(run.id);
  }

  list(): TaskRun[] {
    return [...this.runs.values()].map((run) => structuredClone(run));
  }

  get(runId: string): TaskRun | undefined {
    return this.runs.get(runId);
  }

  snapshot(runId: string): TaskRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    return structuredClone(run);
  }

  replace(run: TaskRun, message: string): void {
    this.runs.set(run.id, run);
    this.log(run.id, "graph", message);
  }

  updateNode(
    runId: string,
    nodeId: string,
    update: Partial<{
      status: NodeStatus;
      progress: string;
      sessionId: string;
      result: string;
      error: string;
      startedAt: string;
      completedAt: string;
    }>,
    message?: string,
  ): void {
    const run = this.required(runId);
    const node = run.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) throw new Error("Node not found");
    if (update.status && update.status !== node.status)
      assertNodeTransition(node.status, update.status);
    Object.assign(node, update);
    run.updatedAt = new Date().toISOString();
    if (message) this.log(runId, "node", message, nodeId);
    else this.emit(runId);
  }

  startNode(runId: string, nodeId: string): void {
    const transferredAt = new Date().toISOString();
    const run = this.required(runId);
    for (const edge of run.edges) {
      if (edge.target === nodeId) edge.transferStartedAt = transferredAt;
    }
    this.updateNode(
      runId,
      nodeId,
      {
        status: "running",
        progress: "Starting agent",
        startedAt: transferredAt,
      },
      "Dependencies transferred; node started",
    );
  }

  addDecision(runId: string, decision: DecisionRequest): void {
    const run = this.required(runId);
    run.decisions.push(decision);
    this.log(
      runId,
      "decision",
      decision.status === "pending"
        ? "User decision required"
        : `AI decision recorded: ${decision.answer ?? "resolved"}`,
      decision.nodeId,
    );
  }

  answerDecision(
    runId: string,
    decisionId: string,
    answer: string,
  ): DecisionRequest {
    const run = this.required(runId);
    const decision = run.decisions.find(
      (candidate) => candidate.id === decisionId,
    );
    if (!decision || decision.status !== "pending")
      throw new Error("Decision is no longer pending");
    decision.status = "answered";
    decision.answer = answer;
    decision.answeredAt = new Date().toISOString();
    this.updateNode(runId, decision.nodeId, {
      status: "ready",
      progress: `Decision received: ${answer}`,
    });
    this.log(
      runId,
      "decision",
      `Decision answered: ${answer}`,
      decision.nodeId,
    );
    return structuredClone(decision);
  }

  setRunStatus(runId: string, status: TaskRun["status"]): void {
    const run = this.required(runId);
    if (run.status !== status) assertRunTransition(run.status, status);
    run.status = status;
    run.updatedAt = new Date().toISOString();
    this.log(runId, "run", `Run ${status}`);
  }

  pause(runId: string): string[] {
    const run = this.required(runId);
    if (run.status !== "running")
      throw new Error("Only a running run can be paused");
    const pausedNodeIds = run.nodes
      .filter((node) => node.status === "running")
      .map((node) => node.id);
    for (const nodeId of pausedNodeIds) {
      this.updateNode(
        runId,
        nodeId,
        { status: "ready", progress: "Paused; ready to resume" },
        "Node paused",
      );
    }
    this.setRunStatus(runId, "paused");
    return pausedNodeIds;
  }

  configure(
    runId: string,
    update: Partial<Pick<TaskRun, "speed" | "workflow">>,
  ): void {
    const run = this.required(runId);
    Object.assign(run, update);
    run.updatedAt = new Date().toISOString();
    const changes = [
      update.speed ? `speed set to ${update.speed}` : null,
      update.workflow ? `workflow set to ${update.workflow}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    this.log(runId, "run", `Run ${changes}`);
  }

  schedule(runId: string): string[] {
    const run = this.required(runId);
    const scheduled = scheduleReadyNodes(run, new Date().toISOString());
    const nodeIds = scheduled.nodes
      .filter(
        (node, index) =>
          node.status === "ready" && run.nodes[index]?.status === "pending",
      )
      .map((node) => node.id);
    if (nodeIds.length === 0) return [];
    this.runs.set(runId, scheduled);
    for (const nodeId of nodeIds)
      this.log(runId, "node", "Node is ready to run", nodeId);
    return nodeIds;
  }

  cancelBlocked(runId: string): string[] {
    const run = this.required(runId);
    const blocked = cancelBlockedNodes(run, new Date().toISOString());
    const nodeIds = blocked.nodes
      .filter(
        (node, index) =>
          node.status === "cancelled" &&
          (run.nodes[index]?.status === "pending" ||
            run.nodes[index]?.status === "ready"),
      )
      .map((node) => node.id);
    if (nodeIds.length === 0) return [];
    this.runs.set(runId, blocked);
    for (const nodeId of nodeIds)
      this.log(
        runId,
        "node",
        "Node cancelled because a dependency failed",
        nodeId,
      );
    return nodeIds;
  }

  reset(runId: string): void {
    const current = this.required(runId);
    if (!["completed", "failed", "cancelled"].includes(current.status)) {
      throw new Error("Only a finished run can be reset");
    }
    const run = resetRun(current, new Date().toISOString());
    this.runs.set(runId, run);
    this.log(runId, "run", "Run reset");
  }

  log(
    runId: string,
    type: RunEvent["type"],
    message: string,
    nodeId?: string,
  ): void {
    const run = this.required(runId);
    const event: RunEvent = {
      id: ++this.eventId,
      type,
      message,
      createdAt: new Date().toISOString(),
      ...(nodeId ? { nodeId } : {}),
    };
    run.events.push(event);
    if (run.events.length > 300) run.events.splice(0, run.events.length - 300);
    run.updatedAt = event.createdAt;
    this.emit(runId);
  }

  subscribe(runId: string, listener: () => void): () => void {
    const event = `run:${runId}`;
    this.emitter.on(event, listener);
    return () => this.emitter.off(event, listener);
  }

  private required(runId: string): TaskRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error("Run not found");
    return run;
  }

  private emit(runId: string): void {
    recordingService.record(this.required(runId));
    this.emitter.emit(`run:${runId}`);
  }
}

declare global {
  var graphAgentStore: RunStore | undefined;
}

export const store = (globalThis.graphAgentStore ??= new RunStore());
