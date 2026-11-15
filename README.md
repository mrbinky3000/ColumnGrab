# ColumnGrab

<img src="icons/icon128.png" width="64" align="right" alt="">

Copy a single HTML table column to your clipboard, one value per line.

- **Drag:** hold **Alt** (⌥ Option on Mac) and drag down a column. Release to copy. **Esc** cancels.
- **Right-click:** right-click a cell → **ColumnGrab → Copy this table column** (with or without header).

Handles `rowspan`/`colspan`, iframes, and long tables (auto-scrolls while dragging). The drag key can be changed to Alt+Shift or Ctrl+Alt from the settings popup (click the toolbar icon).

## Install (development)

1. Open `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and pick this folder.
3. Open `demo/index.html` to try it. Tabs that were already open need a reload before ColumnGrab works in them.

## Package for the Chrome Web Store

```bash
./package.sh   # → dist/columngrab-<version>.zip
```

Store listing copy and permission justifications are in [store/LISTING.md](store/LISTING.md). The icon source is in `icons/src/`.

## Privacy

Runs entirely locally. No analytics, no network requests, no data collection.
