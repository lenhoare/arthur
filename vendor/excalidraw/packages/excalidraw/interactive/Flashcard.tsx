import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RoughSVG } from "roughjs/bin/svg";
import { ShapeCache } from "../scene/ShapeCache";
import { registerComponent, type ComponentProps } from "./registry";

interface FlashcardData {
  front: string;
  back: string;
}
type Side = keyof FlashcardData;

function Flashcard({
  data,
  element,
  interactive,
  editing,
  updateData,
  finishEditing,
}: ComponentProps<FlashcardData>) {
  const [side, setSide] = useState<Side>("front");
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const cancelled = useRef(false);
  const frontPaper = useRef<SVGSVGElement>(null);
  const backPaper = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const shape = ShapeCache.generateElementShape(element, null);
    for (const paper of [frontPaper.current, backPaper.current]) {
      if (paper && shape)
        paper.replaceChildren(new RoughSVG(paper).draw(shape));
    }
  }, [element.version, element.versionNonce]);

  useEffect(() => {
    if (editing) {
      cancelled.current = false;
      setDraft(data[side]);
      const frame = requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [editing]);

  function commit() {
    if (!cancelled.current && draft !== data[side])
      updateData({ ...data, [side]: draft });
    finishEditing();
  }

  function flip() {
    if (editing) commit();
    setSide(side === "front" ? "back" : "front");
  }

  return (
    <div
      className={`flashcard ${interactive ? "is-interactive" : ""} ${
        editing ? "is-editing" : ""
      }`}
      data-side={side}
      style={{ color: element.strokeColor }}
      role={interactive ? "button" : "group"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={
        interactive
          ? `Flashcard ${side}: ${data[side]}. Flip card`
          : `Flashcard ${side}`
      }
      onClick={interactive ? flip : undefined}
      onPointerDown={
        interactive || editing ? (event) => event.stopPropagation() : undefined
      }
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          flip();
        }
      }}
    >
      <div className="flashcard-turn">
        {(["front", "back"] as const).map((face) => (
          <div
            className={`card-face card-${face}`}
            key={face}
            aria-hidden={face !== side}
          >
            <svg
              ref={face === "front" ? frontPaper : backPaper}
              className="card-paper"
              viewBox={`0 0 ${element.width} ${element.height}`}
              aria-hidden="true"
            />
            <div className="card-ruling" aria-hidden="true" />
            <div className="card-text-area">
              {editing && side === face ? (
                <textarea
                  ref={input}
                  aria-label={`Edit ${face} text`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commit}
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelled.current = true;
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
                <p className={!data[face] ? "empty-text" : ""}>
                  {data[face] ||
                    (interactive
                      ? " "
                      : `Double-click to add ${
                          face === "front" ? "a question" : "an answer"
                        }`)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        className="card-flip"
        aria-label={`Flip to ${side === "front" ? "back" : "front"}`}
        title="Flip card"
        tabIndex={interactive ? -1 : 0}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
        }}
        onClick={(event) => {
          event.stopPropagation();
          flip();
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path
            d="M18 8a7 7 0 1 0 1 7M18 3v5h-5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

registerComponent<FlashcardData>({
  type: "flashcard",
  version: 1,
  defaultSize: { width: 360, height: 240 },
  initialData: () => ({ front: "bonjour", back: "hello" }),
  isData: (value): value is FlashcardData =>
    !!value &&
    typeof value === "object" &&
    "front" in value &&
    typeof value.front === "string" &&
    "back" in value &&
    typeof value.back === "string",
  View: Flashcard,
});
