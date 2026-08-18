"use client";

import { useEffect, useMemo, useState } from "react";
import type { TaskRun } from "@graph-agent/domain";

export function ActivityConsole({ run }: { run: TaskRun }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "node" | "graph" | "decision">("all");
  const runningTasks = run.nodes.filter((node) => node.status === "running");
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const latest = run.events.at(-1);
  const events = useMemo(() => run.events.filter((event) => filter === "all" || event.type === filter).slice(-60).reverse(), [filter, run.events]);
  const spotlight = runningTasks[spotlightIndex % Math.max(1, runningTasks.length)];

  useEffect(() => {
    if (runningTasks.length < 2) return;
    const timer = window.setInterval(() => setSpotlightIndex((value) => value + 1), 2400);
    return () => window.clearInterval(timer);
  }, [runningTasks.length]);

  return (
    <section className={`activity-console ${open ? "is-open" : ""}`}>
      <button className="console-summary" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="activity-events">
        <span className="console-chevron">{open ? "⌄" : "⌃"}</span>
        <strong>Activity</strong>
        <span className="console-stat"><i className={runningTasks.length ? "live" : ""} />{runningTasks.length} {runningTasks.length === 1 ? "task" : "tasks"} live · {runningTasks.length} {runningTasks.length === 1 ? "session" : "sessions"}</span>
        <span className="console-latest">{spotlight ? <><b>{spotlight.title}</b><span> · {spotlight.progress}</span></> : latest?.message ?? "Waiting for activity"}</span>
        <span className="console-time">{latest ? new Date(latest.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
      </button>
      {open && <div className="console-body">
        <div className="console-filters">
          {(["all", "node", "graph", "decision"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
        </div>
        <div className="console-events" id="activity-events" aria-live="polite">
          {events.map((event) => {
            const node = run.nodes.find((candidate) => candidate.id === event.nodeId);
            return <div className="console-event" key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><span className={`event-type type-${event.type}`}>{event.type}</span><div><b>{node?.title}</b><p>{event.message}</p></div></div>;
          })}
          {!events.length && <p className="console-empty">No matching activity yet.</p>}
        </div>
      </div>}
    </section>
  );
}
