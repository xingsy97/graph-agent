import type {
  ReplaceNodePatch,
  TaskNode,
  TaskRun,
  UserQuestion,
} from "@graph-agent/domain";

export type AgentOutcome =
  | { type: "completed"; result: string }
  | { type: "question"; question: UserQuestion }
  | { type: "replace"; patch: ReplaceNodePatch };

export interface RuntimeContext {
  run: TaskRun;
  node: TaskNode;
  previousAnswer?: string;
  progress(message: string): void;
}

export interface AgentRuntime {
  execute(context: RuntimeContext): Promise<AgentOutcome>;
}

const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const MOCK_PLAN_DELAY_MS = 220;
const MOCK_STEP_DELAY_MS = 420;

export const COPILOT_PLANNER_SYSTEM_PROMPT = `You are the planning agent for a visual, dynamically executed DAG.

Your only planning action is to inspect the selected workspace, then call replace_self_with_graph exactly once with a concrete execution graph.

Graph quality requirements:
- Create 12-24 useful nodes and normally 20-40 edges. Every node must produce a concrete artifact, decision, implementation, or verification result; never add filler.
- Optimize the graph's useful parallel width, not its node count. After one very small framing/contract entry, expose 5-8 runnable nodes as early as their actual inputs permit. Aim for 6-10 independently executable nodes across the broad middle of a sufficiently large task, while keeping the critical path near 4-6 layers.
- Plan in two passes: first identify independently owned deliverables and shared interfaces; then derive the minimal partial order required to produce them. Never begin by arranging work into sequential lifecycle phases.
- Add an edge only when the target cannot start without a concrete artifact produced by the source. For every candidate edge, ask: "What exact output is unavailable?" If there is no specific answer, omit the edge. Do not serialize work because it belongs to a later stage, sounds conceptually related, or would normally follow it in a project plan. Omit redundant transitive edges.
- Split work by non-overlapping file ownership or explicit interface boundaries wherever possible so concurrent agents do not edit the same files. Prefer a small shared-contract node followed immediately by independent server, persistence, client, design-system, test-fixture, tooling, and documentation branches when the objective supports them.
- Requirements discovery, architecture notes, UX exploration, and repository research must not become a single global gate. Keep them independent, make each unblock only its true consumers, and let implementation branches start directly from the entry whenever the objective already provides enough constraints.
- Use small convergence nodes to integrate related outputs, with at least three meaningful convergence points. Verification should run beside implementation whenever its inputs allow it, followed by one final integration gate.
- Include principle-level human decisions only when the objective actually requires product scope, secrets, destructive action, material cost, external publication/deployment, compliance, or an irreducible owner choice. Keep independent branches runnable while such a decision waits.
- Ground tasks in the repository and top-level objective. Each task must state its output and enough acceptance detail for a separate agent session to execute it.
- Give every node a realistic estimatedDurationMinutes value from 1 to 240. Estimate serial agent effort for that node alone; these estimates power the user-visible time-saved metric.
- Every node has exactly one stage: Discover, Design, Build, Verify, or Deliver. Stage labels describe the work; they do not create dependencies.
- The graph must be acyclic, all nodes must be reachable from one entry, IDs must be short and unique, and the entry must fan out quickly. Avoid high-indegree bottlenecks before the final third of the graph.

Before submitting, mentally simulate the scheduler layer by layer. Check reachability, acyclicity, edit conflicts, bottlenecks, and unnecessary serialization. If fewer than five nodes become runnable soon after the entry for a task with several independent deliverables, remove artificial edges or split ownership more cleanly before calling the tool.`;

const PACKAGE_REGISTRY = "https://packagefeedproxy.microsoft.io/npm/";
export const COPILOT_WORKER_SYSTEM_PROMPT = `You execute exactly one DAG node in the selected workspace. Inspect and modify real files when the task requires it. Report concise progress. Use replace_self_with_graph when the node contains 3 or more meaningful parallel/dependent workstreams; apply the same rule that edges represent real output dependencies, not stage ordering, and split concurrent work along non-overlapping ownership boundaries. Use request_principle_decision only for scope, secrets, destructive actions, material cost, external publication/deployment, compliance, or irreducible product choices. Resolve reversible implementation choices yourself.

Package installation policy: every npm, pnpm, yarn, npx, or package-manager operation must use ${PACKAGE_REGISTRY}. The runtime already exports NPM_CONFIG_REGISTRY and npm_config_registry. Never replace, delete, bypass, or override this registry, never use registry.npmjs.org, and do not diagnose ordinary proxy latency by switching registries. If a workspace .npmrc is needed, preserve the configured Microsoft proxy. Prefer the existing lockfile and installed dependencies before installing anything.

Finish with a concise result including changed files and verification performed.`;

