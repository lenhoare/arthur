# Interactive Excalidraw Components — Draft Specification

## 1. Goal

Build a generic component layer on top of Excalidraw that allows interactive, stateful, programmable objects to live naturally on an Excalidraw canvas.

Examples include:

- flashcards
- timers and stopwatches
- random wheels
- dice and coin tosses
- before/after images
- charts
- counters and scoreboards
- navigation/jump controls
- HTTP/webhook actions
- AI/query components
- MCP-driven canvas actions
- arbitrary future interactive teaching or presentation components

The system should use stock Excalidraw wherever possible rather than maintaining a fork.

The first implementation experiment will be a flashcard, but the architecture must not be flashcard-specific.

---

# 2. Core Architectural Idea

Use Excalidraw's existing `embeddable` element as the geometric/container object.

Excalidraw remains responsible for:

- canvas coordinates
- element selection
- dragging
- resizing
- rotation
- zoom
- pan
- duplication
- deletion
- grouping where supported
- scene persistence
- collaboration mechanics where possible

The component system is responsible for:

- interpreting the embeddable as a custom component
- rendering its React contents
- storing and updating component-specific state
- exposing actions/events
- external I/O
- static export/snapshot rendering

Conceptually:

```text
Excalidraw Scene

┌─────────────────────────────────────────────┐
│                                             │
│   normal shapes                            │
│                                             │
│        ┌─────────────────────┐              │
│        │ Excalidraw embed    │              │
│        │                     │              │
│        │  <Flashcard />      │              │
│        │                     │              │
│        └─────────────────────┘              │
│                                             │
└─────────────────────────────────────────────┘
```

The host application provides the component renderer through Excalidraw's `renderEmbeddable` hook.

---

# 3. Design Principles

## 3.1 Components are plugins

The Excalidraw integration must know as little as possible about individual component types.

Adding a new component should ideally require only:

```ts
registerComponent(MyComponentDefinition)
```

rather than changes to the central renderer.

## 3.2 Geometry belongs to Excalidraw

Do not create a parallel coordinate system unless unavoidable.

The Excalidraw embeddable's geometry is authoritative:

```text
x
y
width
height
angle
```

## 3.3 Behaviour belongs to the component system

Interactive state and business logic should live outside Excalidraw's core element implementation.

## 3.4 Documents remain portable

An Excalidraw document containing custom components should still be structurally valid Excalidraw data.

Vanilla Excalidraw may not understand the interactive behaviour, but it should not corrupt the scene.

## 3.5 No Excalidraw fork unless necessary

Prefer public APIs and documented hooks.

A fork should only be considered if a critical capability proves impossible through supported extension points.

---

# 4. Component Identity

Custom components will initially use Excalidraw `embeddable` elements.

A component is identified using a reserved URI scheme.

Example:

```text
xcomp://flashcard/01JXYZ...
```

Other examples:

```text
xcomp://timer/01JABC...
xcomp://wheel/01JDEF...
xcomp://chart/01JGHI...
xcomp://query/01JKLM...
```

The URI contains:

```text
scheme      xcomp
type        flashcard
instanceId  01JXYZ...
```

The URI is an identifier, not the primary storage location for arbitrary component data.

---

# 5. Generic Component Contract

Initial TypeScript shape:

```ts
export interface CanvasComponentDefinition<
  TData = unknown,
  TState = unknown
> {
  type: string

  version: number

  displayName: string

  defaultSize: {
    width: number
    height: number
  }

  createInitialData(): TData

  createInitialState?(data: TData): TState

  render(props: CanvasComponentRenderProps<TData, TState>): React.ReactNode

  snapshot?(
    props: CanvasComponentSnapshotProps<TData, TState>
  ): React.ReactNode

  migrate?(
    storedVersion: number,
    data: unknown
  ): TData

  actions?: Record<string, CanvasComponentAction>

  events?: string[]
}
```

---

# 6. Render Contract

