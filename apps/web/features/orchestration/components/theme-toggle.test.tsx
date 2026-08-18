import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
  });

  it("defaults to light and persists dark mode", () => {
    render(<ThemeToggle />);
    const toggle = screen.getByRole("switch", { name: "Switch to dark mode" });
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("graph-agent-theme")).toBe("dark");
    expect(screen.getByRole("switch", { name: "Switch to light mode" }).getAttribute("aria-checked")).toBe("true");
  });
});
