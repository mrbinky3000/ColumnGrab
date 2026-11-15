import { describe, expect, it } from "vitest";
import { outlinePath, type Rect } from "./outline";

const rect = (left: number, right: number, top: number, bottom: number): Rect => ({
  left,
  right,
  top,
  bottom,
});

describe("outlinePath", () => {
  it("returns an empty path for no rects", () => {
    expect(outlinePath([])).toBe("");
  });

  it("traces a single rect clockwise from its top-right corner", () => {
    expect(outlinePath([rect(10, 50, 0, 20)])).toBe("M50,0 L50,20 L10,20 L10,0 Z");
  });

  it("steps out around a merged cell and back in for the cells below it", () => {
    // Header "Q1" spans Jan+Feb (0–100); Feb (50–100) sits below it.
    const path = outlinePath([rect(0, 100, 0, 20), rect(50, 100, 20, 40)]);
    expect(path).toBe("M100,0 L100,20 L100,20 L100,40 L50,40 L50,20 L0,20 L0,0 Z");
  });

  it("bridges the gap between cells so the outline stays one shape", () => {
    // border-spacing leaves a 4px gap between rows.
    const path = outlinePath([rect(50, 100, 0, 20), rect(50, 100, 24, 44)]);
    expect(path).toBe("M100,0 L100,20 L100,20 L100,44 L50,44 L50,20 L50,20 L50,0 Z");
  });
});