```ts
export interface CanvasComponentRenderProps<
  TData,
  TState
> {
  instanceId: string

  elementId: string

  data: TData

  state: TState

  width: number

  height: number

  selected: boolean

  active: boolean

  readonly: boolean

  updateData(
    patch: Partial<TData> | ((data: TData) => TData)
  ): void

  updateState(
    patch: Partial<TState> | ((state: TState) => TState)
  ): void

  emit(
    event: string,
    payload?: unknown
  ): void

  runAction(
    action: CanvasAction
  ): Promise<unknown>
}
```

This is deliberately richer than required for the first test.

The flashcard should exercise only a small subset.

---

# 7. Data vs State

A distinction should be maintained between persistent component data and runtime state.

## Data

Data describes the component itself and should normally persist with the document.

Example flashcard data:

```ts
interface FlashcardData {
  front: string
  back: string
}
```

Example chart data:

```ts
interface ChartData {
  chartType: "bar" | "line" | "pie"
  source: DataSource
  config: ChartConfig
}
```

## State

State describes current interactive/runtime condition.

Example flashcard state:

```ts
interface FlashcardState {
  side: "front" | "back"
}
```

Example timer state:

```ts
interface TimerState {
  running: boolean
  startedAt?: number
  accumulatedMs: number
}
```

Whether state persists should be configurable.

Some state is ephemeral:

```text
hovered
currentlyAnimating
dragging
```

Some may be document state:

```text
flashcard currently showing back
score = 7
question already answered
```

---

# 8. Persistence

The first prototype should use a simple external component store keyed by `instanceId`.

Conceptually:

```ts
interface StoredComponent {
  id: string
  type: string
  version: number
  data: unknown
  persistentState?: unknown
}
```

Example:

```json
{
  "id": "01JXYZ",
  "type": "flashcard",
  "version": 1,
  "data": {
    "front": "el perro",
    "back": "the dog"
  },
  "persistentState": {
    "side": "front"
  }
}
```

Long term, investigate three storage strategies:

1. application-level sidecar data
2. Excalidraw element `customData`
3. compact component data encoded directly in the scene

Preferred long-term design should minimise the possibility of scene/component state becoming separated.

---

# 9. Registry

A central registry resolves component type to implementation.

```ts
class ComponentRegistry {
  register(definition: CanvasComponentDefinition): void

  get(type: string): CanvasComponentDefinition | undefined

  list(): CanvasComponentDefinition[]
}
```

Usage:

```ts
registry.register(FlashcardComponent)
registry.register(TimerComponent)
registry.register(WheelComponent)
```

The Excalidraw integration should never contain:

```ts
switch (type) {
  case "flashcard":
  case "timer":
  case "wheel":
}
```

That logic belongs in the registry.

---

# 10. Component Creation

The generic API should eventually allow:

```ts
createComponent("flashcard", {
  front: "bonjour",
  back: "hello"
})
```

Internally this:

1. looks up the registered component
2. generates an instance ID
3. creates initial data
4. stores component data
5. creates an Excalidraw embeddable
6. assigns:

```text
xcomp://flashcard/<instanceId>
```

7. uses the component's default dimensions

---

# 11. Rendering

The host application provides:

```tsx
<Excalidraw
  renderEmbeddable={renderCustomEmbeddable}
/>
```

Pseudo-code:

```ts
function renderCustomEmbeddable(element) {
  const ref = parseXComponentUri(element.link)

  if (!ref) {
    return null
  }

  const definition = registry.get(ref.type)

  if (!definition) {
    return <UnknownComponent />
  }

  const instance = store.get(ref.instanceId)

  return (
    <CanvasComponentHost
      definition={definition}
      instance={instance}
      element={element}
    />
  )
}
```

---

# 12. Events

Components should be capable of emitting semantic events.

Examples:

```text
click
flip
complete
timeout
change
submit
correct
incorrect
result
```

Example:

```ts
emit("flip", {
  side: "back"
})
```

Events may eventually trigger one or more actions.

---

# 13. Generic Action System

Actions should be independent of components.

Initial contract:

