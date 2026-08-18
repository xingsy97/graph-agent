import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityConsole } from "./activity-console";
import { createRun } from "./component-fixtures";

describe("ActivityConsole", () => {
  afterEach(cleanup);

  it("filters event activity and provides an accessible empty status", () => {
    const run = createRun();
    render(<ActivityConsole run={run} />);

    fireEvent.click(screen.getByRole("button", { name: /Activity/ }));
    fireEvent.click(screen.getByRole("button", { name: "decision" }));

    expect(screen.getByText("No matching activity yet.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "decision" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "graph" }));
    expect(screen.getAllByText("Added verification work")).toHaveLength(1);
  });
});
