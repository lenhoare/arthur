# Arthur — Excalidraw with interactive objects

Arthur extends a pinned copy of Excalidraw 0.18.1. The editor source is in
[`vendor/excalidraw`](vendor/excalidraw); Vite and TypeScript resolve directly to
that source. The published Excalidraw package is not used at runtime.

The current scope is in [spec.md](spec.md). The original draft is retained as background.

## Run

```sh
npm install
npm run dev
```

`npm run build` type-checks the application and imported editor source, then builds
`dist/`. Node 22+ is recommended for the Vite toolchain.

## Use

- **Flashcard:** the card icon in Excalidraw's existing toolbar adds a card.
- **Edit / Interact:** the labelled toolbar control switches between editing
  and using the board. Alt+R uses the same native mode action. The original
  unlabelled padlock still keeps a drawing tool active (Q).
- Double-click a card to edit the visible side. Click away or Ctrl/Cmd+Enter
  to finish; Escape cancels. The bottom-right arrow flips either side.
- Select a card and use the normal properties panel to change background,
  stroke colour, fill, stroke width/style, roughness, edges and opacity.
- Use the original menu: **Save to… → Save to file**, and **Open**.
  Excalidraw's file handling, shortcuts, overwrite confirmation and file handles
  are retained. Both sides and native styles travel in the `.excalidraw` file.
- Boards also autosave on the current device. Reopened cards show their fronts.

## Source layout

- `vendor/excalidraw/packages/excalidraw/components/InteractiveTools.tsx`: native
  toolbar additions using Excalidraw's ToolButton and existing view-mode action.
- `vendor/excalidraw/packages/excalidraw/interactive/`: registry, component data,
  creation and flashcard rendering.
- `components/App.tsx` in the editor: component rendering and direct editing
  through native hit testing, without a surrounding DOM event interceptor.
- `renderer/renderElement.ts` and `scene/Shape.ts`: live components render their
  native RoughJS shape on each animated face. The static canvas does not paint
  a second rectangle behind them.
- `data/restore.ts`: temporary interaction state resets on document load; early
  prototype URLs migrate away while preserving content and chosen colours.
- `src/App.tsx`: bootstrap and browser autosave only. No custom menus, file
  implementation, canvas renderer or editing behaviour lives here.

Components currently reuse the embeddable geometry type with data stored in
`customData.arthur`. They are recognised directly by the editor, without a fake
URL or iframe validation override. Native element IDs keep copies independent.
Content changes use the editor's action/history machinery. Face flips are transient.

## Maintaining the fork

[`UPSTREAM.json`](vendor/excalidraw/UPSTREAM.json) records the source tag, archive
checksum and modified upstream files. [`FORK.md`](vendor/excalidraw/FORK.md)
explains the integration and compatibility changes. The upstream MIT licence and
source tests are retained. No generated or installed dependency files are patched.

## Checks

With the dev server running at `127.0.0.1:5173`, run `npm test`. Playwright uses
Chrome at `/usr/bin/google-chrome` (adjust `playwright.config.ts` if necessary).
Tests exercise native gestures, clipboard, undo, styles, touch and the actual
native menu file flow. The file test uses Excalidraw's browser download/input
fallback because OS file picker dialogs cannot be driven through the DOM.

## Remaining work

- PNG/SVG exports still use Excalidraw's embed fallback rather than the full card
  content. The interactive `.excalidraw` document is the supported sharing format.
- DOM components still inherit embeddable layering and frame-clipping limitations;
  arbitrary drawing/component interleaving needs its own native rendering work.
- Text font/layout controls, static exports and other component types are future
  incremental steps. Long card text currently scrolls; A6 is the initial proportion.
- Single-user operation; no cloud storage or collaboration.