```ts
export type CanvasAction =
  | NavigateAction
  | ComponentAction
  | SceneAction
  | VariableAction
  | HttpAction
  | QueryAction
```

Example:

```ts
{
  type: "navigate",
  target: {
    elementId: "abc123"
  }
}
```

or:

```ts
{
  type: "component.call",
  target: "timer-1",
  method: "start"
}
```

---

# 14. Navigation Actions

Potential actions:

```text
navigate.toElement
navigate.toCoordinates
navigate.home
navigate.back
navigate.next
navigate.previous
```

Example:

```ts
{
  type: "navigate.toElement",
  elementId: "question-4",
  zoom: "fit",
  animate: true
}
```

This provides the basis for:

- jump links
- presentations
- guided lessons
- interactive diagrams
- board navigation

---

# 15. Scene Actions

AI and programmable components will eventually need a safe canvas API.

Potential operations:

```text
scene.addElement
scene.updateElement
scene.deleteElement
scene.moveElement
scene.groupElements
scene.selectElements
scene.zoomTo
scene.createComponent
```

Do not expose arbitrary Excalidraw internals directly to components.

Provide a stable abstraction.

---

# 16. Variable System

A small shared variable system would enable significant interaction without code.

Example variables:

```text
score = 7
currentQuestion = 3
studentName = "Ana"
showAnswers = false
```

Potential API:

```ts
getVariable("score")

setVariable("score", 8)

incrementVariable("score", 1)
```

Variables can later drive component properties.

Example:

```text
Text:
"Score: {{score}}"
```

---

# 17. Randomness

Provide randomness centrally rather than each component implementing it separately.

Possible API:

```ts
random.integer(min, max)
random.choice(items)
random.shuffle(items)
random.boolean()
```

Consumers:

- dice
- coin
- wheel
- random card
- random student
- question selector

Optional future feature:

```text
seeded randomness
```

This would make collaborative sessions deterministic.

---

# 18. External I/O

Components may need to access external services.

Do not let arbitrary components make unrestricted requests directly.

Provide an abstraction:

```ts
http.request(...)
```

Potential uses:

- webhook
- live data
- API query
- polling
- form submission

Security controls will eventually be required for:

- allowed origins
- credentials
- secrets
- rate limiting
- user confirmation

---

# 19. AI / Query Components

A generic query component should eventually support something similar to:

```ts
interface QueryComponentData {
  prompt: string
  provider?: string
  model?: string
  outputMode:
    | "text"
    | "component"
    | "canvas-actions"
}
```

Potential flow:

```text
Query Component
       ↓
AI Provider
       ↓
optional tools/MCP
       ↓
structured result
       ↓
Canvas Action API
       ↓
Excalidraw scene changes
```

Example instruction:

```text
Turn the notes inside this frame into
a five-event horizontal timeline.
```

The model should return structured canvas operations rather than uncontrolled JavaScript.

---

# 20. MCP Integration

Long term, the component system could expose the current canvas as an MCP server.

Potential tools:

```text
canvas.get_scene
canvas.get_selection
canvas.add_text
canvas.add_shape
canvas.add_arrow
canvas.create_component
canvas.update_component
canvas.delete_element
canvas.navigate
```

This allows external AI agents to treat the canvas as an editable environment.

---

# 21. Component Security

Components should not be assumed trustworthy.

Potential future permissions:

```text
network
clipboard
microphone
camera
AI
MCP
local storage
external navigation
```

A component manifest may eventually declare:

```ts
permissions: [
  "network",
  "clipboard"
]
```

Arbitrary JavaScript execution should not be part of the initial design.

---

# 22. Static Export

Interactive objects cannot retain full behaviour in:

- PNG
- SVG
- PDF
- printed output

Every component should eventually support a static representation.

For example:

```ts
snapshot(props)
```

A timer might export:

```text
03:42
```

A flashcard might export whichever side is currently visible.

A wheel could export the wheel at its current rotation.

A query button could export its label.

Fallback if `snapshot()` is absent:

