# Orchestration Test Plan

## Test harness

Install and configure Vitest with `jsdom`, React Testing Library, and
`@testing-library/user-event`. Keep server tests in the Node environment and
UI tests in jsdom. Use a deterministic fake runtime, fake timers, fixed UUIDs,
and a temporary workspace directory; do not invoke Copilot or depend on real
timer delays.

Provide fixtures for:

- a two-node initial run;
- a four-branch DAG with a convergence node;
- a pending L3 decision on one branch;
- a completed run with workspace report data; and
- a graph-replacement patch with known entry and exit nodes.

Reset the singleton store and orchestrator state between server tests. Mock
`EventSource`, `fetch`, clipboard, and React Flow in UI tests.

## Unit and route cases

| ID | Surface | Setup and action | Assertions |
| --- | --- | --- | --- |
| API-01 | `POST /api/runs` | Submit a trimmed valid task and an existing workspace. | Returns 201; task is trimmed; snapshot is `running`, graph version 1, and has only planner-to-review edge; baseline capture occurs before the scheduler wake. |
| API-02 | `POST /api/runs` | Submit a 0-2-character task, an over-4,000-character task, missing path, and nonexistent path. | Each returns 400 and neither creates a run nor captures a baseline. |
| API-03 | Run reads | Read the run list, a known run, and an unknown run. | List and known snapshot are cloned; unknown ID returns 404. |
| API-04 | `PATCH /api/runs/:id` | Pause, resume, cancel, and submit an unknown action; repeat against an unknown run. | Pause prevents scheduling; resume wakes it; cancel prevents future scheduling; invalid action is 400; unknown ID is 404. |
| API-05 | `POST /api/decisions/:id` | Submit blank run ID, blank answer, unknown decision, stale decision, then a valid answer. | Invalid input is 400; unknown/stale is 409; valid answer sets `answeredAt`, changes only its node to `ready`, logs one decision event, and wakes scheduling. |
| STORE-01 | Snapshot isolation | Create a run, mutate a returned snapshot, then read again. | Store state is unchanged; list and snapshot callers cannot mutate internal state. |
| STORE-02 | Mutation events | Update a node, add and answer a decision, set run status, and replace a graph while subscribed. | Each mutation updates `updatedAt`, emits a complete cloned snapshot, and appends the expected event type/message. |
| STORE-03 | Event retention | Append 301+ events. | Exactly the 300 newest events remain, in chronological order. |
| SSE-01 | Events route | Open an events stream for a known run, trigger a store mutation, advance fake time, then abort. | First frame is a complete snapshot; mutation sends the new complete snapshot; heartbeat is sent within 15 seconds; abort removes the subscription and heartbeat. |
| SSE-02 | Events route | Request a stream for an unknown run. | Returns 404 without subscribing. |
| SCH-01 | Dependency ordering | Use a chain and a parallel DAG; drive fake runtime completions. | A node starts only after every predecessor succeeded or was replaced; independent roots start together; blocked descendants never consume slots. |
| SCH-02 | Concurrency and duplication | Make five independent nodes runnable, call wake/tick repeatedly before completion. | At most four execute for the run; each node executes once. |
| SCH-03 | Status transitions | Resolve runtime outcomes for progress, success, failure, low-risk question, and L3 question. | Transitions and timestamps match the behavior spec; progress is emitted; error text is retained; low-risk returns the node to `ready`; L3 changes only its source to `waiting_user`. |
| SCH-04 | Wait isolation and resume | Hold one branch at an L3 decision while another branch remains runnable; answer the decision. | Independent work continues; the answered node receives its previous answer on its next runtime invocation; a second answer cannot re-run it. |
| SCH-05 | Terminal runs | Finish all live nodes, then separately fail the final live work. | A run completes only when every live node succeeded/cancelled; it fails only when a live failure exists and no live work remains. |
| DAG-01 | Valid replacement | Replace a running node with a valid branching patch. | Source becomes `replaced`; replacements are one depth deeper and pending; version increments once; incoming edges target entry; every patch exit reconnects to original successors; one graph event is emitted. |
| DAG-02 | Invalid replacement | Submit stale version, duplicate IDs, missing entry, self/invalid edge, cycle, unreachable node, and over-50-node patches. | No partial graph change occurs; only the source node becomes `failed` with the validation error. |

## Component and UI cases

| ID | Surface | Setup and interaction | Assertions |
| --- | --- | --- | --- |
| UI-01 | Launch composer | Render with workspace suggestions; clear the path, use a short task, submit a server error, then a valid response. | Run control is disabled without a workspace or while creating; invalid submission does not post; server error is visible; success clears selection/focus and opens the new run overview. |
| UI-02 | Live snapshots | Mock EventSource, emit initial and replacement snapshots, then unmount or replace the run. | UI renders the latest snapshot rather than locally derived state; old EventSource closes on run change and unmount. |
| UI-03 | Graph ordering and focus | Render a run with a replaced node, select an active node, then enter/leave focus. | Full graph excludes replaced nodes; focus includes selected active node plus immediate active neighbors; clicking the pane restores overview and full graph. |
| UI-04 | Task node | Render pending, running, expanding, succeeded, and selected node data. | Status, title, progress, stage, selection styling, and elapsed text render; progress indicator appears only for running/expanding nodes. |
| UI-05 | Decision card | Render recommendation/choices/freeform; select a choice, type a custom answer, submit, and hold the request pending. | Default answer follows recommendation then first choice; request body includes run ID and answer; callback fires only on success; blank or busy submission is disabled; freeform follows policy. |
| UI-06 | Decision navigation | Emit a new pending L3 decision, use the overview attention row, and submit it. | Newly pending decision auto-opens; card names its blocking node and lists active downstream work; resolved state returns to the empty decision view or overview. |
| UI-07 | Context panel | Render overview, node detail, graph history, then completed result with mocked report fetch. | Counts ignore replaced nodes; node events/output/error/details are scoped correctly; history groups depth+1 children under replaced nodes; result renders workspace changes, verification outcomes, decisions, and output navigation. |
| UI-08 | Activity console | Toggle console and select each event-type filter. | Running-agent count is correct; newest event is shown in the summary; only the selected event type appears in reverse chronological order. |
| UI-09 | Critical controls | Pause, resume, cancel, copy ID, invoke history, then click `New run`. | Each action posts the correct endpoint/payload; copy closes the menu; New run clears displayed run, selection, focus, view, version tracking, and menu without sending cancellation/deletion for the prior run. |
| UI-10 | Expansion feedback | Deliver a snapshot with a larger graph version and advance fake timers. | Toast uses latest graph event, opens history when clicked, and disappears after five seconds. |

## Execution order

1. Add server/store/scheduler coverage first; it protects dependency ordering,
   lifecycle transitions, and graph mutation independently of rendering.
2. Add route and SSE tests with the fake runtime and temporary workspace.
3. Add component tests with mocked browser APIs, prioritizing launch,
   decisions, critical controls, and reset semantics.
