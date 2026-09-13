import type { ComponentType } from "react";
import type { ExcalidrawEmbeddableElement } from "../element/types";

export interface ComponentProps<T> {
  data: T;
  element: ExcalidrawEmbeddableElement;
  interactive: boolean;
  editing: boolean;
  updateData: (data: T) => void;
  finishEditing: () => void;
}

interface ComponentDefinition<T> {
  type: string;
  version: number;
  defaultSize: { width: number; height: number };
  initialData: () => T;
  isData: (value: unknown) => value is T;
  View: ComponentType<ComponentProps<T>>;
}

// Type erasure happens once at registration; stored data is validated at render.
const definitions = new Map<string, ComponentDefinition<unknown>>();

export function registerComponent<T>(definition: ComponentDefinition<T>) {
  if (definitions.has(definition.type))
    throw new Error(`Duplicate component: ${definition.type}`);
  definitions.set(definition.type, definition as ComponentDefinition<unknown>);
}

export function getComponent(type: string) {
  return definitions.get(type);
}
