# Orchestration Graph Behavior Specification

## Scope and source of truth

`TaskRun` is the complete, serializable state of one orchestration run. The
server-side `RunStore` owns it; clients only render snapshots received from
HTTP or Server-Sent Events (SSE). A run contains its immutable identity and
input (`id`, `task`, `workspacePath`, `runtime`, timestamps), its mutable
lifecycle status, graph version, node and edge collections, decisions, and a
chronological activity log.

The UI must not infer or mutate execution state locally. A mutation made by
the store must append an appropriate `RunEvent`, update `updatedAt`, and emit
a complete snapshot for that run. Event history is capped at 300 events.

## Creating a run

1. The launch view lists suggested workspaces from `GET /api/workspaces` and
   lets the user select one or enter a path. It shows the selected runtime:
   Copilot unless `AGENT_RUNTIME=mock`, otherwise mock.
2. `Run task` is disabled while creation is in progress or no workspace is
   selected. The task must be trimmed and contain 3 through 4,000 characters.
   The workspace path must resolve to an existing directory. Invalid input
   returns HTTP 400 with a user-visible error and creates no run.
3. `POST /api/runs` with `{ task, workspacePath }` validates the request,
   normalizes the workspace path, captures its baseline before work begins,
   creates a `running` run at graph version 1, and returns HTTP 201 with its
   snapshot.
4. Version 1 consists of a `Plan and decompose` Discover node followed by a
   `Review and handoff` Deliver node. The edge from planner to review is the
   only initial edge. Both nodes begin `pending`; the first node is runnable.
   Creation records `Run created and initial graph generated`.
5. After a successful response, the client replaces any prior displayed run,
   clears selected node and focus state, selects the overview, and opens SSE
   for the new run. A failed create leaves the prior client state unchanged.

## Live execution and graph evolution

1. The scheduler considers only `running` runs. A pending or ready node is
   runnable when every incoming dependency is `succeeded` or `replaced`.
   Paused, cancelled, waiting-for-user, expanding, failed, and running nodes
   must never be scheduled.
2. A run executes up to its selected parallel limit: 10, 20, or 100.
   Independent runnable nodes may start together; blocked descendants wait
   without consuming a concurrency slot.
3. Starting a node changes it to `running`, records `startedAt`, sets
   `Starting agent`, and logs `Node started`. Runtime progress messages update
   the node progress and emit a node event.
4. A completed runtime outcome changes the node to `succeeded`, records
   `completedAt` and the result, sets `Completed`, and logs `Node completed`.
   A thrown runtime error instead changes it to `failed`, captures the error
   text and completion time, sets `Failed`, and logs the failure.
5. A runtime may replace only its own running/expanding node, and its patch
   must name the current graph version. The replacement must contain 1-50
   unique nodes, an existing entry node, only valid non-self edges, no cycle,
   and reach every replacement node from its entry. Invalid or stale patches
   fail the originating node rather than partially changing the graph.
6. A valid replacement marks the original node `replaced`, preserves its
   historical position, creates all replacement nodes at one deeper depth in
   `pending`, and increments `graphVersion` once. Incoming edges reconnect to
   the replacement entry; each replacement exit reconnects to every original
   successor. The store emits one graph event describing the expansion.
7. The mock planner must demonstrate an initial multi-stage DAG with
   independent branches and convergence nodes. The mock core-system node may
   demonstrate a second replacement. The production planner must request a
   meaningful, validated 12-24 node DAG with at least four parallel branches
   and three convergence points.
8. A run becomes `completed` only when every non-replaced node is succeeded
   or cancelled. It becomes `failed` when at least one live node failed and
   no live node remains pending, ready, running, waiting for user, or
   expanding. The resulting status change emits a run event.

## Decisions, controls, and recovery

1. A runtime question is classified before it is shown. A non-L3 question
   with a recommendation or choice is automatically answered, recorded as an
   answered decision, and returns its node to `ready`. A question with no
   safe default becomes L3 and requires the user.
2. An L3 decision changes only its originating node to `waiting_user`; it
   does not pause the run or unrelated runnable branches. The run snapshot
   contains a pending decision with node ID, context, choices, recommendation
   when supplied, reason, risk level, and freeform policy.
3. The UI automatically opens `DecisionCard` for a newly pending decision.
   The card identifies the blocking node, renders choices and the optional
   freeform answer, presents the recommendation and reason, and lists
   downstream work affected by that node.
4. `POST /api/decisions/:decisionId` requires a nonblank `runId` and answer.
   On success it marks the decision answered with `answeredAt`, moves only
   the associated node to `ready`, logs the answer, wakes the scheduler, and
   returns the decision. Missing input is HTTP 400; an unknown, stale, or
   already answered decision is HTTP 409.
