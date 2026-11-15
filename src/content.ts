// ColumnGrab content script: modifier-drag selection + context-menu column copy.
import { requireElement } from "./dom";
import {
  isCopyColumnMessage,
  isCopyResult,
  isCopyTableMessage,
  type ClipboardFallbackMessage,
} from "./messages";
import { blockBands, outlinePath, type Rect } from "./outline";
import { DEFAULT_SETTINGS, loadSettings, type Modifier, type Settings } from "./settings";
import {
  blockToText,
  buildGrid,
  cellBlock,
  cellText,
  colOffsetWithin,
  columnCells,
  columnCenters,
  columnCount,
  endColumnAt,
  extraColumns,
  findCell,
  headerRowCount,
  locate,
  type BlockRange,
  type Cell,
  type Grid,
  type GridPos,
} from "./table";

declare global {
  interface Window {
    __columnGrabLoaded?: boolean;
  }
}

interface DragState {
  table: HTMLTableElement;
  rows: HTMLTableRowElement[];
  grid: Grid;
  /** The cell the drag started on, and its top-left grid position. */
  startCell: Cell;
  startPos: GridPos;
  /**
   * False while the pointer is still inside a merged start cell: the anchor column then
   * follows the pointer across the cell's span, and is fixed once the pointer leaves the cell
   * (on the cell's far side when it leaves sideways).
   */
  colLocked: boolean;
  /** The column the drag started in, and the far column it has been widened to. */
  anchorCol: number;
  endCol: number;
  startRow: number;
  endRow: number;
  lastX: number;
  lastY: number;
  raf: number;
}

type KeyState = Pick<MouseEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

// Modifier presets. Plain Alt/Option is the default: Chrome reserves no Alt+drag gesture,
// and we swallow the click that follows a drag so Alt+click-to-download never fires.
const MODIFIERS: Record<Modifier, (e: KeyState) => boolean> = {
  alt: (e) => e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey,
  "alt+shift": (e) => e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey,
  "ctrl+alt": (e) => e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey,
};

const ARMED_CLASS = "columngrab-armed";
const AUTOSCROLL_EDGE = 40;
const TOAST_MS = 1800;
const FLASH_MS = 450;

