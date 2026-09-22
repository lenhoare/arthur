import { CaptureUpdateAction } from "../store";
import { newElementWith } from "../element/mutateElement";
import { newEmbeddableElement } from "../element/newElement";
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
} from "../element/types";
import type { AppClassProperties } from "../types";
import { getComponent } from "./registry";
import "./Flashcard";
import "./Chooser";
import "./FlapChooser";
import "./Markdown";
import "./MultipleChoice";
import "./AppearText";
import "./flashcard.css";
export { getStoredComponent } from "./data";
import { getStoredComponent } from "./data";

export function createComponent(type: string, x: number, y: number) {
  const definition = getComponent(type);
  if (!definition) throw new Error(`Unknown component: ${type}`);
  return newEmbeddableElement({
    type: "embeddable",
    x,
    y,
    ...definition.defaultSize,
    link: null,
    strokeWidth: 1,
    strokeColor: "#474637",
    backgroundColor: definition.defaultBackgroundColor ?? "#f9efcd",
    fillStyle: "solid",
    roughness: 0,
    roundness: null,
    strokeStyle: "solid",
    opacity: 100,
    customData: {
      arthur: {
        type,
        version: definition.version,
        data: definition.initialData(),
      },
    },
  });
}

export function ComponentHost({
  element,
  app,
  interactive,
  editing,
  finishEditing,
}: {
  element: ExcalidrawEmbeddableElement;
  app: AppClassProperties;
  interactive: boolean;
  editing: boolean;
  finishEditing: () => void;
}) {
  const stored = getStoredComponent(element);
  const definition = stored && getComponent(stored.type);
  if (
    !stored ||
    !definition ||
    stored.version !== definition.version ||
    !definition.isData(stored.data)
  ) {
    return (
      <div className="unknown-component">
        Unavailable component: {stored?.type ?? "unknown"}
        <small>Its saved data is preserved.</small>
      </div>
    );
  }
  const View = definition.View;
  return (
    <div className="component-host" data-component-id={element.id}>
      <View
        data={stored.data}
        element={element}
        interactive={interactive}
        editing={editing}
        finishEditing={finishEditing}
        updateData={(data) => {
          app.syncActionResult({
            elements: app.scene
              .getElementsIncludingDeleted()
              .map((current) =>
                current.id === element.id
                  ? newElementWith(current, {
                      customData: {
                        ...current.customData,
                        arthur: { ...stored, data },
                      },
                    })
                  : current,
              ),
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
        }}
      />
    </div>
  );
}
