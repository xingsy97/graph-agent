import { describe, expect, it } from "vitest";
import type { TaskEdge, TaskNode } from "@graph-agent/domain";
import { LayoutScheduler } from "./layout-scheduler";

const nodes: TaskNode[] = [
  { id: "root", title: "Discover", task: "Research", status: "succeeded", progress: "Done", depth: 0, stage: "Discover" },
  { id: "design", title: "Design", task: "Design", status: "running", progress: "Working", depth: 1, stage: "Design" },
  { id: "build-a", title: "Build A", task: "Build", status: "pending", progress: "Waiting", depth: 2, stage: "Build" },
  { id: "build-b", title: "Build B", task: "Build", status: "pending", progress: "Waiting", depth: 2, stage: "Build" },
  { id: "verify", title: "Verify", task: "Test", status: "pending", progress: "Waiting", depth: 3, stage: "Verify" },
];
const edges: TaskEdge[] = [
  { id: "root-design", source: "root", target: "design" },
  { id: "design-a", source: "design", target: "build-a" },
  { id: "design-b", source: "design", target: "build-b" },
  { id: "a-verify", source: "build-a", target: "verify" },
  { id: "b-verify", source: "build-b", target: "verify" },
];

describe("LayoutScheduler", () => {
  it("defaults to strict topological depth", () => {
    const result = new LayoutScheduler().schedule(nodes, edges);
    const positions = new Map(result.nodes.map((node) => [node.id, node.position]));
    for (const edge of edges) expect(positions.get(edge.source)!.x).toBeLessThan(positions.get(edge.target)!.x);
    expect(positions.get("build-a")!.x).toBe(positions.get("build-b")!.x);
    expect(result.topologyDepth).toBe(3);
  });

  it("can observe the same graph by business stage", () => {
    const result = new LayoutScheduler().schedule(nodes, edges, "stage");
    const scheduled = new Map(result.nodes.map((node) => [node.id, node]));
    expect(scheduled.get("root")!.position.x).toBeLessThan(scheduled.get("design")!.position.x);
    expect(scheduled.get("build-a")!.position.x).toBe(scheduled.get("build-b")!.position.x);
    expect(scheduled.get("verify")!.stage).toBe("Verify");
  });

  it("wraps deep topologies into a screen-shaped rectangle", () => {
    const deepNodes: TaskNode[] = Array.from({ length: 9 }, (_, index) => ({
      id: `node-${index}`, title: `Node ${index}`, task: `Step ${index}`, status: "pending", progress: "Waiting", depth: index,
    }));
    const deepEdges: TaskEdge[] = deepNodes.slice(1).map((node, index) => ({ id: `edge-${index}`, source: deepNodes[index]!.id, target: node.id }));
    const result = new LayoutScheduler().schedule(deepNodes, deepEdges, "topology", { width: 1100, height: 720 });

    expect(result.direction).toBe("wrapped");
    expect(result.bounds.width / result.bounds.height).toBeGreaterThan(.65);
    expect(result.bounds.width / result.bounds.height).toBeLessThan(1.8);
    const scheduled = new Map(result.nodes.map((node) => [node.id, node.position]));
    for (const edge of deepEdges) expect(scheduled.get(edge.source)).not.toEqual(scheduled.get(edge.target));
  });

  it("keeps every node rectangle separated in a dense expanded graph", () => {
    const denseNodes: TaskNode[] = Array.from({ length: 20 }, (_, index) => ({
      id: `dense-${index}`, title: `Dense ${index}`, task: `Task ${index}`, status: "pending", progress: "Waiting", depth: Math.floor(index / 4),
    }));
    const denseEdges: TaskEdge[] = [];
    for (let index = 4; index < denseNodes.length; index += 1) {
      denseEdges.push({ id: `dense-edge-${index}`, source: denseNodes[index - 4]!.id, target: denseNodes[index]!.id });
    }
    const result = new LayoutScheduler().schedule(denseNodes, denseEdges, "topology", { width: 1000, height: 700 });
    const minimumHorizontalSeparation = 252 + 40;
    const minimumVerticalSeparation = 164 + 40;

    for (let left = 0; left < result.nodes.length; left += 1) {
      for (let right = left + 1; right < result.nodes.length; right += 1) {
        const a = result.nodes[left]!.position;
        const b = result.nodes[right]!.position;
        expect(Math.abs(a.x - b.x) >= minimumHorizontalSeparation || Math.abs(a.y - b.y) >= minimumVerticalSeparation).toBe(true);
      }
    }
  });
});
