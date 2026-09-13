import type { ExcalidrawElement } from "../element/types";

export interface StoredComponent {
  type: string;
  version: number;
  data: unknown;
}

// Data-only recognition is shared by restore, the canvas renderer and the UI.
// A component is part of the scene; it no longer needs a pretend web address.
export function getStoredComponent(
  element: ExcalidrawElement,
): StoredComponent | undefined {
  const stored = element.customData?.arthur;
  if (
    element.type !== "embeddable" ||
    !stored ||
    typeof stored.type !== "string"
  )
    return;
  return stored;
}
