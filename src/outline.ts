// Outline for a column selection. Each selected cell keeps its own width, so a merged
// cell (colspan) is shown in full while the rest of the shape stays on the column.
import type { BlockRange, Grid } from "./table";

export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * SVG path data tracing the outside of `rects`, which are stacked top to bottom (one per
 * selected cell). Each rect starts where the one above ends, so gaps between cells
 * (border-spacing) are filled and the outline is a single shape. Empty string for none.
 */
export function outlinePath(rects: Rect[]): string {
  if (!rects.length) return "";
  const tops = rects.map((r, i) => (i === 0 ? r.top : rects[i - 1].bottom));
  const right = rects.flatMap((r, i) => [`${r.right},${tops[i]}`, `${r.right},${r.bottom}`]);

  const left = rects
    .map((r, i) => [`${r.left},${r.bottom}`, `${r.left},${tops[i]}`])
    .reverse()
    .flat();

  return `M${[...right, ...left].join(" L")} Z`;
}

/**
 * One rect per row of a multi-column block, for outlinePath: top and bottom from the
 * <tr>, left and right spanning that row's cells within the block. Merged cells keep their
 * full width. Rows with no cells in the block (ragged rows) are left out.
 */
export function blockBands(rows: HTMLTableRowElement[], grid: Grid, range: BlockRange): Rect[] {
  const out: Rect[] = [];

  for (let r = range.r0; r <= range.r1; r++) {
    let left = Infinity;
    let right = -Infinity;

    for (let c = range.c0; c <= range.c1; c++) {
      const cell = grid[r]?.[c];

      if (!cell) continue;
      const box = cell.getBoundingClientRect();
      left = Math.min(left, box.left);
      right = Math.max(right, box.right);
    }

    if (left === Infinity) continue;
    const { top, bottom } = rows[r].getBoundingClientRect();
    out.push({ top, right, bottom, left });
  }

  return out;
}