```text
generic component placeholder
```

---

# 23. Unknown Components

Documents must degrade gracefully when a component implementation is unavailable.

Display:

```text
┌─────────────────────────┐
│ Unknown component       │
│                         │
│ type: foo               │
│ id: 01JXYZ              │
└─────────────────────────┘
```

Do not discard its stored data.

This permits future plugins and component sharing.

---

# 24. Versioning and Migration

Every component definition has a schema version.

Example:

```ts
version: 3
```

Stored component:

```json
{
  "type": "flashcard",
  "version": 1
}
```

The component can provide:

```ts
migrate(oldVersion, data)
```

Migration should happen before rendering.

This prevents old boards becoming unusable after component evolution.

---

# 25. Initial Built-in Component Candidates

## Phase 1

- Flashcard
- Reveal
- Timer
- Jump link
- Counter

## Phase 2

- Dice
- Coin
- Random wheel
- Before/after image
- Scoreboard
- Multiple choice

## Phase 3

- Chart
- Table
- HTTP/webhook
- Query/AI
- live API data

## Phase 4

- MCP actions
- arbitrary component plugin packages
- collaboration-aware state
- component marketplace/library

---

# 26. First Experiment — Flashcard

The first experiment exists to validate the generic architecture, not merely to build a flashcard.

## Component definition

```ts
interface FlashcardData {
  front: string
  back: string
}

interface FlashcardState {
  side: "front" | "back"
}
```

Registered as:

```ts
registerComponent({
  type: "flashcard",
  version: 1,
  displayName: "Flashcard",

  defaultSize: {
    width: 320,
    height: 200
  },

  createInitialData() {
    return {
      front: "bonjour",
      back: "hello"
    }
  },

  render: Flashcard
})
```

---

# 27. Flashcard Acceptance Tests

The prototype is successful if a flashcard can:

1. be created from a toolbar/control
2. exist as an Excalidraw element
3. render through the generic registry
4. show front text
5. flip when clicked
6. animate the flip smoothly
7. show back text
8. be dragged normally
9. be resized normally
10. survive zoom and pan correctly
11. survive duplication
12. survive deletion
13. save successfully
14. reload successfully
15. retain its data after reload
16. retain or intentionally reset its side according to persistence policy
17. not require modification of Excalidraw source code

Stretch tests:

18. rotation
19. copy/paste
20. undo/redo
21. group with ordinary Excalidraw elements
22. export static image
23. collaboration between two browser sessions

---

# 28. Questions the Flashcard Experiment Must Answer

The prototype should explicitly investigate:

- Does `renderEmbeddable` receive pointer events reliably?
- Does Excalidraw require an embed to be activated before clicks reach it?
- Can click-to-flip coexist naturally with selection?
- How does resizing affect the React renderer?
- Does rotation work correctly?
- Does duplication preserve or duplicate the component instance ID?
- Does copy/paste require generating a new instance ID?
- How does undo/redo interact with component state?
- Where should persistent component data live?
- Can component data live safely in element `customData`?
- How should ephemeral state be handled?
- Can static export use the same renderer?
- What happens when vanilla Excalidraw opens the document?

These questions matter more than visual polish.

---

# 29. First Implementation Milestone

A minimal repository should contain:

```text
src/
  excalidraw/
    ComponentHost.tsx
    componentUri.ts
    createComponent.ts

  components/
    registry.ts
    types.ts

    flashcard/
      definition.ts
      Flashcard.tsx
      types.ts

  store/
    componentStore.ts

  App.tsx
```

No action system, MCP, AI integration, charts or networking need to be implemented initially.

However, the types and architecture should leave clean extension points for them.

---

# 30. Success Criterion

The project is viable if the first experiment demonstrates that:

> An arbitrary React component can behave as a natural Excalidraw canvas object while remaining implemented entirely outside Excalidraw itself.

If this works cleanly, subsequent widgets should be ordinary plugins rather than further Excalidraw integration work.

The flashcard is therefore not the product.

It is the architectural test.
