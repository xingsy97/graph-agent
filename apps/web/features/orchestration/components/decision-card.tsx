"use client";

import { useState } from "react";
import type { DecisionRequest, TaskNode } from "@graph-agent/domain";

export function DecisionCard({ decision, node, onAnswered }: { decision: DecisionRequest; node: TaskNode | undefined; onAnswered(): void }) {
  const [answer, setAnswer] = useState(decision.recommendation ?? decision.choices[0] ?? "");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/decisions/${decision.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId: decision.runId, answer }),
    });
    setBusy(false);
    if (response.ok) onAnswered();
  };
  return (
    <article className="decision-card">
      <div className="decision-kicker"><span>Decision required</span><b>Human judgment</b></div>
      <h3>{decision.question}</h3>
      <p className="node-reference">Blocking · {node?.title ?? "Task node"}</p>
      <p>{decision.context}</p>
      {decision.recommendation && <div className="recommendation"><span>AI recommendation</span><strong>{decision.recommendation}</strong><small>{decision.reason}</small></div>}
      <div className="choice-list">
        {decision.choices.map((choice) => <label key={choice}><input type="radio" name={decision.id} checked={answer === choice} onChange={() => setAnswer(choice)} /> <span>{choice}</span></label>)}
      </div>
      {decision.allowFreeform && <textarea aria-label="Custom answer" placeholder="Or provide specific instructions…" value={decision.choices.includes(answer) ? "" : answer} onChange={(event) => setAnswer(event.target.value)} />}
      <button className="primary-button full" disabled={busy || !answer.trim()} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit decision"}</button>
    </article>
  );
}