export class MockAgentRuntime implements AgentRuntime {
  async execute(context: RuntimeContext): Promise<AgentOutcome> {
    context.progress("Agent session started");
    await delay(MOCK_PLAN_DELAY_MS);
    if (context.node.title === "Plan and decompose") {
      context.progress("Building a dependency-aware execution plan");
      await delay(MOCK_PLAN_DELAY_MS);
      const scope = crypto.randomUUID();
      const requirements = crypto.randomUUID();
      const architecture = crypto.randomUUID();
      const experience = crypto.randomUUID();
      const backend = crypto.randomUUID();
      const frontend = crypto.randomUUID();
      const tests = crypto.randomUUID();
      const integration = crypto.randomUUID();
      const handoff = crypto.randomUUID();
      const research = crypto.randomUUID();
      const data = crypto.randomUUID();
      const contracts = crypto.randomUUID();
      const accessibility = crypto.randomUUID();
      const observability = crypto.randomUUID();
      const documentation = crypto.randomUUID();
      const boundary = crypto.randomUUID();
      const task = context.run.task;
      return {
        type: "replace",
        patch: {
          expectedGraphVersion: context.run.graphVersion,
          replacedNodeId: context.node.id,
          entryNodeId: scope,
          newGraph: {
            nodes: [
              {
                id: scope,
                title: "Frame the objective",
                stage: "Discover",
                task: `Clarify scope, constraints, assumptions, and measurable success criteria for: ${task}`,
              },
              {
                id: requirements,
                title: "Analyze requirements",
                stage: "Discover",
                task: `Turn the objective into functional requirements, edge cases, and acceptance criteria for: ${task}`,
              },
              {
                id: research,
                title: "Research constraints",
                stage: "Discover",
                task: `Inspect the workspace and research technical constraints, existing patterns, and reusable components for: ${task}`,
              },
              {
                id: boundary,
                title: "Confirm delivery boundary",
                stage: "Discover",
                task: `Ask the owner to choose the external delivery boundary for: ${task}`,
              },
              {
                id: architecture,
                title: "Design architecture",
                stage: "Design",
                task: `Design the technical architecture, interfaces, data flow, risks, and implementation plan for: ${task}`,
              },
              {
                id: experience,
                title: "Design experience",
                stage: "Design",
                task: `Design the user journey, interaction states, failure states, and information hierarchy for: ${task}`,
              },
              {
                id: data,
                title: "Model data flows",
                stage: "Design",
                task: `Design data structures, persistence, state transitions, and lifecycle rules for: ${task}`,
              },
              {
                id: contracts,
                title: "Define contracts",
                stage: "Design",
                task: `Define API, event, and component contracts that allow workstreams to execute independently for: ${task}`,
              },
              {
                id: backend,
                title: "Build core system",
                stage: "Build",
                task: `Implement the domain model, orchestration logic, persistence boundaries, and APIs required for: ${task}`,
              },
              {
                id: frontend,
                title: "Build user interface",
                stage: "Build",
                task: `Implement the user-facing workflow and visual states required for: ${task}`,
              },
              {
                id: accessibility,
                title: "Validate experience",
                stage: "Verify",
                task: `Review accessibility, responsive behavior, empty states, and error recovery for: ${task}`,
              },
              {
                id: observability,
                title: "Add diagnostics",
                stage: "Build",
                task: `Add useful diagnostics, progress reporting, and failure visibility for: ${task}`,
              },
              {
                id: tests,
                title: "Verify workstreams",
                stage: "Verify",
                task: `Test the core system and interface against the acceptance criteria for: ${task}`,
              },
              {
                id: integration,
                title: "Integrate and harden",
                stage: "Verify",
                task: `Integrate all workstreams, resolve incompatibilities, and validate the complete result for: ${task}`,
              },
              {
                id: documentation,
                title: "Document the result",
                stage: "Deliver",
                task: `Document architecture, usage, important decisions, and known limitations for: ${task}`,
              },
              {
                id: handoff,
                title: "Prepare deliverables",
                stage: "Deliver",
                task: `Summarize the implementation, decisions, limitations, and operating instructions for: ${task}`,
              },
            ],
            edges: [
              { source: scope, target: requirements },
              { source: scope, target: architecture },
              { source: scope, target: experience },
              { source: scope, target: research },
              { source: scope, target: boundary },
              { source: research, target: architecture },
              { source: requirements, target: data },
              { source: architecture, target: data },
              { source: architecture, target: contracts },
              { source: data, target: contracts },
              { source: requirements, target: backend },
              { source: architecture, target: backend },
              { source: data, target: backend },
              { source: contracts, target: backend },
              { source: requirements, target: frontend },
              { source: experience, target: frontend },
              { source: contracts, target: frontend },
              { source: experience, target: accessibility },
              { source: frontend, target: accessibility },
              { source: architecture, target: observability },
              { source: backend, target: observability },
              { source: backend, target: tests },
              { source: frontend, target: tests },
              { source: accessibility, target: tests },
              { source: backend, target: integration },
              { source: frontend, target: integration },
              { source: tests, target: integration },
              { source: observability, target: integration },
              { source: integration, target: documentation },
              { source: integration, target: handoff },
              { source: documentation, target: handoff },
              { source: boundary, target: handoff },
            ],
          },
        },
      };
    }
    if (context.node.title === "Build core system" && context.node.depth < 2) {
      context.progress("Discovering independent implementation workstreams");
      const entry = crypto.randomUUID();
      const implementationA = crypto.randomUUID();
      const implementationB = crypto.randomUUID();
      const validation = crypto.randomUUID();
      const label =
        context.node.title === "Build core system" ? "core" : "interface";
      return {
        type: "replace",
        patch: {
          expectedGraphVersion: context.run.graphVersion,
          replacedNodeId: context.node.id,
          entryNodeId: entry,
          newGraph: {
            nodes: [
              {
                id: entry,
                title: `Prepare ${label} implementation`,
                stage: "Build",
                task: `Inspect dependencies and prepare an implementation plan for: ${context.node.task}`,
              },
              {
                id: implementationA,
                title: `Implement ${label} foundation`,
                stage: "Build",
                task: `Implement the foundational half of: ${context.node.task}`,
              },
              {
                id: implementationB,
                title: `Implement ${label} behavior`,
                stage: "Build",
                task: `Implement the behavior and edge cases for: ${context.node.task}`,
              },
              {
                id: validation,
                title: `Validate ${label} implementation`,
                stage: "Verify",
                task: `Integrate and validate all work produced for: ${context.node.task}`,
              },
            ],
            edges: [
              { source: entry, target: implementationA },
              { source: entry, target: implementationB },
              { source: implementationA, target: validation },
              { source: implementationB, target: validation },
            ],
          },
        },
      };
    }
    if (
      context.node.title === "Confirm delivery boundary" &&
      !context.previousAnswer
    ) {
      context.progress(
        "The external delivery boundary needs an owner decision",
      );
      return {
        type: "question",
        question: {
          question: "What delivery boundary should this run use?",
          context:
            "This choice determines whether the result remains local or prepares actions that affect external systems. Independent implementation branches can continue while you decide.",
          choices: [
            "Keep changes local",
            "Prepare a release plan",
            "Prepare a production deployment",
          ],
          recommendation: "Keep changes local",
          reason:
            "This preserves a complete demo without authorizing an external or irreversible action.",
          riskLevel: "L3",
          allowFreeform: true,
        },
      };
    }
    context.progress(
      context.previousAnswer
        ? "Applying the user's decision"
        : "Inspecting inputs and dependencies",
    );
    await delay(MOCK_STEP_DELAY_MS);
    context.progress("Producing and checking the task output");
    await delay(MOCK_STEP_DELAY_MS);
    return {
      type: "completed",
      result: context.previousAnswer
        ? `Completed with decision: ${context.previousAnswer}`
        : `Completed: ${context.node.task}`,
    };
  }
}

