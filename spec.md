# Arthur — first working slice

A teacher-operated whiteboard for lessons, also usable individually for revision.
One person operates a board at a time. Arthur is a version of Excalidraw extended
with interactive objects. Native integration takes priority over avoiding a fork.
Changes are made incrementally in a pinned copy of Excalidraw's source.

## Flashcard

- Landscape 6 × 4 proportions, initially 360 × 240 pixels, with pastel paper.
- Subtle ruled lines spaced 20 pixels apart at the default size, starting below
  a two-line (40 pixel) top margin. No question/answer labels.
- Plain text on both sides; front text slightly larger and bold.
- Edit mode: ordinary selection, dragging, resizing, rotation and grouping.
- Double-click to edit visible text directly. Clicking away or Ctrl/Cmd+Enter
  commits; Escape cancels. A bottom-right flip control gives access to both sides.
- Interact mode: board geometry is locked; clicking a card flips it.
- Add Flashcard and labelled Edit / Interact controls to the existing toolbar.
  Keep the original drawing-tool lock and its keyboard shortcut.
- The existing background, stroke, fill, roughness, edge and opacity controls
  operate on the card itself. Both faces use the element's native shape styles.
  No separate painted rectangle remains behind a card during its flip.
- New cards use the same dimensions. Resizing remains native Excalidraw behaviour.

## Student chooser

- Native toolbar button adds a 400 × 400 wheel with equal segments per name.
- Double-click in Edit mode for a plain text list, one name per line. Blank lines
  are ignored; Ctrl/Cmd+Enter or blur saves, Escape cancels.
- Click/tap or Enter/Space in Interact mode spins the wheel with momentum and
  constant deceleration. The fixed top pointer identifies the winning segment.
- Each list entry has equal probability; names remain available for repeat draws.
- Show the chosen name across the wheel for two seconds, using the winning slice
  colour as its background, then hide the label.
- In Edit mode, press the centre circle to preview a spin without a result label.
  Double-click elsewhere on the wheel to edit names.
- Ignore further spin requests while moving. Changing mode or editing names cancels motion.
- Names use native saving, loading and undo. Spin position/results are temporary.
- Native background colour tints the segments; stroke colour/width style the wheel.

## Document behaviour

- Content edits, creation, duplication, deletion and geometry changes support undo/redo.
- Copies are independent, including clipboard copies.
- Flipping is temporary and does not add undo steps. Reopened boards show fronts.
- Autosave locally. Excalidraw's original Save/Open actions and `.excalidraw`
  format save and load cards; there are no parallel file operations.
- Component data stays inside each element's `customData`; element IDs identify instances.
- A small registry connects component types to renderers. No separate component database.
- Unknown component data is retained and shown as a placeholder.

## Boundaries

This slice establishes the native toolbar, document and styling integration.
It does not include
collaboration, rich text, images in cards, AI, networking, actions or third-party code.
Static image export of card contents is deferred; native Excalidraw export may show
embed placeholders. The interactive document is the supported sharing format.

## Evidence required

Browser checks for both sides, editing, mode switching, undo/redo, independent
duplicates and clipboard copies, deletion/restoration, dragging, resizing, zoom,
rotation, native palette changes and undo, native menu saving/reopening, and
migration of early prototype documents. Visual review of the actual rendered card.
