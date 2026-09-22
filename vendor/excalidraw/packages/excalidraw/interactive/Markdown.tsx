import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { markdownSizes, type MarkdownSize } from "./markdownSizes";
import { RoughSVG } from "roughjs/bin/svg";
import { ShapeCache } from "../scene/ShapeCache";
import { registerComponent, type ComponentProps } from "./registry";
import "./markdown.css";

const MarkdownEditor = lazy(() => import("./MarkdownEditor"));
interface MarkdownData {
  markdown: string;
  fontSize?: MarkdownSize;
}

function Markdown({
  data,
  element,
  interactive,
  editing,
  updateData,
  finishEditing,
}: ComponentProps<MarkdownData>) {
  const paper = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const shape = ShapeCache.generateElementShape(element, null);
    if (paper.current && shape)
      paper.current.replaceChildren(new RoughSVG(paper.current).draw(shape));
  }, [element.version, element.versionNonce]);
  return (
    <div
      className={`markdown-panel ${interactive || editing ? "is-active" : ""}`}
      style={
        {
          color: element.strokeColor,
          "--markdown-font-size": markdownSizes[data.fontSize ?? "medium"],
        } as CSSProperties
      }
      role="group"
      aria-label="Markdown lesson"
      onPointerDown={
        interactive || editing ? (event) => event.stopPropagation() : undefined
      }
      onDoubleClick={editing ? (event) => event.stopPropagation() : undefined}
      onKeyDown={editing ? (event) => event.stopPropagation() : undefined}
    >
      <svg
        ref={paper}
        className="markdown-paper"
        viewBox={`0 0 ${element.width} ${element.height}`}
        aria-hidden="true"
      />
      {editing ? (
        <Suspense
          fallback={<div className="markdown-content">Loading editor…</div>}
        >
          <MarkdownEditor
            markdown={data.markdown}
            fontSize={data.fontSize ?? "medium"}
            onCommit={(markdown, fontSize) =>
              updateData({ ...data, markdown, fontSize })
            }
            finishEditing={finishEditing}
          />
        </Suspense>
      ) : (
        <div
          className="markdown-content markdown-reading"
          onWheel={
            interactive
              ? (event) => {
                  if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
                }
              : undefined
          }
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            skipHtml
            components={{
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              ),
            }}
          >
            {data.markdown || "*Double-click to write a lesson.*"}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

registerComponent<MarkdownData>({
  type: "markdown",
  version: 1,
  defaultSize: { width: 640, height: 520 },
  defaultBackgroundColor: "#ffffff",
  initialData: () => ({
    markdown:
      '# Lesson notes\n\nDouble-click to edit this lesson.\n\n## Key ideas\n\n- Explain the concept\n- Work through an example\n\n| Term | Meaning |\n| --- | --- |\n| Example | Add your explanation |\n\n```python\nprint("Hello, class!")\n```',
  }),
  isData: (value): value is MarkdownData =>
    !!value &&
    typeof value === "object" &&
    "markdown" in value &&
    typeof value.markdown === "string" &&
    (!("fontSize" in value) ||
      (typeof value.fontSize === "string" &&
        Object.hasOwn(markdownSizes, value.fontSize))),
  View: Markdown,
});
