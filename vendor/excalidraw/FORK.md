# Arthur source changes

This directory contains the Excalidraw, math and utils packages from the pinned
upstream archive recorded in `UPSTREAM.json`, including their licences and tests.
The root project builds these source files directly. The upstream package manifests
are preserved for reference; the root manifest declares the runtime dependencies.

## Integration

- `LayerUI.tsx`, `MobileMenu.tsx`, `InteractiveTools.tsx`: add controls inside the
  existing toolbar using native ToolButton components. Keep the toolbar's mode
  control visible in view/interactive mode. Preserve the original tool lock.
  `css/styles.scss` retains the central toolbar grid in interactive mode.
- `actionToggleViewMode.tsx`: reuse the native action and shortcut, clearing
  selection and any active component editor on mode changes.
- `components/App.tsx`: recognise registered scene components without requiring
  an embed URL. Render them directly and route double-clicks using the editor's
  own hit testing. Component event policy is specified here, not overridden by
  CSS selectors or a DOM overlay attached to the toolbar.
- `appState.ts`, `types.ts`: add transient editing/session fields. Neither field
  is saved, exported or shared. A session key resets React interaction state when
  a scene is loaded even if its element IDs are unchanged.
- `data/restore.ts`: reset transient state and migrate the prototype marker URLs.
  A legacy transparent background recovers the pastel that the old renderer
  displayed; explicitly chosen colours are retained. Content is untouched.
- `scene/Shape.ts`: native components honour transparent colours rather than
  getting the missing-iframe fallback fill.
- `renderer/renderElement.ts`: generate the native shape for geometry/cache use,
  but omit a duplicate live canvas rectangle. Each animated face draws that same
  RoughJS shape, including native stroke, fill style, roughness and roundness.
- `interactive/`: small type registry and the flashcard implementation. Component
  content stays with the element. Updates go through `syncActionResult` and native
  undo; file serialization and save/open actions require no custom implementation.

## Build compatibility

The root uses React 18.3, TypeScript 5.6 and Vite 7. Three small source typing fixes
make the pinned editor type-check with this toolchain:

- Remove the redundant image comparison after the `hasStrokeColor` type guard.
- Type the outside-click event target as an HTMLElement, rather than asserting it
  has the same subtype as the referenced container.
- Use the React 18 RefObject form for the TTD output container.

The root resolves browser-fs-access's types explicitly because the upstream
version's exports omit them. Sass is updated within 1.x for Vite compatibility;
dependency overrides select patched Nano ID and lodash-es releases.

## Upgrade procedure

Review the modified files in `UPSTREAM.json` against the next chosen upstream
version. Reapply these changes in source, retain the upstream licence, update the
provenance manifest, and run the build and browser tests. Do not edit node_modules
or generated bundles. The upstream tests are retained but are not included in the
root browser suite; a full upstream test run is a separate verification step.
