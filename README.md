# ColumnGrab

<img src="public/icons/icon128.png" width="64" align="right" alt="">

Copy an HTML table column to your clipboard, one value per line, or a block of columns as tab-separated rows.

- **Drag:** hold **Alt** (⌥ Option on Mac) and drag down a column. Release to copy. **Esc** cancels.
- **Several columns:** while dragging, move sideways past the middle of a neighbouring column to widen the selection; move back to narrow it.
- **Right-click:** right-click a cell → **ColumnGrab → Copy this table column** (with or without header), or **Copy this whole table**.

Handles `rowspan`/`colspan`, iframes, and long tables (auto-scrolls while dragging). The drag key can be changed to Alt+Shift or Ctrl+Alt from the settings popup (click the toolbar icon).

## Development

Requires Node 22.18+ (build scripts are TypeScript run directly by Node).

```bash
npm install
npm run build      # → dist/
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick the `dist/` folder. Open `demo/index.html` to try it. Tabs that were already open need a reload before ColumnGrab works in them.

| Script | What it does |
|---|---|
| `npm run build` | Bundle `src/` with esbuild and copy `public/` into `dist/` |
| `npm run watch` | Rebuild on change (reload the extension in Chrome afterwards) |
| `npm test` | Run unit tests with Vitest (`test:watch` to re-run on change) |
| `npm run typecheck` | Type-check the extension and build scripts |
| `npm run lint` | Lint with oxlint |
| `npm run format` | Format with oxfmt (`format:check` to verify only) |
| `npm run package` | Build and zip `dist/` into `release/columngrab-<version>.zip` for the Web Store |

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org). A `commit-msg` hook (husky + commitlint, installed by `npm install`) rejects messages that don't follow the format:

```
<type>(<optional scope>): <subject>

feat(content): add Esc to cancel a drag
fix: keep header row when copying merged columns
docs: explain the dist/ folder
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Add `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer for breaking changes.

When squash-merging a pull request, GitHub uses the PR title as the commit message, so PR titles should follow the same format.

## Layout

```
src/            TypeScript source
  background.ts   service worker: context menu, clipboard fallback
  content.ts      drag gesture, highlight, toast, right-click handling
  table.ts        rowspan/colspan-aware table grid logic
  offscreen.ts    offscreen document clipboard writer
  options.ts      settings page
  messages.ts     typed messages shared between scripts
  settings.ts     settings schema and storage helpers
public/         manifest, HTML pages and icons, copied as-is into dist/
scripts/        build and package scripts
assets/         icon sources (SVG)
store/          Chrome Web Store listing copy
demo/           test page with sample tables
```

## Privacy

Runs entirely locally. No analytics, no network requests, no data collection.
