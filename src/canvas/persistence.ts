import { serializeAsJSON } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

const STORAGE_KEY = "arthur.board.v1";

export function loadLocalBoard(): {
  board?: ExcalidrawInitialDataState;
  error?: string;
} {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};
    const board = JSON.parse(saved);
    if (!Array.isArray(board.elements)) throw new Error("Invalid saved board");
    return { board };
  } catch {
    return {
      error:
        "The saved board could not be read. Open a saved file to recover it.",
    };
  }
}

export function saveLocalBoard(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) {
  const serialized = JSON.parse(
    serializeAsJSON(elements, appState, files, "local"),
  );
  serialized.appState = {
    ...serialized.appState,
    scrollX: appState.scrollX,
    scrollY: appState.scrollY,
    zoom: appState.zoom,
    viewModeEnabled: false,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
}
