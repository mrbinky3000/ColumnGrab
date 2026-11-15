import { beforeEach, describe, expect, it } from "vitest";
import {
  blockToText,
  buildGrid,
  cellBlock,
  cellText,
  colOffsetWithin,
  columnCells,
  columnCount,
  columnXRange,
  endColumnAt,
  extraColumns,
  findCell,
  headerRowCount,
  locate,
  singleColumnCell,
  type Cell,
} from "./table";

/** Render markup into the document and return the first <table>. */
function table(html: string): HTMLTableElement {
  document.body.innerHTML = html;
  const t = document.querySelector("table");

  if (!t) throw new Error("no <table> in fixture");

  return t;
}

/** Text of each cell, for readable assertions. */
const texts = (cells: Cell[]): string[] => cells.map(cellText);

/** Give an element a fixed horizontal extent for hit-testing. */
function setRect(el: Element, left: number, right: number): void {
  el.getBoundingClientRect = () => ({ left, right, top: 0, bottom: 10, width: right - left, height: 10, x: left, y: 0, toJSON: () => ({}) });
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("buildGrid", () => {
  it("maps a plain table one cell per slot", () => {
    const { rows, grid } = buildGrid(
      table(`<table>
        <tr><td>a</td><td>b</td></tr>
        <tr><td>c</td><td>d</td></tr>
      </table>`),
    );

    expect(rows).toHaveLength(2);
    expect(grid.map((row) => row.map((cell) => (cell ? cellText(cell) : "")))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("puts thead rows first and tfoot rows last, regardless of source order", () => {
    const { grid } = buildGrid(
      table(`<table>
        <tfoot><tr><td>foot</td></tr></tfoot>
        <tbody><tr><td>body</td></tr></tbody>
        <thead><tr><th>head</th></tr></thead>
      </table>`),
    );

    expect(grid.map((row) => cellText(row[0]!))).toEqual(["head", "body", "foot"]);
  });

  it("repeats a rowspan cell in every row it covers and shifts later cells right", () => {
    const { grid } = buildGrid(
      table(`<table>
        <tr><td rowspan="2">r</td><td>a</td></tr>
        <tr><td>b</td></tr>
      </table>`),
    );

    expect(grid[0][0]).toBe(grid[1][0]);
    expect(cellText(grid[1][1]!)).toBe("b");
  });

  it("repeats a colspan cell in every column it covers", () => {
    const { grid } = buildGrid(
      table(`<table>
        <tr><td colspan="2">wide</td><td>x</td></tr>
        <tr><td>a</td><td>b</td><td>c</td></tr>
      </table>`),
    );

    expect(grid[0][0]).toBe(grid[0][1]);
    expect(cellText(grid[0][2]!)).toBe("x");
    expect(grid[0]).toHaveLength(3);
  });

  it("treats rowspan=0 as spanning to the last row", () => {
    const { grid } = buildGrid(
      table(`<table>
        <tr><td rowspan="0">all</td><td>1</td></tr>
        <tr><td>2</td></tr>
        <tr><td>3</td></tr>
      </table>`),
    );

    expect(texts(grid.map((row) => row[0]!))).toEqual(["all", "all", "all"]);
    expect(texts(grid.map((row) => row[1]!))).toEqual(["1", "2", "3"]);
  });

  it("leaves holes in ragged rows", () => {
    const { grid } = buildGrid(
      table(`<table>
        <tr><td>a</td><td>b</td></tr>
        <tr><td>c</td></tr>
      </table>`),
    );

    expect(grid[1][1]).toBeUndefined();
  });

  it("ignores rows of nested tables", () => {
    const outer = table(`<table id="outer">
      <tr><td>a<table><tr><td>inner</td></tr></table></td></tr>
      <tr><td>b</td></tr>
    </table>`);

    expect(buildGrid(outer).rows).toHaveLength(2);
  });
});

describe("locate", () => {
  it("returns the top-left slot of a spanning cell", () => {
    const t = table(`<table>
      <tr><td>a</td><td rowspan="2" colspan="2">big</td></tr>
      <tr><td>b</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    const big = t.querySelector<Cell>('[rowspan="2"]')!;
    expect(locate(grid, big)).toEqual({ r: 0, c: 1 });
  });

  it("returns null for a cell that is not in the grid", () => {
    const { grid } = buildGrid(table(`<table><tr><td>a</td></tr></table>`));
    expect(locate(grid, document.createElement("td"))).toBeNull();
  });
});

describe("headerRowCount", () => {
  it("counts every <thead> row", () => {
    const t = table(`<table>
      <thead><tr><th>A</th></tr><tr><th>B</th></tr></thead>
      <tbody><tr><td>1</td></tr></tbody>
    </table>`);

    expect(headerRowCount(t, buildGrid(t).rows)).toBe(2);
  });

  it("without <thead>, counts leading rows made only of <th>", () => {
    const t = table(`<table>
      <tr><th>A</th><th>B</th></tr>
      <tr><th></th><th>sub</th></tr>
      <tr><td>1</td><td>2</td></tr>
      <tr><th>late</th><th>header</th></tr>
    </table>`);

    expect(headerRowCount(t, buildGrid(t).rows)).toBe(2);
  });

  it("does not treat a row with a row-header <th> plus <td>s as a header row", () => {
    const t = table(`<table>
      <tr><th>Row 1</th><td>1</td></tr>
      <tr><th>Row 2</th><td>2</td></tr>
    </table>`);

    expect(headerRowCount(t, buildGrid(t).rows)).toBe(0);
  });
});

describe("columnCells", () => {
  const t = () =>
    table(`<table>
      <tr><th>Region</th><th>Q1</th></tr>
      <tr><td rowspan="2">North</td><td>10</td></tr>
      <tr><td>20</td></tr>
      <tr><td>South</td><td>30</td></tr>
    </table>`);

  it("returns the column top to bottom", () => {
    const { grid } = buildGrid(t());
    expect(texts(columnCells(grid, 1, 0, 3))).toEqual(["Q1", "10", "20", "30"]);
  });

  it("includes a rowspan cell once", () => {
    const { grid } = buildGrid(t());
    expect(texts(columnCells(grid, 0, 0, 3))).toEqual(["Region", "North", "South"]);
  });

  it("respects the row range", () => {
    const { grid } = buildGrid(t());
    expect(texts(columnCells(grid, 1, 1, 2))).toEqual(["10", "20"]);
  });

  it("skips holes in ragged rows", () => {
    const { grid } = buildGrid(
      table(`<table>
        <tr><td>a</td><td>b</td></tr>
        <tr><td>c</td></tr>
        <tr><td>d</td><td>e</td></tr>
      </table>`),
    );

    expect(texts(columnCells(grid, 1, 0, 2))).toEqual(["b", "e"]);
  });

  it("returns nothing for a column past the end", () => {
    const { grid } = buildGrid(t());
    expect(columnCells(grid, 9, 0, 3)).toEqual([]);
  });
});

describe("colOffsetWithin", () => {
  it("is 0 for a cell that spans a single column", () => {
    const t = table(`<table><tr><td>a</td><td>b</td></tr></table>`);
    const { grid } = buildGrid(t);
    const b = grid[0][1]!;
    expect(colOffsetWithin(b, grid, { r: 0, c: 1 }, 999)).toBe(0);
  });

  it("picks the spanned column under the pointer, using single-column cells below for x ranges", () => {
    const t = table(`<table>
      <tr><td colspan="3">wide</td></tr>
      <tr><td>a</td><td>b</td><td>c</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    const [a, b, c] = Array.from(t.rows[1].cells);
    setRect(a, 0, 100);
    setRect(b, 100, 200);
    setRect(c, 200, 300);
    const wide = grid[0][0]!;
    const pos = { r: 0, c: 0 };
    expect(colOffsetWithin(wide, grid, pos, 50)).toBe(0);
    expect(colOffsetWithin(wide, grid, pos, 150)).toBe(1);
    expect(colOffsetWithin(wide, grid, pos, 250)).toBe(2);
  });

  it("picks the last spanned column when the pointer is past the right edge", () => {
    const t = table(`<table>
      <tr><td colspan="2">wide</td></tr>
      <tr><td>a</td><td>b</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    const [a, b] = Array.from(t.rows[1].cells);
    setRect(a, 0, 100);
    setRect(b, 100, 200);
    const pos = { r: 0, c: 0 };
    expect(colOffsetWithin(grid[0][0]!, grid, pos, 200)).toBe(1);
    expect(colOffsetWithin(grid[0][0]!, grid, pos, 350)).toBe(1);
    expect(colOffsetWithin(grid[0][0]!, grid, pos, -20)).toBe(0);
  });

  it("falls back to the first spanned column when no other row has single-column cells", () => {
    const t = table(`<table><tr><td colspan="2">wide</td></tr></table>`);
    const { grid } = buildGrid(t);
    expect(colOffsetWithin(grid[0][0]!, grid, { r: 0, c: 0 }, 150)).toBe(0);
  });
});

// Same shape as the demo's merged table: "Q1" spans Jan+Feb, "30 (merged)" spans Jan+Feb.
const mergedQuarterTable = () =>
  table(`<table>
    <tr><th>Region</th><th colspan="2">Q1</th><th>Q2</th></tr>
    <tr><th></th><th>Jan</th><th>Feb</th><th>Apr</th></tr>
    <tr><td rowspan="2">North</td><td>10</td><td>11</td><td>12</td></tr>
    <tr><td>20</td><td>21</td><td>22</td></tr>
    <tr><td>South</td><td colspan="2">30 (merged)</td><td>32</td></tr>
  </table>`);

describe("singleColumnCell", () => {
  it("skips cells merged into a neighbouring column", () => {
    const { grid } = buildGrid(mergedQuarterTable());
    // Row 0 of column 2 is "Q1" (colspan=2), so the first single-column cell is "Feb".
    expect(cellText(singleColumnCell(grid, 2)!)).toBe("Feb");
    expect(cellText(singleColumnCell(grid, 1)!)).toBe("Jan");
  });

  it("accepts a rowspan cell, which still spans one column", () => {
    const { grid } = buildGrid(mergedQuarterTable());
    expect(cellText(singleColumnCell(grid, 0)!)).toBe("Region");
  });

  it("returns null when every cell in the column is merged with a neighbour", () => {
    const { grid } = buildGrid(table(`<table><tr><td colspan="2">wide</td></tr></table>`));
    expect(singleColumnCell(grid, 0)).toBeNull();
  });

  it("returns null for a column past the end", () => {
    const { grid } = buildGrid(mergedQuarterTable());
    expect(singleColumnCell(grid, 9)).toBeNull();
  });
});

describe("columnXRange", () => {
  it("uses the column's own cell, not a merged cell that also covers a neighbour", () => {
    const t = mergedQuarterTable();
    const { grid } = buildGrid(t);
    const [, jan, feb] = Array.from(t.rows[1].cells);
    setRect(jan, 100, 200);
    setRect(feb, 200, 300);
    // The merged cells span both columns; they must not widen Feb's range.
    setRect(t.rows[0].cells[1], 100, 300);
    setRect(t.rows[4].cells[1], 100, 300);
    expect(columnXRange(grid, 2)).toEqual({ left: 200, right: 300 });
    expect(columnXRange(grid, 1)).toEqual({ left: 100, right: 200 });
  });

  it("returns null when the column has no single-column cell", () => {
    const { grid } = buildGrid(table(`<table><tr><td colspan="2">wide</td></tr></table>`));
    expect(columnXRange(grid, 1)).toBeNull();
  });
});

describe("cellText", () => {
  it("collapses whitespace and newlines and trims", () => {
    const t = table(`<table><tr><td>
      Ada
        <b>Lovelace</b>\t
    </td></tr></table>`);

    expect(cellText(t.rows[0].cells[0])).toBe("Ada Lovelace");
  });

  it("returns an empty string for an empty cell", () => {
    const t = table(`<table><tr><td>   </td></tr></table>`);
    expect(cellText(t.rows[0].cells[0])).toBe("");
  });
});

describe("findCell", () => {
  it("finds the cell from a nested element", () => {
    const t = table(`<table><tr><td id="c"><a href="#"><span>x</span></a></td></tr></table>`);
    expect(findCell(t.querySelector("span"))?.id).toBe("c");
  });

  it("finds the cell from a text node", () => {
    const t = table(`<table><tr><th id="h">Header</th></tr></table>`);
    expect(findCell(t.querySelector("th")!.firstChild)?.id).toBe("h");
  });

  it("returns null outside a table", () => {
    document.body.innerHTML = `<p>not a table</p>`;
    expect(findCell(document.querySelector("p"))).toBeNull();
  });

  it("returns null for a stray <td> that is not inside a <table>", () => {
    const td = document.createElement("td");
    document.body.appendChild(td);
    expect(findCell(td)).toBeNull();
  });

  it("returns null for a null target", () => {
    expect(findCell(null)).toBeNull();
  });
});

/** Text of each slot in a block ("·" for an empty slot), one string per row. */
const blockTexts = (block: (Cell | null)[][]): string[] =>
  block.map((row) => row.map((c) => (c ? cellText(c) : "·")).join(" "));

describe("cellBlock", () => {
  it("returns every cell of a plain table, row by row", () => {
    const t = table(`<table>
      <tr><td>a</td><td>b</td><td>c</td></tr>
      <tr><td>d</td><td>e</td><td>f</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    expect(blockTexts(cellBlock(grid, { r0: 0, r1: 1, c0: 1, c1: 2 }))).toEqual(["b c", "e f"]);
  });

  it("puts a colspan cell's text in its first slot and leaves the rest empty", () => {
    const t = table(`<table>
      <tr><td colspan="2">wide</td><td>x</td></tr>
      <tr><td>a</td><td>b</td><td>c</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    expect(blockTexts(cellBlock(grid, { r0: 0, r1: 1, c0: 0, c1: 2 }))).toEqual(["wide · x", "a b c"]);
  });

  it("shows a colspan cell that starts left of the block in the block's first column", () => {
    const t = table(`<table>
      <tr><td colspan="2">wide</td><td>x</td></tr>
      <tr><td>a</td><td>b</td><td>c</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    expect(blockTexts(cellBlock(grid, { r0: 0, r1: 1, c0: 1, c1: 2 }))).toEqual(["wide x", "b c"]);
  });

  it("puts a rowspan cell's text in its first row only", () => {
    const t = table(`<table>
      <tr><td rowspan="2">tall</td><td>a</td></tr>
      <tr><td>b</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    expect(blockTexts(cellBlock(grid, { r0: 0, r1: 1, c0: 0, c1: 1 }))).toEqual(["tall a", "· b"]);
  });

  it("leaves missing slots of a ragged row empty", () => {
    const t = table(`<table>
      <tr><td>a</td><td>b</td></tr>
      <tr><td>c</td></tr>
    </table>`);

    const { grid } = buildGrid(t);
    expect(blockTexts(cellBlock(grid, { r0: 0, r1: 1, c0: 0, c1: 1 }))).toEqual(["a b", "c ·"]);
  });
});

describe("blockToText", () => {
  const block = (): (Cell | null)[][] => {
    const t = table(`<table>
      <tr><td colspan="2">wide</td><td>x</td></tr>
      <tr><td></td><td></td><td></td></tr>
      <tr><td>a</td><td></td><td>c</td></tr>
    </table>`);

    return cellBlock(buildGrid(t).grid, { r0: 0, r1: 2, c0: 0, c1: 2 });
  };

  it("joins cells with tabs and rows with newlines", () => {
    expect(blockToText(block(), false)).toBe("wide\t\tx\n\t\t\na\t\tc");
  });

  it("drops only the rows that are entirely empty when trimming", () => {
    expect(blockToText(block(), true)).toBe("wide\t\tx\na\t\tc");
  });
});

describe("columnCount", () => {
  it("is the width of the widest row", () => {
    const t = table(`<table>
      <tr><td colspan="3">wide</td></tr>
      <tr><td>a</td></tr>
    </table>`);

    expect(columnCount(buildGrid(t).grid)).toBe(3);
  });

  it("is 0 for an empty grid", () => {
    expect(columnCount([])).toBe(0);
  });
});

describe("endColumnAt", () => {
  // Columns 100px wide: centres at 50, 150, 250, 350.
  const centers = [50, 150, 250, 350];

  it("stays on the anchor until the pointer passes a neighbour's centre", () => {
    expect(endColumnAt(centers, 1, 160)).toBe(1);
    expect(endColumnAt(centers, 1, 249)).toBe(1);
    expect(endColumnAt(centers, 1, 51)).toBe(1);
  });

  it("widens to the right one column per centre passed", () => {
    expect(endColumnAt(centers, 1, 250)).toBe(2);
    expect(endColumnAt(centers, 1, 400)).toBe(3);
  });

  it("widens to the left one column per centre passed", () => {
    expect(endColumnAt(centers, 2, 150)).toBe(1);
    expect(endColumnAt(centers, 2, 10)).toBe(0);
  });

  it("narrows back to the anchor when the pointer returns", () => {
    expect(endColumnAt(centers, 1, 400)).toBe(3);
    expect(endColumnAt(centers, 1, 200)).toBe(1);
  });

  it("passes over columns with no known centre", () => {
    const gappy = [50, null, 250, 350];
    expect(endColumnAt(gappy, 0, 200)).toBe(0);
    expect(endColumnAt(gappy, 0, 260)).toBe(2);
    expect(endColumnAt(gappy, 2, 40)).toBe(0);
  });
});

describe("extraColumns", () => {
  it("counts the columns a cell covers beyond its first", () => {
    const t = table(`<table><tr><td colspan="3">wide</td><td>x</td></tr></table>`);
    const { grid } = buildGrid(t);
    expect(extraColumns(grid, { r: 0, c: 0 }, grid[0][0]!)).toBe(2);
    expect(extraColumns(grid, { r: 0, c: 3 }, grid[0][3]!)).toBe(0);
  });
});
