"use client";

import { useEffect, useMemo, useState } from "react";
import type { DecisionRequest, TaskNode, TaskRun, WorkspaceReport } from "@graph-agent/domain";
import { DecisionCard } from "./decision-card";

export type ContextView = "overview" | "node" | "decision" | "change" | "result";

function duration(node: TaskNode): string {
  if (!node.startedAt) return "Not started";
  const end = node.completedAt ? new Date(node.completedAt).getTime() : Date.now();
  const seconds = Math.max(1, Math.round((end - new Date(node.startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusCounts(run: TaskRun) {
  const active = run.nodes.filter((node) => node.status !== "replaced");
  return {
    completed: active.filter((node) => node.status === "succeeded").length,
    running: active.filter((node) => node.status === "running").length,
    waiting: active.filter((node) => node.status === "pending" || node.status === "ready").length,
    failed: active.filter((node) => node.status === "failed").length, total: active.length,
  };
}

function downstream(run: TaskRun, nodeId: string): TaskNode[] {
  const seen = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const source = queue.shift();
    if (!source) continue;
    for (const edge of run.edges.filter((candidate) => candidate.source === source)) if (!seen.has(edge.target)) { seen.add(edge.target); queue.push(edge.target); }
  }
  return run.nodes.filter((node) => seen.has(node.id) && node.status !== "replaced");
}

function dependencies(run: TaskRun, nodeId: string): TaskNode[] {
  const ids = new Set(run.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source));
  return run.nodes.filter((node) => ids.has(node.id) && node.status !== "replaced");
}

function directDownstream(run: TaskRun, nodeId: string): TaskNode[] {
  const ids = new Set(run.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target));
  return run.nodes.filter((node) => ids.has(node.id) && node.status !== "replaced");
}

function statusSymbol(status: TaskNode["status"]): string {
  if (status === "succeeded") return "✓";
  if (status === "waiting_user") return "?";
  if (status === "failed") return "!";
  if (status === "cancelled") return "×";
  if (status === "pending" || status === "ready") return "○";
  if (status === "expanding") return "◇";
  return "↻";
}

export function ContextPanel({ run, selectedNode, requestedView, onView, onSelectNode, onAnswered }: {
  run: TaskRun; selectedNode: TaskNode | undefined; requestedView: ContextView; onView(view: ContextView): void; onSelectNode(nodeId: string): void; onAnswered(): void;
}) {
  const counts = statusCounts(run);
  const pending = run.decisions.filter((decision) => decision.status === "pending");
  const activeDecision = pending[0];
  const nodeEvents = selectedNode ? run.events.filter((event) => event.nodeId === selectedNode.id).slice(-12).reverse() : [];
  const graphEvents = run.events.filter((event) => event.type === "graph").slice().reverse();
  const replaced = run.nodes.filter((node) => node.status === "replaced");
  const autoDecisions = run.decisions.filter((decision) => decision.status === "answered" && decision.riskLevel !== "L3").length;
  const userDecisions = run.decisions.filter((decision) => decision.status === "answered" && decision.riskLevel === "L3").length;
  const [report, setReport] = useState<WorkspaceReport | null>(null);
  const summary = useMemo(() => {
    if (run.status === "completed") return "All workstreams are complete. Review the result and decisions below.";
    if (pending.length) return `${pending.length} decision${pending.length > 1 ? "s" : ""} need your judgment while independent work continues.`;
    if (counts.running > 1) return `${counts.running} agents are working in parallel. Dependent tasks will start automatically.`;
    if (counts.running === 1) return "One active workstream is progressing; downstream tasks are waiting on its result.";
    return "The orchestrator is evaluating dependencies and preparing the next workstream.";
  }, [counts.running, pending.length, run.status]);

  useEffect(() => {
    if (requestedView !== "result") return;
    void fetch(`/api/runs/${run.id}/result`).then(async (response) => { if (response.ok) setReport(await response.json() as WorkspaceReport); });
  }, [requestedView, run.id, run.updatedAt]);

  return <aside className="context-panel">
    <div className="context-header">
      <div><span className="context-eyebrow">Context</span><h2>{requestedView === "overview" ? "Run overview" : requestedView === "node" ? "Node detail" : requestedView === "decision" ? "Decision" : requestedView === "change" ? "Graph changes" : "Run result"}</h2></div>
      {requestedView !== "overview" && <button className="icon-button" onClick={() => onView("overview")} aria-label="Back to overview">×</button>}
    </div>

    {requestedView === "overview" && <div className="context-content">
      <section className="overview-hero"><span className={`overview-orb status-${run.status}`}><i /></span><div><strong>{run.status === "running" ? "Work is in progress" : `Run ${run.status}`}</strong><p>{summary}</p></div></section>
      <section><span className="panel-label">Progress</span><div className="metric-grid"><div><b>{counts.completed}</b><span>Completed</span></div><div><b>{counts.running}</b><span>Running</span></div><div><b>{counts.waiting}</b><span>Queued</span></div></div><div className="panel-progress"><i style={{ width: `${counts.total ? counts.completed / counts.total * 100 : 0}%` }} /></div></section>
      <section><span className="panel-label">Workspace</span><div className="workspace-card"><span>⌘</span><div><strong>{run.workspacePath.split(/[\\/]/).at(-1)}</strong><small>{run.workspacePath}</small></div><i>{run.runtime}</i></div></section>
      {pending.length > 0 ? <button className="attention-row" onClick={() => onView("decision")}><span>!</span><div><strong>{pending.length} decision{pending.length > 1 ? "s" : ""} need attention</strong><small>Independent branches are still running</small></div><i>›</i></button> : <div className="quiet-row"><span>✓</span><div><strong>Nothing needs you</strong><small>Reversible choices are handled automatically</small></div></div>}
      {graphEvents.length > 0 && <button className="panel-link-row" onClick={() => onView("change")}><span className="link-icon purple">◇</span><div><strong>Graph evolved to version {run.graphVersion}</strong><small>{graphEvents[0]?.message}</small></div><i>›</i></button>}
      <section><span className="panel-label">Latest activity</span><div className="compact-timeline">{run.events.slice(-4).reverse().map((event) => <div key={event.id}><i className={`type-${event.type}`} /><p><strong>{event.message}</strong><time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></p></div>)}</div></section>
    </div>}

    {requestedView === "node" && selectedNode && <div className="context-content">
      <section className="node-detail-head"><div className={`large-status state-${selectedNode.status}`}>{statusSymbol(selectedNode.status)}</div><div><span>{selectedNode.status.replace("_", " ")}</span><h3>{selectedNode.title}</h3><small>{duration(selectedNode)}{selectedNode.estimatedDurationMinutes ? ` · ${selectedNode.estimatedDurationMinutes}m estimate` : ""}</small></div></section>
      <section><span className="panel-label">Current action</span><p className="current-action">{selectedNode.progress}</p></section>
      <section><span className="panel-label">Task</span><p className="body-copy">{selectedNode.task}</p></section>
      <section><span className="panel-label">Dependencies</span><div className="relationship-list">{dependencies(run, selectedNode.id).length ? dependencies(run, selectedNode.id).map((node) => <button key={node.id} onClick={() => onSelectNode(node.id)}><i className={`state-${node.status}`}>{statusSymbol(node.status)}</i><span><strong>{node.title}</strong><small>{node.status.replace("_", " ")} · {node.progress}</small></span><em>‹</em></button>) : <p className="empty-copy">No prerequisites.</p>}</div></section>
      <section><span className="panel-label">Downstream tasks</span><div className="relationship-list">{directDownstream(run, selectedNode.id).length ? directDownstream(run, selectedNode.id).map((node) => <button key={node.id} onClick={() => onSelectNode(node.id)}><i className={`state-${node.status}`}>{statusSymbol(node.status)}</i><span><strong>{node.title}</strong><small>{node.status.replace("_", " ")} · {node.progress}</small></span><em>›</em></button>) : <p className="empty-copy">No tasks depend on this work.</p>}</div></section>
      <section><span className="panel-label">Run logs</span>{nodeEvents.length ? <div className="node-activity">{nodeEvents.map((event) => <div key={event.id}><i className={`type-${event.type}`} /><div><p>{event.message}</p><time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {event.type}</time></div></div>)}</div> : <p className="empty-copy">No logs recorded for this task.</p>}</section>
      {selectedNode.result && <section><span className="panel-label">Output</span><div className="output-card"><span>✓</span><p>{selectedNode.result}</p></div></section>}
      {selectedNode.error && <section><span className="panel-label">Error</span><div className="error-card">{selectedNode.error}</div></section>}
      <section className="technical-details"><span className="panel-label">Metadata</span><dl><div><dt>Status</dt><dd>{selectedNode.status.replace("_", " ")}</dd></div><div><dt>Stage</dt><dd>{selectedNode.stage ?? "Unassigned"}</dd></div><div><dt>Owner</dt><dd>{selectedNode.owner ?? "Unassigned"}</dd></div><div><dt>Estimate</dt><dd>{selectedNode.estimatedDurationMinutes ? `${selectedNode.estimatedDurationMinutes} minutes` : "Not estimated"}</dd></div><div><dt>Node ID</dt><dd>{selectedNode.id}</dd></div><div><dt>Session</dt><dd>{selectedNode.sessionId ?? "Runtime managed"}</dd></div><div><dt>Depth</dt><dd>{selectedNode.depth}</dd></div><div><dt>Started</dt><dd>{selectedNode.startedAt ? new Date(selectedNode.startedAt).toLocaleString() : "Not started"}</dd></div><div><dt>Completed</dt><dd>{selectedNode.completedAt ? new Date(selectedNode.completedAt).toLocaleString() : "In progress"}</dd></div></dl></section>
    </div>}

    {requestedView === "decision" && <div className="context-content decision-view">
      {activeDecision ? <><DecisionCard decision={activeDecision} node={run.nodes.find((node) => node.id === activeDecision.nodeId)} onAnswered={onAnswered} /><section><span className="panel-label">Affected work</span><div className="affected-list">{downstream(run, activeDecision.nodeId).slice(0, 5).map((node) => <div key={node.id}><i /><span>{node.title}</span></div>)}</div></section></> : <div className="empty-panel-state"><span>✓</span><h3>All decisions resolved</h3><p>The agents can continue without further input.</p><button onClick={() => onView("overview")}>Return to overview</button></div>}
    </div>}

    {requestedView === "change" && <div className="context-content">
      <section className="change-hero"><span>v1</span><i>→</i><span>v{run.graphVersion}</span><p>The graph adapted as agents discovered independent workstreams.</p></section>
      {replaced.map((node) => { const created = run.nodes.filter((candidate) => candidate.depth === node.depth + 1); return <section className="change-card" key={node.id}><span className="panel-label">Replaced</span><h3>{node.title}</h3><p>{node.progress}</p><div className="created-list">{created.slice(0, 12).map((candidate) => <div key={candidate.id}><i>+</i><span>{candidate.title}</span></div>)}</div></section>; })}
      {graphEvents.map((event) => <div className="change-event" key={event.id}><i /><div><strong>{event.message}</strong><time>{new Date(event.createdAt).toLocaleString()}</time></div></div>)}
    </div>}

    {requestedView === "result" && <div className="context-content">
      <section className="result-hero"><span>✓</span><h3>Run completed</h3><p>{run.task}</p></section>
      <section><span className="panel-label">Summary</span><p className="body-copy">Completed {counts.completed} workstreams across {run.graphVersion} graph version{run.graphVersion > 1 ? "s" : ""}. {report?.changes.length ? `${report.changes.length} workspace changes were detected.` : "No workspace file changes were detected."}</p></section>
      <section><span className="panel-label">Workspace changes</span><div className="result-workspace"><div><span>⌘</span><p><strong>{report?.workspacePath ?? run.workspacePath}</strong><small>{report?.gitBranch ? `Branch · ${report.gitBranch}` : "Local workspace"}</small></p></div>{report ? <div className="change-metrics"><span><b>{report.changes.filter((change) => change.kind === "created").length}</b> created</span><span><b>{report.changes.filter((change) => change.kind === "modified").length}</b> modified</span><span><b>{report.changes.filter((change) => change.kind === "deleted").length}</b> deleted</span></div> : <p className="empty-copy">Inspecting workspace…</p>}</div>{report && report.changes.length > 0 && <div className="file-change-list">{report.changes.slice(0, 12).map((change) => <div key={`${change.kind}:${change.path}`}><i className={`kind-${change.kind}`}>{change.kind === "created" ? "+" : change.kind === "deleted" ? "−" : "•"}</i><span>{change.path}</span><small>{change.kind}</small></div>)}</div>}</section>
      {report && report.verifications.length > 0 && <section><span className="panel-label">Verification</span><div className="verification-list">{report.verifications.map((item) => <div key={item.nodeId}><i className={`verify-${item.status}`}>{item.status === "succeeded" ? "✓" : item.status === "failed" ? "!" : "○"}</i><span><strong>{item.title}</strong><small>{item.status}</small></span></div>)}</div></section>}
      <section><span className="panel-label">Key decisions</span><div className="decision-metrics"><div><b>{autoDecisions}</b><span>Made by AI</span></div><div><b>{userDecisions}</b><span>Made by you</span></div></div></section>
      <section><span className="panel-label">Agent outputs</span><div className="deliverable-list">{(report?.completedOutputs ?? run.nodes.filter((node) => node.result).map((node) => ({ nodeId: node.id, title: node.title, result: node.result! }))).slice(-8).map((output) => <button key={output.nodeId} onClick={() => onSelectNode(output.nodeId)}><span>◎</span><div><strong>{output.title}</strong><small>{output.result.slice(0, 72)}</small></div><i>›</i></button>)}</div></section>
    </div>}
  </aside>;
}
