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

/**
 * For a colspan cell, pick which spanned column the pointer is over by finding a
 * single-column cell in each candidate column (in another row) and hit-testing its x range.
 */
export function colOffsetWithin(cell: Cell, grid: Grid, pos: GridPos, x: number): number {
  let span = 0;

  while (grid[pos.r][pos.c + span + 1] === cell) span++;

  if (!span) return 0;

  for (let k = 0; k <= span; k++) {
    const c = pos.c + k;

    for (const row of grid) {
      const other = row[c];

      if (other && other !== cell && row[c - 1] !== other && row[c + 1] !== other) {
        const rect = other.getBoundingClientRect();

        if (x >= rect.left && x < rect.right) return k;
        break;
      }
    }
  }

  return 0;
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
