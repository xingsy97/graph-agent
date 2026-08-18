import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeStatus, TaskStage } from "@graph-agent/domain";
import { Compass, Hammer, PackageCheck, PenTool, ShieldCheck, type LucideIcon } from "lucide-react";
import type { LayoutDirection, LayoutHandlePosition } from "../layout-scheduler";

export interface TaskNodeData extends Record<string, unknown> {
  title: string; status: NodeStatus; progress: string; selected: boolean; elapsed: string; stage: TaskStage; isNew: boolean; layoutDirection: LayoutDirection; sourcePosition: LayoutHandlePosition; targetPosition: LayoutHandlePosition; estimatedDurationMinutes?: number; reflowing?: boolean; reflowX?: number; reflowY?: number;
}

const handlePositions: Record<LayoutHandlePosition, Position> = {
  left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom,
};

const symbols: Record<NodeStatus, string> = {
  pending: "○", ready: "◌", running: "↻", waiting_user: "?", expanding: "◇",
  succeeded: "✓", failed: "!", cancelled: "×", replaced: "↗",
};

const stageIcons: Record<TaskStage, LucideIcon> = {
  Discover: Compass, Design: PenTool, Build: Hammer, Verify: ShieldCheck, Deliver: PackageCheck,
};

export function TaskNode({ data }: NodeProps) {
  const value = data as TaskNodeData;
  const targetPosition = handlePositions[value.targetPosition];
  const sourcePosition = handlePositions[value.sourcePosition];
  const StageIcon = stageIcons[value.stage];
  const showProgress = !(value.status === "succeeded" && /^completed[.!]?$/i.test(value.progress.trim()));
  return (
    <div
      className={`task-node state-${value.status} stage-${value.stage.toLowerCase()} ${value.selected ? "is-selected" : ""} ${value.isNew ? "is-new" : ""} ${value.reflowing && !value.isNew ? "is-reflowing" : ""}`}
      style={{ "--reflow-x": `${value.reflowX ?? 0}px`, "--reflow-y": `${value.reflowY ?? 0}px` } as CSSProperties}
      aria-label={`${value.title}, ${value.status.replace("_", " ")}, ${value.progress}`}
    >
      <Handle type="target" position={targetPosition} />
      <div className="node-topline"><span><i className="node-symbol" aria-hidden="true">{symbols[value.status]}</i>{value.status.replace("_", " ")}<em><StageIcon size={11} strokeWidth={2.2} />{value.stage}</em></span><time>{value.elapsed || "Queued"}</time></div>
      <strong>{value.title}</strong>
      {showProgress && <small>{value.progress}</small>}
      {value.estimatedDurationMinutes && <small>{value.estimatedDurationMinutes}m estimate</small>}
      {(value.status === "running" || value.status === "expanding") && <span className="node-progress"><i /></span>}
      <Handle type="source" position={sourcePosition} />
    </div>
  );
}
