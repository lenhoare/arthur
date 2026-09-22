// Relative to the component width; Medium preserves existing documents.
export const markdownSizes = {
  tiny: "1.875cqw",
  small: "2.5cqw",
  medium: "3.125cqw",
  large: "4.0625cqw",
} as const;
export type MarkdownSize = keyof typeof markdownSizes;
