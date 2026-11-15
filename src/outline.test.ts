import { describe, expect, it } from "vitest";
import { blockBands, outlinePath, type Rect } from "./outline";
import { buildGrid } from "./table";

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

describe("blockBands", () => {
  /** Give an element a fixed box. */
  function place(el: Element, left: number, right: number, top: number, bottom: number): void {
    const box = { left, right, top, bottom, width: right - left, height: bottom - top, x: left, y: top };
    el.getBoundingClientRect = () => ({ ...box, toJSON: () => box });
  }

  it("spans each row's cells within the block, keeping merged cells at full width", () => {
    document.body.innerHTML = `<table>
      <tr><td colspan="2">wide</td><td>x</td></tr>
      <tr><td>a</td><td>b</td><td>c</td></tr>
      <tr><td>d</td></tr>
    </table>`;
    const t = document.querySelector("table")!;
    const { rows, grid } = buildGrid(t);
    const [wide, x] = Array.from(rows[0].cells);
    const [a, b, c] = Array.from(rows[1].cells);
    place(wide, 0, 200, 0, 20);
    place(x, 200, 300, 0, 20);
    place(a, 0, 100, 20, 40);
    place(b, 100, 200, 20, 40);
    place(c, 200, 300, 20, 40);
    place(rows[0], 0, 300, 0, 20);
    place(rows[1], 0, 300, 20, 40);

    // Columns 1–2: "wide" sticks out to the left; the ragged last row is left out.
    expect(blockBands(rows, grid, { r0: 0, r1: 2, c0: 1, c1: 2 })).toEqual([
      rect(0, 300, 0, 20),
      rect(100, 300, 20, 40),
    ]);
  });
});