function main(): void {
  // Content scripts can be injected more than once into the same frame (e.g. after an update).
  if (window.__columnGrabLoaded) return;
  window.__columnGrabLoaded = true;

  // ---------- Settings ----------
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const matchesModifier = (e: KeyState): boolean => MODIFIERS[settings.modifier](e);

  try {
    const reloadSettings = (): void => {
      void loadSettings().then((s) => (settings = s));
    };

    reloadSettings();
    // Re-read through loadSettings so changed values get the same defaults as at startup.
    chrome.storage.onChanged.addListener((_changes, area) => {
      if (area === "sync") reloadSettings();
    });
  } catch {
    // Extension context invalidated (extension reloaded while the page stayed open).
  }

  function cellsToText(cells: Cell[]): string {
    let values = cells.map(cellText);

    if (settings.trimEmpty) values = values.filter((v) => v !== "");

    return values.join("\n");
  }

  // ---------- Selection ----------
  /** What a drag or menu command selected: what to outline, how to describe it, what to copy. */
  interface Selection {
    rects: Rect[];
    /** Badge and toast wording, e.g. "5 cells" or "3 columns × 5 rows". */
    label: string;
    isEmpty: boolean;
    toText: () => string;
  }

  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

  /**
   * A single column copies one value per line, with rowspans counted once. Several columns
   * copy tab-separated rows, with each merged cell's text once and blanks in its other slots.
   */
  function selectBlock(rows: HTMLTableRowElement[], grid: Grid, range: BlockRange): Selection {
    if (range.c0 === range.c1) {
      const cells = columnCells(grid, range.c0, range.r0, range.r1);

      return {
        rects: cells.map((c) => c.getBoundingClientRect()),
        label: plural(cells.length, "cell"),
        isEmpty: !cells.length,
        toText: () => cellsToText(cells),
      };
    }

    const nCols = range.c1 - range.c0 + 1;
    const nRows = range.r1 - range.r0 + 1;

    return {
      rects: blockBands(rows, grid, range),
      label: `${plural(nCols, "column")} × ${plural(nRows, "row")}`,
      isEmpty: false,
      toText: () => blockToText(cellBlock(grid, range), settings.trimEmpty),
    };
  }

  // ---------- Clipboard ----------
  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);

      return true;
    } catch {
      // Fall through: no focus, or blocked by the frame's permissions policy.
    }

    try {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      document.documentElement.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      active?.focus({ preventScroll: true });

      if (ok) return true;
    } catch {
      // Fall through to the background/offscreen path.
    }

    try {
      const message: ClipboardFallbackMessage = { type: "columngrab:clipboard-fallback", text };
      const res = await chrome.runtime.sendMessage<ClipboardFallbackMessage, unknown>(message);

      return isCopyResult(res) && res.ok;
    } catch {
      return false;
    }
  }

  async function copySelection(sel: Selection): Promise<void> {
    if (sel.isEmpty) return toast("No cells to copy", true);
    const ok = await copyText(sel.toText());
    toast(ok ? `Copied ${sel.label}` : "Couldn't access the clipboard", !ok);
  }

  // ---------- UI (isolated in a shadow root so page CSS can't touch it) ----------
  interface Ui {
    root: ShadowRoot;
    box: SVGElement;
    outline: SVGElement;
    badge: HTMLDivElement;
    toast: HTMLDivElement;
  }

  let uiState: Ui | null = null;

  function ui(): Ui {
    if (uiState?.root.host.isConnected) return uiState;
    const host = document.createElement("columngrab-ui");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        .box{position:fixed;inset:0;width:100%;height:100%;display:none;overflow:visible;
             pointer-events:none;}
        .box path{fill:rgba(245,158,11,.18);stroke:#F59E0B;stroke-width:2;stroke-linejoin:round;}
        .badge{position:fixed;display:none;font:600 12px/1 system-ui,sans-serif;color:#1F2937;
               background:#F59E0B;padding:4px 7px;border-radius:10px;pointer-events:none;white-space:nowrap;}
        .toast{position:fixed;right:16px;bottom:16px;font:500 13px/1.3 system-ui,sans-serif;
               color:#fff;background:#312E81;padding:10px 14px;border-radius:8px;
               box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transform:translateY(8px);
               transition:opacity .15s,transform .15s;pointer-events:none;}
        .toast.show{opacity:1;transform:none;}
        .toast.err{background:#B91C1C;}
      </style>
      <svg class="box"><path></path></svg><div class="badge"></div><div class="toast"></div>`;
    document.documentElement.appendChild(host);
    const q = (sel: string) => requireElement(root, sel, HTMLDivElement);
    const svg = (sel: string) => requireElement(root, sel, SVGElement);
    uiState = {
      root,
      box: svg(".box"),
      outline: svg(".box path"),
      badge: q(".badge"),
      toast: q(".toast"),
    };

    return uiState;
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function toast(msg: string, isError = false): void {
    const el = ui().toast;
    el.textContent = `ColumnGrab: ${msg}`;
    el.classList.toggle("err", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), TOAST_MS);
  }

  /**
   * Outline a selection. Each cell (or row band) is drawn at its own width, so a merged cell
   * is highlighted in full without covering cells in columns that aren't selected.
   */
  function drawSelection(sel: Selection | null): void {
    const { box, outline, badge } = ui();

    if (!sel?.rects.length) {
      box.style.display = badge.style.display = "none";

      return;
    }

    outline.setAttribute("d", outlinePath(sel.rects));
    box.style.display = "block";
    const last = sel.rects[sel.rects.length - 1];
    badge.textContent = sel.label;
    Object.assign(badge.style, {
      display: "block",
      top: `${Math.min(last.bottom + 4, window.innerHeight - 24)}px`,
      left: `${Math.max(4, last.left)}px`,
    });
  }

  // ---------- Drag-to-select ----------
  // Every input handler ignores events the page made itself (dispatchEvent). Content scripts
  // receive those too, and acting on them would let any page or iframe use the extension's
  // clipboard access to overwrite the clipboard without the user doing anything.
  let drag: DragState | null = null;

  function rowAtY(d: DragState, y: number): number {
    for (let i = 0; i < d.rows.length; i++) {
      const r = d.rows[i].getBoundingClientRect();

      if (y >= r.top && y < r.bottom) return i;
    }

    // Outside the table: clamp to the nearest end.
    return y < d.rows[0].getBoundingClientRect().top ? 0 : d.rows.length - 1;
  }

  function currentSelection(d: DragState): Selection {
    return selectBlock(d.rows, d.grid, {
      r0: Math.min(d.startRow, d.endRow),
      r1: Math.max(d.startRow, d.endRow),
      c0: Math.min(d.anchorCol, d.endCol),
      c1: Math.max(d.anchorCol, d.endCol),
    });
  }

  function isInside(el: Element, x: number, y: number): boolean {
    const r = el.getBoundingClientRect();

    return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
  }

  function update(d: DragState): void {
    d.endRow = rowAtY(d, d.lastY);

    if (!d.colLocked) {
      const box = d.startCell.getBoundingClientRect();

      // Leaving a merged cell sideways anchors on its far side, so the whole cell is kept.
      if (d.lastX >= box.right) d.anchorCol = d.startPos.c;
      else if (d.lastX < box.left)
        d.anchorCol = d.startPos.c + extraColumns(d.grid, d.startPos, d.startCell);
      else d.anchorCol = d.startPos.c + colOffsetWithin(d.startCell, d.grid, d.startPos, d.lastX);
      d.endCol = d.anchorCol;
      d.colLocked = !isInside(d.startCell, d.lastX, d.lastY);
    }

    // Once the anchor is fixed, moving past a neighbouring column's centre widens the block.
    if (d.colLocked) d.endCol = endColumnAt(columnCenters(d.grid), d.anchorCol, d.lastX);

    drawSelection(currentSelection(d));
  }

  // Auto-scroll when the pointer sits near the top/bottom edge of the viewport.
  function autoScrollLoop(): void {
    if (!drag) return;
    const y = drag.lastY;
    let dy = 0;

    if (y < AUTOSCROLL_EDGE) dy = -Math.ceil((AUTOSCROLL_EDGE - y) / 3);
    else if (y > window.innerHeight - AUTOSCROLL_EDGE)
      dy = Math.ceil((y - (window.innerHeight - AUTOSCROLL_EDGE)) / 3);

    if (dy) {
      window.scrollBy(0, dy);
      update(drag);
    }

    drag.raf = requestAnimationFrame(autoScrollLoop);
  }

  function onMouseDown(e: MouseEvent): void {
    if (!e.isTrusted || e.button !== 0 || !matchesModifier(e)) return;
    const cell = findCell(e.target);
    const table = cell?.closest("table");

    if (!cell || !table) return;
    const { rows, grid } = buildGrid(table);
    const pos = locate(grid, cell);

    if (!pos) return;

    e.preventDefault(); // no text selection, no native drag
    e.stopPropagation();
    // The column under the pointer; for a merged (colspan) cell, update() keeps it in step
    // with the pointer until the drag leaves the cell. Other cells fix it straight away.
    drag = {
      table,
      rows,
      grid,
      startCell: cell,
      startPos: pos,
      colLocked: cell.colSpan <= 1,
      anchorCol: pos.c,
      endCol: pos.c,
      startRow: pos.r,
      endRow: pos.r,
      lastX: e.clientX,
      lastY: e.clientY,
      raf: 0,
    };
    window.getSelection()?.removeAllRanges();
    update(drag);
    drag.raf = requestAnimationFrame(autoScrollLoop);

    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("keydown", onDragKey, true);
    window.addEventListener("scroll", onScroll, true);
  }

  function onMouseMove(e: MouseEvent): void {
    if (!drag || !e.isTrusted) return;
    e.preventDefault();
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    update(drag);
  }

  function onScroll(): void {
    if (drag) update(drag);
  }

  function endDrag(): void {
    if (drag) cancelAnimationFrame(drag.raf);
    drag = null;
    drawSelection(null);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("keydown", onDragKey, true);
    window.removeEventListener("scroll", onScroll, true);
  }

  function swallowClick(ev: MouseEvent): void {
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onMouseUp(e: MouseEvent): void {
    if (!drag || !e.isTrusted) return;
    e.preventDefault();
    e.stopPropagation();
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    update(drag);
    const sel = currentSelection(drag);
    endDrag();
    // Swallow the click that follows, so links/buttons in the cell (and Alt+click download) don't fire.
    window.addEventListener("click", swallowClick, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallowClick, true), 0);
    void copySelection(sel);
  }

  function onDragKey(e: KeyboardEvent): void {
    if (!e.isTrusted || e.key !== "Escape") return;
    e.preventDefault();
    endDrag();
    toast("Cancelled");
  }

  // ---------- "Armed" cursor while the modifier is held ----------
  const style = document.createElement("style");
  style.textContent = `html.${ARMED_CLASS} td, html.${ARMED_CLASS} th { cursor: cell !important; }`;
  (document.head ?? document.documentElement).appendChild(style);
  const setArmed = (on: boolean) => document.documentElement.classList.toggle(ARMED_CLASS, on);
  window.addEventListener("keydown", (e) => setArmed(matchesModifier(e)), true);
  window.addEventListener("keyup", (e) => setArmed(matchesModifier(e)), true);
  window.addEventListener("blur", () => setArmed(false));

  window.addEventListener("mousedown", onMouseDown, true);

  // ---------- Context menu ----------
  let lastContextCell: Cell | null = null;
  window.addEventListener(
    "contextmenu",
    (e) => {
      if (e.isTrusted) lastContextCell = findCell(e.target);
    },
    true,
  );

  chrome.runtime.onMessage.addListener((msg) => {
    const wholeTable = isCopyTableMessage(msg);

    if (!wholeTable && !isCopyColumnMessage(msg)) return;
    const cell = lastContextCell;
    const table = cell?.closest("table");

    if (!cell?.isConnected || !table) {
      toast("Right-click inside a table cell first", true);

      return;
    }

    const { rows, grid } = buildGrid(table);
    const pos = locate(grid, cell);

    if (!pos) return;
    const last = rows.length - 1;
    let range: BlockRange;

    if (wholeTable) range = { r0: 0, r1: last, c0: 0, c1: Math.max(0, columnCount(grid) - 1) };
    else {
      const r0 = msg.includeHeader ? 0 : headerRowCount(table, rows);
      range = { r0, r1: last, c0: pos.c, c1: pos.c };
    }

    const sel = selectBlock(rows, grid, range);
    // Flash the copied cells briefly.
    drawSelection(sel);
    setTimeout(() => drawSelection(null), FLASH_MS);
    void copySelection(sel);
  });
}

main();
