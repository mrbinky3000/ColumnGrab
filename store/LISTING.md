# ColumnGrab: store & repo copy

## Chrome Web Store

**Name:** ColumnGrab

**Summary** (manifest `description`, 132-char limit; this one is 104):

> Copy any HTML table column in one move: Alt-drag down a column or right-click a cell. Paste anywhere.

**Category:** Productivity → Tools

**Detailed description:**

```
Grab a whole table column in one move.

Copying a single column out of a web table is usually painful. Drag-selecting grabs the entire row, and pasting it brings along every other column. ColumnGrab copies just the column you want, one value per line, ready to paste into a spreadsheet, a doc, or a code editor.

TWO WAYS TO GRAB
• Drag: hold Alt (Option ⌥ on Mac) and drag down a column. A highlight shows exactly which cells you're taking, and they're copied the moment you let go.
• Right-click: right-click any cell → ColumnGrab → "Copy this table column", with or without the header.

BUILT FOR REAL-WORLD TABLES
• Understands merged cells (rowspan/colspan), so you get the column you see on screen.
• Works inside iframes and on long tables: auto-scrolls while you drag.
• Clean output: whitespace collapsed, one cell per line, pastes straight into Sheets or Excel as a column.
• Press Esc mid-drag to cancel.

YOUR CHOICE OF KEY
Prefer Alt+Shift or Ctrl+Alt? Change the drag key in Settings (click the toolbar icon). You can also skip empty cells.

PRIVATE BY DESIGN
ColumnGrab runs entirely in your browser. It never collects, stores, or sends page data anywhere. It reads a table only when you ask it to copy one.
```

**Single purpose** (dashboard field):

> ColumnGrab copies the contents of a single HTML table column to the clipboard, triggered by a modifier-key drag or a right-click menu item.

**Permission justifications** (dashboard fields):

| Permission | Justification |
|---|---|
| `contextMenus` | Adds the "Copy this table column" items to the right-click menu. |
| `clipboardWrite` | Writes the copied column text to the clipboard. |
| `storage` | Saves the user's drag-key and output preferences. |
| `offscreen` | Fallback clipboard write when a page (e.g. a sandboxed iframe) blocks clipboard access. |
| Host access (`<all_urls>` content script) | Tables can appear on any website; the script must be present to detect the drag gesture and the right-clicked cell. It reads table text only when the user triggers a copy, and sends nothing over the network. |

**Data usage disclosure:** collects no user data. Tick nothing; certify all three statements.

**Assets still needed for submission:**
- Store icon: `icons/icon128.png` ✅
- At least one screenshot, 1280×800 or 640×400 (e.g. the demo page mid-drag)
- Small promo tile 440×280 (optional but recommended)

---

## GitHub repo description (350-char limit)

> Chrome extension that copies a single HTML table column to your clipboard. Alt-drag down a column or right-click a cell. Handles rowspan/colspan, iframes, and long tables. Manifest V3, no tracking.

**Suggested topics:** `chrome-extension` `manifest-v3` `html-table` `clipboard` `productivity` `data-extraction`
