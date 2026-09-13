import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawProps,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { createComponent } from "@excalidraw/excalidraw/interactive/components";
import { loadLocalBoard, saveLocalBoard } from "./canvas/persistence";

const loaded = loadLocalBoard();
const initialData = loaded.board ?? {
  elements: [createComponent("flashcard", 360, 180)],
};

// Bootstrap and device persistence only. Tools, rendering, editing and file
// operations belong to the Excalidraw source tree.
export function App() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const pending = useRef<{
    elements: readonly ExcalidrawElement[];
    state: AppState;
    files: BinaryFiles;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const canAutosave = useRef(!loaded.error);
  const savingError = useRef(false);

  useEffect(() => {
    if (!api) return;
    if (loaded.error) api.setToast({ message: loaded.error, duration: 10000 });
    if (!loaded.board)
      api.scrollToContent(undefined, { fitToContent: true, maxZoom: 1 });
  }, [api]);

  const flushSave = useCallback(() => {
    clearTimeout(timer.current);
    if (!pending.current || !canAutosave.current) return;
    try {
      const { elements, state, files } = pending.current;
      saveLocalBoard(elements, state, files);
      pending.current = null;
      savingError.current = false;
    } catch {
      if (!savingError.current)
        api?.setToast({
          message:
            "Could not autosave. Use Save to disk in the menu to keep your work.",
          duration: 10000,
        });
      savingError.current = true;
    }
  }, [api]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) flushSave();
    };
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flushSave();
      window.removeEventListener("pagehide", flushSave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushSave]);

  const onChange: NonNullable<ExcalidrawProps["onChange"]> = useCallback(
    (elements, state, files) => {
      if (state.fileHandle) canAutosave.current = true;
      pending.current = { elements, state, files };
      clearTimeout(timer.current);
      timer.current = setTimeout(flushSave, 300);
    },
    [flushSave],
  );

  return (
    <div className="arthur-editor">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={onChange}
      />
    </div>
  );
}
