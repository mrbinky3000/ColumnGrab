// Table geometry: map a <table> to a logical grid that accounts for rowspan/colspan,
// so "column 3" means the visual column 3, not the 3rd <td> in the row.

export type Cell = HTMLTableCellElement;

/** grid[row][col] → the cell covering that slot (undefined for ragged rows). */
export type Grid = (Cell | undefined)[][];

export interface TableGrid {
  rows: HTMLTableRowElement[];
  grid: Grid;
}

export interface GridPos {
  r: number;
  c: number;
}

const MAX_COLSPAN = 1000; // same clamp browsers apply

export function buildGrid(table: HTMLTableElement): TableGrid {
  const rows = Array.from(table.rows);
  const grid: Grid = rows.map(() => []);
  rows.forEach((row, r) => {
    let c = 0;

    for (const cell of Array.from(row.cells)) {
      while (grid[r][c]) c++;
      // rowSpan === 0 means "span to the end of the table section".
      const rs = cell.rowSpan === 0 ? rows.length - r : Math.max(1, cell.rowSpan || 1);
      const cs = Math.max(1, Math.min(cell.colSpan || 1, MAX_COLSPAN));

      for (let i = 0; i < rs && r + i < rows.length; i++) {
        for (let j = 0; j < cs; j++) grid[r + i][c + j] = cell;
      }

      c += cs;
    }
  });

  return { rows, grid };
}

/** Top-left grid position of a cell. */
export function locate(grid: Grid, cell: Cell): GridPos | null {
  for (let r = 0; r < grid.length; r++) {
    const c = grid[r].indexOf(cell);

    if (c !== -1) return { r, c };
  }

  return null;
}

/** Header rows: everything in <thead>; otherwise leading rows made entirely of <th>. */
export function headerRowCount(table: HTMLTableElement, rows: HTMLTableRowElement[]): number {
  if (table.tHead && table.tHead.rows.length) return table.tHead.rows.length;
  let n = 0;

  for (const row of rows) {
    const cells = Array.from(row.cells);

    if (cells.length && cells.every((c) => c.tagName === "TH")) n++;
    else break;
  }

  return n;
}

/** Unique cells in column `col` between rows r0..r1 inclusive (rowspans counted once). */
export function columnCells(grid: Grid, col: number, r0: number, r1: number): Cell[] {
  const out: Cell[] = [];
  let prev: Cell | undefined;

  for (let r = r0; r <= r1; r++) {
    const cell = grid[r]?.[col];

    if (cell && cell !== prev) out.push(cell);

    if (cell) prev = cell;
  }

  return out;
}

/** The first cell in column `col` that spans only that column (no colspan into neighbours). */
export function singleColumnCell(grid: Grid, col: number): Cell | null {
  for (const row of grid) {
    const cell = row[col];

    if (cell && row[col - 1] !== cell && row[col + 1] !== cell) return cell;
  }

  return null;
}

export interface XRange {
  left: number;
  right: number;
}

/**
 * Horizontal extent of column `col` on screen, taken from a cell that spans only that
 * column. Null when every cell in the column is merged with a neighbour.
 */
export function columnXRange(grid: Grid, col: number): XRange | null {
  const cell = singleColumnCell(grid, col);

  if (!cell) return null;
  const { left, right } = cell.getBoundingClientRect();

  return { left, right };
}

/** How many columns a cell covers beyond its first one (0 for a single-column cell). */
export function extraColumns(grid: Grid, pos: GridPos, cell: Cell): number {
  let span = 0;

  while (grid[pos.r][pos.c + span + 1] === cell) span++;

  return span;
}

/**
 * For a colspan cell, pick which spanned column the pointer is over by hit-testing
 * each spanned column's x range. A pointer past the right edge picks the last column.
 */
export function colOffsetWithin(cell: Cell, grid: Grid, pos: GridPos, x: number): number {
  const span = extraColumns(grid, pos, cell);

  if (!span) return 0;

  for (let k = 0; k <= span; k++) {
    const range = columnXRange(grid, pos.c + k);

    if (range && x >= range.left && x < range.right) return k;
  }

  const last = columnXRange(grid, pos.c + span);

  return last && x >= last.right ? span : 0;
}

/** A rectangle of grid slots: rows r0..r1 and columns c0..c1, inclusive. */
export interface BlockRange {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

/**
 * The cells of a rectangular block, one entry per row and column. A merged cell appears
 * once, in its first slot within the block; its other slots, and missing slots in ragged
 * rows, are null.
 */
export function cellBlock(grid: Grid, { r0, r1, c0, c1 }: BlockRange): (Cell | null)[][] {
  const out: (Cell | null)[][] = [];

  for (let r = r0; r <= r1; r++) {
    const row: (Cell | null)[] = [];

    for (let c = c0; c <= c1; c++) {
      const cell = grid[r]?.[c];
      const seenAbove = r > r0 && grid[r - 1]?.[c] === cell;
      const seenLeft = c > c0 && grid[r]?.[c - 1] === cell;
      row.push(cell && !seenAbove && !seenLeft ? cell : null);
    }

    out.push(row);
  }

  return out;
}

/**
 * Tab-separated text for a block: one line per row. With `trimEmpty`, rows whose cells are
 * all empty are dropped; single empty cells stay so the columns keep lining up.
 */
export function blockToText(block: (Cell | null)[][], trimEmpty: boolean): string {
  let rows = block.map((row) => row.map((cell) => (cell ? cellText(cell) : "")));

  if (trimEmpty) rows = rows.filter((row) => row.some((v) => v !== ""));

  return rows.map((row) => row.join("\t")).join("\n");
}

/** Number of columns in the grid (its widest row). */
export function columnCount(grid: Grid): number {
  return Math.max(0, ...grid.map((row) => row.length));
}

/** Horizontal centre of each column on screen; null where columnXRange has none. */
export function columnCenters(grid: Grid): (number | null)[] {
  return Array.from({ length: columnCount(grid) }, (_, c) => {
    const range = columnXRange(grid, c);

    return range ? (range.left + range.right) / 2 : null;
  });
}

/**
 * The far column of a drag that started in column `anchor`, for a pointer at `x`. A
 * neighbouring column is included only once the pointer passes its centre, so a little
 * sideways drift stays on the anchor column. Columns without a known centre are included
 * along with the next column past them.
 */
export function endColumnAt(centers: (number | null)[], anchor: number, x: number): number {
  let end = anchor;

  for (let c = anchor + 1; c < centers.length; c++) {
    const center = centers[c];

    if (center === null) continue;

    if (x < center) break;
    end = c;
  }

  if (end !== anchor) return end;

  for (let c = anchor - 1; c >= 0; c--) {
    const center = centers[c];

    if (center === null) continue;

    if (x > center) break;
    end = c;
  }

  return end;
}

export function cellText(cell: Cell): string {
  return (cell.innerText ?? cell.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The table cell containing `target`, if it lives inside a <table>. */
export function findCell(target: EventTarget | null): Cell | null {
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const cell = el?.closest<Cell>("td, th") ?? null;

  return cell?.closest("table") ? cell : null;
}
