import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RoughSVG } from "roughjs/bin/svg";
import { ShapeCache } from "../scene/ShapeCache";
import { registerComponent, type ComponentProps } from "./registry";
import "./appear-text.css";

interface AppearTextData {
  text: string;
}

function AppearText({
  data,
  element,
  interactive,
  editing,
  updateData,
  finishEditing,
}: ComponentProps<AppearTextData>) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const paper = useRef<SVGSVGElement>(null);
  const settled = useRef(false);
  useLayoutEffect(() => {
    const shape = ShapeCache.generateElementShape(element, null);
    if (paper.current && shape)
      paper.current.replaceChildren(new RoughSVG(paper.current).draw(shape));
  }, [element.version, element.versionNonce]);
  useEffect(() => {
    if (editing) {
      settled.current = false;
      setDraft(data.text);
      const frame = requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [editing]);
  function commit() {
    if (settled.current) return;
    settled.current = true;
    if (draft !== data.text) {
      updateData({ text: draft });
      setVisible(false);
    }
    finishEditing();
  }
  function toggle() {
    if (editing) commit();
    setVisible((value) => !value);
  }
  return (
    <div
      className={`appear-text ${interactive || editing ? "is-active" : ""}`}
      data-visible={visible}
      data-editing={editing}
      style={{ color: element.strokeColor }}
      role={interactive ? "button" : "group"}
      aria-label={
        interactive ? (visible ? "Hide text" : "Show text") : "Appear text"
      }
      aria-pressed={interactive ? visible : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? toggle : undefined}
      onPointerDown={
        interactive || editing ? (event) => event.stopPropagation() : undefined
      }
      onDoubleClick={editing ? (event) => event.stopPropagation() : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }
      }}
    >
      <div className="appear-text-surface">
        <svg
          ref={paper}
          className="appear-text-paper"
          viewBox={`0 0 ${element.width} ${element.height}`}
          aria-hidden="true"
        />
        <div className="appear-text-content">
          {editing ? (
            <textarea
              ref={input}
              aria-label="Edit appear text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  event.preventDefault();
                  settled.current = true;
                  finishEditing();
                } else if (
                  event.key === "Enter" &&
                  (event.ctrlKey || event.metaKey)
                ) {
                  event.preventDefault();
                  commit();
                }
              }}
            />
          ) : (
            <p aria-hidden={!visible}>
              {data.text || (interactive ? " " : "Double-click to add text")}
            </p>
          )}
        </div>
      </div>
      {!interactive && (
        <button
          className="appear-text-toggle"
          aria-label={visible ? "Hide text" : "Show text"}
          aria-pressed={visible}
          title={visible ? "Hide text" : "Show text"}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      )}
    </div>
  );
}

registerComponent<AppearTextData>({
  type: "appear-text",
  version: 1,
  defaultSize: { width: 360, height: 180 },
  defaultBackgroundColor: "transparent",
  initialData: () => ({ text: "Click to reveal" }),
  isData: (value): value is AppearTextData =>
    !!value &&
    typeof value === "object" &&
    "text" in value &&
    typeof value.text === "string",
  View: AppearText,
});
