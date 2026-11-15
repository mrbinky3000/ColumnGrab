// ColumnGrab content script: modifier-drag selection + context-menu column copy.
(() => {
  if (window.__columnGrabLoaded) return;
  window.__columnGrabLoaded = true;

  // ---------- Settings ----------
  // Modifier presets. Plain Alt/Option is the default: Chrome reserves no Alt+drag gesture,
  // and we swallow the click that follows a drag so Alt+click-to-download never fires.
  const MODIFIERS = {
    alt: (e) => e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey,
    "alt+shift": (e) => e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey,
    "ctrl+alt": (e) => e.altKey && e.ctrlKey && !e.metaKey && !e.shiftKey,
  };
  let settings = { modifier: "alt", trimEmpty: false };
  const matchesModifier = (e) => (MODIFIERS[settings.modifier] || MODIFIERS.alt)(e);

  try {
    chrome.storage.sync.get(settings, (s) => (settings = { ...settings, ...s }));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    });
  } catch {
    /* extension context invalidated (extension reloaded) */
  }

  // ---------- Table geometry ----------
  // Build a logical grid that accounts for rowspan/colspan so "column 3" means the
  // visual column 3, not the 3rd <td> in the row.
  function buildGrid(table) {
    const rows = Array.from(table.rows);
    const grid = rows.map(() => []);
    rows.forEach((row, r) => {
      let c = 0;
      for (const cell of row.cells) {
        while (grid[r][c]) c++;
        const rs = cell.rowSpan === 0 ? rows.length - r : Math.max(1, cell.rowSpan || 1);
        const cs = Math.max(1, Math.min(cell.colSpan || 1, 1000));
        for (let i = 0; i < rs && r + i < rows.length; i++) {
          for (let j = 0; j < cs; j++) grid[r + i][c + j] = cell;
        }
        c += cs;
      }
    });
    return { rows, grid };
  }

  function locate(grid, cell) {
    for (let r = 0; r < grid.length; r++) {
      const c = grid[r].indexOf(cell);
      if (c !== -1) return { r, c };
    }
    return null;
  }

  // Header rows: everything in <thead>; otherwise leading rows made entirely of <th>.
  function headerRowCount(table, rows) {
    if (table.tHead && table.tHead.rows.length) return table.tHead.rows.length;
    let n = 0;
    for (const row of rows) {
      const cells = Array.from(row.cells);
      if (cells.length && cells.every((c) => c.tagName === "TH")) n++;
      else break;
    }
    return n;
  }

  // Unique cells in column `col` between rows r0..r1 (rowspans counted once).
  function columnCells(grid, col, r0, r1) {
    const out = [];
    let prev = null;
    for (let r = r0; r <= r1; r++) {
      const cell = grid[r]?.[col];
      if (cell && cell !== prev) out.push(cell);
      if (cell) prev = cell;
    }
    return out;
  }

  const cellText = (cell) => (cell.innerText ?? cell.textContent ?? "").replace(/\s+/g, " ").trim();

  function cellsToText(cells) {
    let values = cells.map(cellText);
    if (settings.trimEmpty) values = values.filter((v) => v !== "");
    return values.join("\n");
  }

  const findCell = (node) => {
    const el = node instanceof Element ? node : node?.parentElement;
    const cell = el?.closest("td, th");
    return cell && cell.closest("table") ? cell : null;
  };

  // ---------- Clipboard ----------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    try {
      const active = document.activeElement;
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
      document.documentElement.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      active?.focus?.({ preventScroll: true });
      if (ok) return true;
    } catch {}
    try {
      const res = await chrome.runtime.sendMessage({ type: "columngrab:clipboard-fallback", text });
      return !!res?.ok;
    } catch {
      return false;
    }
  }

  async function copyCells(cells) {
    if (!cells.length) return toast("No cells to copy", true);
    const ok = await copyText(cellsToText(cells));
    toast(ok ? `Copied ${cells.length} cell${cells.length === 1 ? "" : "s"}` : "Couldn't access the clipboard", !ok);
  }

  // ---------- UI (isolated in a shadow root so page CSS can't touch it) ----------
  let uiRoot = null;
  function ui() {
    if (uiRoot?.host.isConnected) return uiRoot;
    const host = document.createElement("columngrab-ui");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    uiRoot = host.attachShadow({ mode: "closed" });
    uiRoot.innerHTML = `
      <style>
        .box{position:fixed;display:none;box-sizing:border-box;border:2px solid #F59E0B;
             background:rgba(245,158,11,.18);border-radius:3px;pointer-events:none;}
        .badge{position:fixed;display:none;font:600 12px/1 system-ui,sans-serif;color:#1F2937;
               background:#F59E0B;padding:4px 7px;border-radius:10px;pointer-events:none;white-space:nowrap;}
        .toast{position:fixed;right:16px;bottom:16px;font:500 13px/1.3 system-ui,sans-serif;
               color:#fff;background:#312E81;padding:10px 14px;border-radius:8px;
               box-shadow:0 6px 20px rgba(0,0,0,.25);opacity:0;transform:translateY(8px);
               transition:opacity .15s,transform .15s;pointer-events:none;}
        .toast.show{opacity:1;transform:none;}
        .toast.err{background:#B91C1C;}
      </style>
      <div class="box"></div><div class="badge"></div><div class="toast"></div>`;
    document.documentElement.appendChild(host);
    return uiRoot;
  }

  let toastTimer = 0;
  function toast(msg, isError = false) {
    const el = ui().querySelector(".toast");
    el.textContent = `ColumnGrab: ${msg}`;
    el.classList.toggle("err", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function drawSelection(cells) {
    const root = ui();
    const box = root.querySelector(".box");
    const badge = root.querySelector(".badge");
    if (!cells.length) {
      box.style.display = badge.style.display = "none";
      return;
    }
    let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    Object.assign(box.style, {
      display: "block",
      top: `${top}px`,
      left: `${left}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`,
    });
    badge.textContent = `${cells.length} cell${cells.length === 1 ? "" : "s"}`;
    Object.assign(badge.style, {
      display: "block",
      top: `${Math.min(bottom + 4, window.innerHeight - 24)}px`,
      left: `${Math.max(4, left)}px`,
    });
  }

  // ---------- Drag-to-select ----------
  let drag = null; // { table, grid, rows, col, startRow, endRow, lastY, raf }

  function rowAtY(y) {
    const { rows } = drag;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect();
      if (y >= r.top && y < r.bottom) return i;
    }
    // Outside the table: clamp to the nearest end.
    return y < rows[0].getBoundingClientRect().top ? 0 : rows.length - 1;
  }

  function currentCells() {
    const r0 = Math.min(drag.startRow, drag.endRow);
    const r1 = Math.max(drag.startRow, drag.endRow);
    return columnCells(drag.grid, drag.col, r0, r1);
  }

  function update() {
    drag.endRow = rowAtY(drag.lastY);
    drawSelection(currentCells());
  }

  // Auto-scroll when the pointer sits near the top/bottom edge of the viewport.
  function autoScrollLoop() {
    if (!drag) return;
    const edge = 40;
    const y = drag.lastY;
    let dy = 0;
    if (y < edge) dy = -Math.ceil((edge - y) / 3);
    else if (y > window.innerHeight - edge) dy = Math.ceil((y - (window.innerHeight - edge)) / 3);
    if (dy) {
      window.scrollBy(0, dy);
      update();
    }
    drag.raf = requestAnimationFrame(autoScrollLoop);
  }

  function onMouseDown(e) {
    if (e.button !== 0 || !matchesModifier(e)) return;
    const cell = findCell(e.target);
    if (!cell) return;
    const table = cell.closest("table");
    const { rows, grid } = buildGrid(table);
    const pos = locate(grid, cell);
    if (!pos) return;

    e.preventDefault(); // no text selection, no native drag
    e.stopPropagation();
    // Use the column under the pointer (matters for colspan cells).
    const col = pos.c + colOffsetWithin(cell, grid, pos, e.clientX);
    drag = { table, rows, grid, col, startRow: pos.r, endRow: pos.r, lastY: e.clientY, raf: 0 };
    window.getSelection()?.removeAllRanges();
    update();
    drag.raf = requestAnimationFrame(autoScrollLoop);

    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("keydown", onDragKey, true);
    window.addEventListener("scroll", onScroll, true);
  }

  // For a colspan cell, pick the spanned column the pointer is over by checking
  // the other rows' cells in each candidate column.
  function colOffsetWithin(cell, grid, pos, x) {
    let span = 0;
    while (grid[pos.r][pos.c + span + 1] === cell) span++;
    if (!span) return 0;
    for (let k = 0; k <= span; k++) {
      for (const row of grid) {
        const other = row[pos.c + k];
        if (other && other !== cell && row[pos.c + k - 1] !== other && row[pos.c + k + 1] !== other) {
          const r = other.getBoundingClientRect();
          if (x >= r.left && x < r.right) return k;
          break;
        }
      }
    }
    return 0;
  }

  function onMouseMove(e) {
    if (!drag) return;
    e.preventDefault();
    drag.lastY = e.clientY;
    update();
  }

  const onScroll = () => drag && update();

  function endDrag() {
    cancelAnimationFrame(drag?.raf);
    drag = null;
    drawSelection([]);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseup", onMouseUp, true);
    window.removeEventListener("keydown", onDragKey, true);
    window.removeEventListener("scroll", onScroll, true);
  }

  function onMouseUp(e) {
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    drag.lastY = e.clientY;
    update();
    const cells = currentCells();
    endDrag();
    // Swallow the click that follows, so links/buttons in the cell (and Alt+click download) don't fire.
    const swallow = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true), 0);
    copyCells(cells);
  }

  function onDragKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      endDrag();
      toast("Cancelled");
    }
  }

  // ---------- "Armed" cursor while the modifier is held ----------
  const ARMED = "columngrab-armed";
  const style = document.createElement("style");
  style.textContent = `html.${ARMED} td, html.${ARMED} th { cursor: cell !important; }`;
  (document.head || document.documentElement).appendChild(style);
  const setArmed = (on) => document.documentElement.classList.toggle(ARMED, on);
  window.addEventListener("keydown", (e) => setArmed(matchesModifier(e)), true);
  window.addEventListener("keyup", (e) => setArmed(matchesModifier(e)), true);
  window.addEventListener("blur", () => setArmed(false));

  window.addEventListener("mousedown", onMouseDown, true);

  // ---------- Context menu ----------
  let lastContextCell = null;
  window.addEventListener(
    "contextmenu",
    (e) => {
      lastContextCell = findCell(e.target);
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "columngrab:copy-column") return;
    const cell = lastContextCell;
    if (!cell || !cell.isConnected) {
      toast("Right-click inside a table cell first", true);
      return;
    }
    const table = cell.closest("table");
    const { rows, grid } = buildGrid(table);
    const pos = locate(grid, cell);
    if (!pos) return;
    const start = msg.includeHeader ? 0 : headerRowCount(table, rows);
    const cells = columnCells(grid, pos.c, start, rows.length - 1);
    // Flash the copied column briefly.
    drawSelection(cells);
    setTimeout(() => drawSelection([]), 450);
    copyCells(cells);
  });
})();
