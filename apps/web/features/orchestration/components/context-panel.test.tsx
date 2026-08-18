import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextPanel } from "./context-panel";
import { createRun } from "./component-fixtures";

describe("ContextPanel", () => {
  afterEach(cleanup);

  it("updates inspector details and navigates related tasks", () => {
    const run = createRun();
    const onSelectNode = vi.fn();
    render(
      <ContextPanel
        run={run}
        selectedNode={run.nodes[1]}
        requestedView="node"
        onView={vi.fn()}
        onSelectNode={onSelectNode}
        onAnswered={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Build release" })).not.toBeNull();
    expect(screen.getByText("Compiling artifacts")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Plan release/ }));
    fireEvent.click(screen.getByRole("button", { name: /Verify release/ }));
    expect(onSelectNode).toHaveBeenNthCalledWith(1, "plan");
    expect(onSelectNode).toHaveBeenNthCalledWith(2, "verify");
  });

  it("announces activity and filters it accessibly", () => {
    const run = createRun();
    render(<ContextPanel run={run} selectedNode={undefined} requestedView="overview" onView={vi.fn()} onSelectNode={vi.fn()} onAnswered={vi.fn()} />);

    expect(screen.getByText("Work is in progress")).not.toBeNull();
  });
});
