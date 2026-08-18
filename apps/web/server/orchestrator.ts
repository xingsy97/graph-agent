import {
  classifyDecision,
  replaceNode,
  runnableNodeIds,
  type DecisionRequest,
} from "@graph-agent/domain";
import { createRuntime } from "./runtime";
import { store } from "./store";

class Orchestrator {
  private timer?: NodeJS.Timeout;
  private readonly active = new Map<string, number>();
  private executionId = 0;
  private readonly runtime = createRuntime();

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(
      () => void this.tick(),
      process.env.AGENT_RUNTIME === "mock" ? 250 : 1_000,
    );
    this.timer.unref();
    void this.tick();
  }

  wake(): void {
    this.start();
    void this.tick();
  }

  pause(runId: string): void {
    store.pause(runId);
    for (const key of this.active.keys()) {
      if (key.startsWith(`${runId}:`)) this.active.delete(key);
    }
  }

  private async tick(): Promise<void> {
    for (const run of store
      .list()
      .filter((candidate) => candidate.status === "running")) {
      store.cancelBlocked(run.id);
      store.schedule(run.id);
      const scheduledRun = store.snapshot(run.id);
      const activeForRun = [...this.active.keys()].filter((key) =>
        key.startsWith(`${run.id}:`),
      ).length;
      const available = Math.max(0, this.concurrencyFor(run) - activeForRun);
      for (const nodeId of runnableNodeIds(scheduledRun).slice(0, available)) {
        const key = `${run.id}:${nodeId}`;
        if (this.active.has(key)) continue;
        const executionId = ++this.executionId;
        this.active.set(key, executionId);
        void this.execute(run.id, nodeId, executionId).finally(() => {
          if (this.active.get(key) === executionId) this.active.delete(key);
        });
      }

      this.finishIfComplete(run.id);
    }
  }

  private concurrencyFor(run: {
    speed: "deliberate" | "balanced" | "fast";
  }): number {
    return { deliberate: 10, balanced: 20, fast: 100 }[run.speed];
  }

  private async execute(
    runId: string,
    nodeId: string,
    executionId: number,
  ): Promise<void> {
    const snapshot = store.snapshot(runId);
    const node = snapshot.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || (node.status !== "pending" && node.status !== "ready")) return;
    const previousAnswer = [...snapshot.decisions]
      .reverse()
      .find(
        (decision) =>
          decision.nodeId === nodeId && decision.status === "answered",
      )?.answer;
    store.startNode(runId, nodeId);
    try {
      const canUpdate = () => {
        const current = store.snapshot(runId);
        return (
          this.active.get(`${runId}:${nodeId}`) === executionId &&
          current.status === "running" &&
          current.nodes.find((candidate) => candidate.id === nodeId)?.status ===
            "running"
        );
      };
      const current = store.snapshot(runId);
      const runningNode = current.nodes.find(
        (candidate) => candidate.id === nodeId,
      );
      if (!runningNode) return;
      const outcome = await this.runtime.execute({
        run: current,
        node: runningNode,
        ...(previousAnswer ? { previousAnswer } : {}),
        progress: (message) => {
          if (canUpdate())
            store.updateNode(runId, nodeId, { progress: message }, message);
        },
      });
      if (!canUpdate()) return;
      if (outcome.type === "completed") {
        store.updateNode(
          runId,
          nodeId,
          {
            status: "succeeded",
            progress: "Completed",
            result: outcome.result,
            completedAt: new Date().toISOString(),
          },
          "Node completed",
        );
      } else if (outcome.type === "replace") {
        store.updateNode(runId, nodeId, {
          status: "expanding",
          progress: "Validating replacement graph",
        });
        const replaced = replaceNode(store.snapshot(runId), outcome.patch);
        store.replace(
          replaced,
          `Node expanded into ${outcome.patch.newGraph.nodes.length} tasks`,
        );
      } else {
        const classification = classifyDecision(outcome.question);
        if (!classification.requiresUser && classification.answer) {
          store.addDecision(runId, {
            id: crypto.randomUUID(),
            runId,
            nodeId,
            question: outcome.question.question,
            context: outcome.question.context ?? "",
            choices: outcome.question.choices ?? [],
            allowFreeform: outcome.question.allowFreeform ?? true,
            ...(outcome.question.recommendation
              ? { recommendation: outcome.question.recommendation }
              : {}),
            reason: classification.reason,
            riskLevel: classification.riskLevel,
            status: "answered",
            answer: classification.answer,
            createdAt: new Date().toISOString(),
            answeredAt: new Date().toISOString(),
          });
          store.updateNode(
            runId,
            nodeId,
            {
              status: "ready",
              progress: `AI selected: ${classification.answer}`,
            },
            "AI resolved a low-risk decision",
          );
        } else {
          const decision: DecisionRequest = {
            id: crypto.randomUUID(),
            runId,
            nodeId,
            question: outcome.question.question,
            context: outcome.question.context ?? "",
            choices: outcome.question.choices ?? [],
            allowFreeform: outcome.question.allowFreeform ?? true,
            ...(outcome.question.recommendation
              ? { recommendation: outcome.question.recommendation }
              : {}),
            reason: classification.reason,
            riskLevel: classification.riskLevel,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          store.updateNode(runId, nodeId, {
            status: "waiting_user",
            progress: "Waiting for a principle-level decision",
          });
          store.addDecision(runId, decision);
        }
      }
    } catch (error) {
      if (!this.isCurrentExecution(runId, nodeId, executionId)) return;
      const message =
        error instanceof Error ? error.message : "Unknown agent error";
      store.updateNode(
        runId,
        nodeId,
        {
          status: "failed",
          progress: "Failed",
          error: message,
          completedAt: new Date().toISOString(),
        },
        `Node failed: ${message}`,
      );
    } finally {
      this.wake();
    }
  }

  private isCurrentExecution(
    runId: string,
    nodeId: string,
    executionId: number,
  ): boolean {
    const run = store.snapshot(runId);
    return (
      this.active.get(`${runId}:${nodeId}`) === executionId &&
      run.status === "running" &&
      run.nodes.find((candidate) => candidate.id === nodeId)?.status ===
        "running"
    );
  }

  private finishIfComplete(runId: string): void {
    const run = store.snapshot(runId);
    const live = run.nodes.filter((node) => node.status !== "replaced");
    if (
      live.length > 0 &&
      live.every(
        (node) => node.status === "succeeded" || node.status === "cancelled",
      )
    )
      store.setRunStatus(runId, "completed");
    else if (
      live.some((node) => node.status === "failed") &&
      !live.some((node) =>
        ["pending", "ready", "running", "waiting_user", "expanding"].includes(
          node.status,
        ),
      )
    )
      store.setRunStatus(runId, "failed");
  }
}

declare global {
  var graphAgentOrchestrator: Orchestrator | undefined;
}

export const orchestrator = (globalThis.graphAgentOrchestrator ??=
  new Orchestrator());
