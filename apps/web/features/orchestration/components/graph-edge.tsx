import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

export function GraphEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, animated, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.32 });
  const animationDelayMs = typeof data?.animationDelayMs === "number" ? data.animationDelayMs : 0;
  return <>
    <BaseEdge id={id} path={path} {...(markerEnd ? { markerEnd } : {})} {...(style ? { style } : {})} />
    {animated && <path className="handoff-edge-flow" d={path} pathLength="100" fill="none" style={{ animationDelay: `${animationDelayMs}ms` } as CSSProperties} />}
  </>;
}
