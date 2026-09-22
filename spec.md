# Arthur — first working slice

A teacher-operated whiteboard for lessons, also usable individually for revision.
One person operates a board at a time. Arthur is a version of Excalidraw extended
with interactive objects. Native integration takes priority over avoiding a fork.
Changes are made incrementally in a pinned copy of Excalidraw's source.

## Flashcard

- Landscape 6 × 4 proportions, initially 360 × 240 pixels.
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

## Markdown lessons

- Native document toolbar button adds a 640 × 520 lesson panel.
- Double-click for MDXEditor visual editing: headings, emphasis, lists, quotes,
  links, tables and fenced code blocks, plus a Markdown source view.
- Whole-lesson baseline size menu: Tiny, Small, Medium and Large. At the default
  width these are 12, 16, 20 and 26 pixels; all scale with the component width.
  Older documents default to Medium. Size changes preview while editing and
  participate in the same save/cancel/undo flow as text.
- Displayed fenced code retains syntax highlighting. Stroke colour affects
  ordinary text and unhighlighted code, leaving syntax token colours intact.
- Keep the heading menu at 65% of its original width and Markdown editing controls; omit the Rich text mode
  button. Tables omit the tool-only header row and row-menu column, retaining
  compact add-row and add-column controls.
- Done, Ctrl/Cmd+Enter or clicking outside commits one native content undo step.
  Cancel or Escape discards the session; typing uses the editor’s own undo.
- Interact mode displays formatted Markdown, with scrolling and links.
- Markdown text is stored in customData and uses native Save/Open, duplication
  and undo. Background and border use the native element’s shape styles.
- Code is displayed, not executed. JSX/MDX component execution is not enabled.

## Multiple-choice questions

- Native checklist toolbar button adds a 520 × 400 question panel.
- Double-click to edit plain question/choice text and select one correct answer.
  Start with four choices; allow adding/removing choices (2–26).
- Done, Ctrl/Cmd+Enter or clicking outside saves; Cancel or Escape discards edits.
- Interact mode: click/tap or Enter/Space toggles the answer reveal.
- Edit mode: a bottom-right eye control toggles the reveal without moving the object.
- Reveal highlights the correct option with a tick; no individual student scoring.
- Content and the correct answer use native Save/Open, duplication and undo.
  Reveal is temporary, adds no undo steps and resets on document load/content changes.
- Native background, stroke and opacity controls style the panel.

## Appear text

- Native toolbar button adds a 360 × 180 plain text block using the current background colour.
- Starts faint (15% opacity) with strongly blurred, unreadable text, like frosted glass.
  Clicking in Interact mode restores clear text at full visibility.
  Enter/Space also toggles; Edit mode has a bottom-right eye control.
- Double-click to edit at full opacity. Click away or Ctrl/Cmd+Enter saves;
  Escape cancels. The corner control can save and reveal the edited text.
- Uses native shape colours/styles, resizing, saving, duplication and undo.
- Visibility is temporary, adds no undo steps and resets to faint on reopening.

## Split-flap chooser

- Separate native toolbar component, 480 × 56 pixels, black casing and white letters.
- Double-click to edit people/things, one per line; ignore blank lines.
- Interact click/tap or Enter/Space starts an equal-probability random draw.
  An Edit-mode corner control previews the same animation.
- Flaps cycle with slowing intervals and mechanical clicking sounds, then settle left to right. Keep the chosen
  entry visible on the board without a popup until the next draw or mode change.
- Display uppercase, retaining the original entry text in saved data and announcements.
  Size the row for the longest entry; retain spaces and accented letters.
- Ignore repeat taps during a draw; cancel animation on mode/content changes.
  Reduced-motion mode reveals letters sequentially without flap motion or scrambling.
- Native Save/Open, autosave and undo preserve the list; the draw is temporary.

## Document behaviour

- New objects inherit the editor’s current shape background colour, or transparent
  when none is selected. Existing objects retain their saved colours. The split-flap
  face keeps its black-and-white design.

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
collaboration, images in cards, AI, networking, actions or executable third-party code.
Static image export of interactive component contents is deferred; native Excalidraw export may show
embed placeholders. The interactive document is the supported sharing format.

## Evidence required

Browser checks for both sides, editing, mode switching, undo/redo, independent
duplicates and clipboard copies, deletion/restoration, dragging, resizing, zoom,
rotation, native palette changes and undo, native menu saving/reopening, and
migration of early prototype documents. Visual review of the actual rendered card.
