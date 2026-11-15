// Outline for a column selection. Each selected cell keeps its own width, so a merged
// cell (colspan) is shown in full while the rest of the shape stays on the column.

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