export class CopilotAgentRuntime implements AgentRuntime {
  async execute(context: RuntimeContext): Promise<AgentOutcome> {
    const { CopilotClient, defineTool, approveAll } = await import(
      "@github/copilot-sdk"
    );
    const { z } = await import("zod");
    const client = new CopilotClient({
      ...(process.env.GITHUB_TOKEN
        ? { gitHubToken: process.env.GITHUB_TOKEN }
        : {}),
      useLoggedInUser: !process.env.GITHUB_TOKEN,
      logLevel: "error",
      workingDirectory: context.run.workspacePath,
      env: {
        ...process.env,
        NPM_CONFIG_REGISTRY: PACKAGE_REGISTRY,
        npm_config_registry: PACKAGE_REGISTRY,
        PNPM_CONFIG_REGISTRY: PACKAGE_REGISTRY,
      },
    });
    await client.start();
    let requested: AgentOutcome | undefined;
    try {
      const resumableSessionId =
        context.node.sessionId ??
        (context.previousAnswer ? context.node.id : undefined);
      const availableModels = await client.listModels();
      const configuredModel = process.env.COPILOT_MODEL?.trim();
      const modelIds = new Set(availableModels.map((model) => model.id));
      const preferredModels = [
        "gpt-5.6-terra",
        "gpt-5.6-sol",
        "gpt-5.4-mini",
        "gpt-5-mini",
        "auto",
      ];
      const selectedModel =
        configuredModel && modelIds.has(configuredModel)
          ? configuredModel
          : (preferredModels.find((model) => modelIds.has(model)) ??
            availableModels[0]?.id);
      if (!selectedModel)
        throw new Error(
          "GitHub Copilot did not report any available models for this account",
        );
      if (configuredModel && configuredModel !== selectedModel)
        context.progress(
          `Configured model ${configuredModel} is unavailable; using ${selectedModel}`,
        );
      const session = resumableSessionId
        ? await client.resumeSession(resumableSessionId, {
            onPermissionRequest: approveAll,
          })
        : await client.createSession({
            sessionId: context.node.id,
            model: selectedModel,
            onPermissionRequest: approveAll,
            workingDirectory: context.run.workspacePath,
            systemMessage: {
              mode: "append",
              content:
                context.node.title === "Plan and decompose"
                  ? COPILOT_PLANNER_SYSTEM_PROMPT
                  : COPILOT_WORKER_SYSTEM_PROMPT,
            },
            tools: [
              defineTool("report_progress", {
                description: "Report concise progress to the graph UI",
                parameters: z.object({ message: z.string() }),
                skipPermission: true,
                handler: ({ message }) => {
                  context.progress(message);
                  return "Progress recorded";
                },
              }),
              defineTool("request_principle_decision", {
                description:
                  "Escalate a principle-level decision that must be made by the user",
                parameters: z.object({
                  question: z.string(),
                  context: z.string(),
                  choices: z.array(z.string()).default([]),
                  recommendation: z.string().optional(),
                  reason: z.string(),
                  allowFreeform: z.boolean().default(true),
                }),
                skipPermission: true,
                handler: (question) => {
                  requested = {
                    type: "question",
                    question: {
                      question: question.question,
                      context: question.context,
                      choices: question.choices,
                      reason: question.reason,
                      allowFreeform: question.allowFreeform,
                      riskLevel: "L3",
                      ...(question.recommendation
                        ? { recommendation: question.recommendation }
                        : {}),
                    },
                  };
                  return "The orchestrator will pause this node for the user. Stop work now.";
                },
              }),
              defineTool("replace_self_with_graph", {
                description:
                  "Replace this node with a new DAG. Every node must be reachable from entryNodeId.",
                parameters: z.object({
                  entryNodeId: z.string(),
                  nodes: z
                    .array(
                      z.object({
                        id: z.string(),
                        title: z.string(),
                        task: z.string(),
                        stage: z
                          .enum([
                            "Discover",
                            "Design",
                            "Build",
                            "Verify",
                            "Deliver",
                          ])
                          .optional(),
                        estimatedDurationMinutes: z
                          .number()
                          .int()
                          .min(1)
                          .max(240)
                          .optional(),
                      }),
                    )
                    .max(50),
                  edges: z.array(
                    z.object({ source: z.string(), target: z.string() }),
                  ),
                }),
                skipPermission: true,
                handler: ({ entryNodeId, nodes, edges }) => {
                  const normalizedNodes = nodes.map((node) => ({
                    id: node.id,
                    title: node.title,
                    task: node.task,
                    ...(node.stage ? { stage: node.stage } : {}),
                    ...(node.estimatedDurationMinutes
                      ? {
                          estimatedDurationMinutes:
                            node.estimatedDurationMinutes,
                        }
                      : {}),
                  }));
                  requested = {
                    type: "replace",
                    patch: {
                      expectedGraphVersion: context.run.graphVersion,
                      replacedNodeId: context.node.id,
                      entryNodeId,
                      newGraph: { nodes: normalizedNodes, edges },
                    },
                  };
                  return "Graph replacement recorded. Stop work now.";
                },
              }),
            ],
          });
      context.progress(`Copilot session running with ${selectedModel}`);
      const answerContext = context.previousAnswer
        ? `\nThe user answered the pending decision: ${context.previousAnswer}`
        : "";
      const dependencyContext = context.run.edges
        .filter((edge) => edge.target === context.node.id)
        .map((edge) =>
          context.run.nodes.find((node) => node.id === edge.source),
        )
        .filter((node): node is TaskNode => Boolean(node))
        .map((node) => `- ${node.title}: ${node.result ?? node.progress}`)
        .join("\n");
      const response = await session.sendAndWait(
        {
          prompt: `Top-level objective: ${context.run.task}\nWorkspace: ${context.run.workspacePath}\nNode task: ${context.node.task}${dependencyContext ? `\nInputs from completed dependencies:\n${dependencyContext}` : ""}${answerContext}`,
        },
        10 * 60_000,
      );
      await session.disconnect();
      if (requested) return requested;
      return {
        type: "completed",
        result: response?.data.content ?? "Copilot completed the task",
      };
    } finally {
      await client.stop();
    }
  }
}

export function createRuntime(): AgentRuntime {
  return process.env.AGENT_RUNTIME === "mock"
    ? new MockAgentRuntime()
    : new CopilotAgentRuntime();
}
