import type { RunTimeSavings, TaskRun } from "./types";

const DEFAULT_NODE_MINUTES = 5;

export function calculateTimeSavings(
  run: TaskRun,
  now = Date.now(),
): RunTimeSavings {
  const nodes = run.nodes.filter((node) => node.status !== "replaced");
  const ids = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of run.edges)
    if (ids.has(edge.source) && ids.has(edge.target))
      incoming.get(edge.target)?.push(edge.source);
  const weight = new Map(
    nodes.map((node) => [
      node.id,
      Math.max(1, node.estimatedDurationMinutes ?? DEFAULT_NODE_MINUTES),
    ]),
  );
  const memo = new Map<string, number>();
  const criticalPath = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const value =
      (weight.get(id) ?? DEFAULT_NODE_MINUTES) +
      Math.max(0, ...(incoming.get(id) ?? []).map(criticalPath));
    memo.set(id, value);
    return value;
  };
  const serialMinutes = [...weight.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  const parallelMinutes = nodes.length
    ? Math.max(...nodes.map((node) => criticalPath(node.id)))
    : 0;
  const savedMinutes = Math.max(0, serialMinutes - parallelMinutes);
  const created = new Date(run.createdAt).getTime();
  const end = ["completed", "failed", "cancelled"].includes(run.status)
    ? new Date(run.updatedAt).getTime()
    : now;
  return {
    serialMinutes,
    parallelMinutes,
    savedMinutes,
    savedPercent: serialMinutes
      ? Math.round((savedMinutes / serialMinutes) * 100)
      : 0,
    actualElapsedMinutes: Math.max(0, Math.round((end - created) / 6000) / 10),
  };
}