5. `PATCH /api/runs/:runId` accepts `pause`, `resume`, `cancel`, `reset`, and
   runtime configuration changes.
   Pause prevents new scheduling but does not discard state; resume changes
   the run to `running` and wakes the scheduler; cancel changes its status to
   `cancelled` and prevents future scheduling. Unknown IDs return 404 and
   unknown actions return 400.

## Inspection and live transport

1. `GET /api/runs` returns cloned snapshots for all runs. `GET
   /api/runs/:runId` returns a cloned snapshot or HTTP 404. A read or SSE
   connection starts the orchestrator when needed.
2. `GET /api/runs/:runId/events` returns HTTP 404 for an unknown run.
   Otherwise it sends an initial `data: <TaskRun JSON>` SSE message,
   thereafter sends a complete snapshot after each store mutation, and sends
   a heartbeat comment at least every 15 seconds. It unsubscribes and clears
   the heartbeat when aborted or cancelled.
3. The workspace has one `EventSource` per displayed run. Every message
   replaces the rendered snapshot. Closing or changing the run closes the
   old source.
4. The graph excludes replaced nodes from the working layout but retains
   them for history. Full graph groups nodes by stage; focus mode shows the
   selected active node and its immediate active neighbors. Selecting a node
   opens its status, task, current action, node-scoped events, output/error,
   session, depth, and timestamps.
5. Graph replacement displays a short-lived version toast and graph history
   lists each replaced node, its generated depth-level nodes, and graph
   events. The activity console always renders the latest event and recent
   chronological activity from the snapshot.
6. On completion, the context panel switches to the result view and fetches
   `GET /api/runs/:runId/result`. The report compares the captured baseline
   with the current workspace, excluding generated and dependency
   directories, and returns up to 250 created, modified, or deleted paths,
   optional Git branch, completed outputs, and verification-node outcomes.

## Resetting the graph view

`New run` is a client-view reset, not a destructive server reset. It clears
the displayed `TaskRun`, node selection, focus mode, contextual view state,
graph-version tracking, and overflow menu state, then returns to the launch
composer. It does not cancel, alter, or delete the prior run, its decisions,
its events, or its baseline; any still-running prior run continues on the
server. Submitting the composer subsequently creates a distinct run with a
new ID and fresh graph version 1.

## Persistent recording and Replay

1. Every emitted `TaskRun` snapshot is appended to a per-run recording with
   its original time offset and calculated parallel-time metrics. Recordings
   are persisted outside the project workspace and survive server restarts.
2. A terminal recording also freezes its workspace report, including file
   changes, verification outcomes, agent outputs, and Git branch. Replay does
   not depend on the workspace remaining unchanged or even continuing to
   exist.
3. `GET /api/replays` lists recordings without their frame payloads. `GET
   /api/replays/:runId` returns the complete ordered timeline or HTTP 404.
4. Opening Replay starts at offset zero and plays automatically. Its virtual
   clock uses original timing at 1× and supports pause, restart, scrubbing,
   and 0.5×, 1×, 2×, or 4× speed. Scrubbing backward restores the exact older
   graph, node states, event history, decisions, metrics, and outputs.
5. Replay drives the same graph layout, graph-rewrite transitions, camera
   follow, running-node animation, and dependency-transfer animation as a live
   run. Pausing freezes time-dependent animation.
6. Replay is strictly read-only: it opens no SSE connection, invokes no
   Copilot session, submits no decision, mutates no run, and performs no live
   workspace-result request. An unfinished recording truthfully ends in its
   last recorded nonterminal state rather than fabricating completion.

## Required automated coverage

Add Vitest coverage for these behaviors; use a deterministic fake runtime and
fake timers rather than real Copilot sessions or random delays.

| Area | Required cases |
| --- | --- |
| Run API and baseline | Valid creation returns 201 initial snapshot and captures baseline before wake; invalid task/path returns 400 without creating a run; reads and unknown IDs return the documented statuses. |
| Store and SSE | Each mutation emits a complete cloned snapshot; initial SSE snapshot precedes later updates; heartbeat and abort clean up subscriptions; event log retains only 300 newest events. |
| Scheduling | Dependency gating, four-node cap, no duplicate execution, pause/resume/cancel behavior, successful completion, terminal failure, and independent work during a user wait. |
| Runtime outcomes | Progress, completion, error, valid replacement/reconnection/version event, and stale or invalid replacement failing only its source node. |
| Decisions | Automatic low-risk resolution, L3 node-only pause, answer validation/statuses, answer resumption with prior answer, and no duplicate answer. |
| UI | Launch validation/error, SSE snapshot rendering, graph expansion toast/history, full versus focus graph, node detail, decision auto-open and submit, result report rendering, and non-destructive `New run` reset. |
