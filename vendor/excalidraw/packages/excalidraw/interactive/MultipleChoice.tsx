import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RoughSVG } from "roughjs/bin/svg";
import { ShapeCache } from "../scene/ShapeCache";
import { registerComponent, type ComponentProps } from "./registry";
import "./multiple-choice.css";

interface MultipleChoiceData {
  question: string;
  choices: string[];
  correctIndex: number;
}
const letter = (index: number) => String.fromCharCode(65 + index);

function QuestionEditor({
  data,
  updateData,
  finishEditing,
}: Pick<
  ComponentProps<MultipleChoiceData>,
  "data" | "updateData" | "finishEditing"
>) {
  const [draft, setDraft] = useState(data);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const latest = useRef({ draft, updateData, finishEditing });
  latest.current = { draft, updateData, finishEditing };
  const settled = useRef(false);
  function save() {
    if (settled.current) return;
    settled.current = true;
    if (JSON.stringify(latest.current.draft) !== JSON.stringify(data))
      latest.current.updateData(latest.current.draft);
  }
  function done() {
    save();
    latest.current.finishEditing();
  }
  function cancel() {
    settled.current = true;
    latest.current.finishEditing();
  }
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) done();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      save();
    };
  }, []);
  return (
    <div
      className="mcq-editor"
      ref={root}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          done();
        }
      }}
    >
      <label>
        Question
        <textarea
          ref={input}
          aria-label="Question text"
          value={draft.question}
          onChange={(event) =>
            setDraft({ ...draft, question: event.target.value })
          }
        />
      </label>
      <fieldset>
        <legend>Choices — select the correct answer</legend>
        {draft.choices.map((choice, index) => (
          <div className="mcq-edit-choice" key={index}>
            <input
              type="radio"
              name="correct-answer"
              aria-label={`Correct answer ${letter(index)}`}
              checked={draft.correctIndex === index}
              onChange={() => setDraft({ ...draft, correctIndex: index })}
            />
            <label>
              {letter(index)}
              <input
                aria-label={`Choice ${letter(index)}`}
                value={choice}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    choices: draft.choices.map((text, i) =>
                      i === index ? event.target.value : text,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              aria-label={`Remove choice ${letter(index)}`}
              disabled={draft.choices.length <= 2}
              onClick={() =>
                setDraft({
                  ...draft,
                  choices: draft.choices.filter((_, i) => i !== index),
                  correctIndex:
                    draft.correctIndex === index
                      ? 0
                      : draft.correctIndex > index
                      ? draft.correctIndex - 1
                      : draft.correctIndex,
                })
              }
            >
              ×
            </button>
          </div>
        ))}
      </fieldset>
      <div className="mcq-edit-actions">
        <button
          type="button"
          disabled={draft.choices.length >= 26}
          onClick={() =>
            setDraft({ ...draft, choices: [...draft.choices, ""] })
          }
        >
          Add choice
        </button>
        <span />
        <button type="button" onClick={cancel}>
          Cancel
        </button>
        <button type="button" onClick={done}>
          Done
        </button>
      </div>
    </div>
  );
}

function MultipleChoice({
  data,
  element,
  interactive,
  editing,
  updateData,
  finishEditing,
}: ComponentProps<MultipleChoiceData>) {
  const [revealed, setRevealed] = useState(false);
  const paper = useRef<SVGSVGElement>(null);
  useEffect(() => setRevealed(false), [data]);
  useLayoutEffect(() => {
    const shape = ShapeCache.generateElementShape(element, null);
    if (paper.current && shape)
      paper.current.replaceChildren(new RoughSVG(paper.current).draw(shape));
  }, [element.version, element.versionNonce]);
  const toggle = () => setRevealed((value) => !value);
  return (
    <div
      className={`mcq ${interactive || editing ? "is-active" : ""}`}
      style={{ color: element.strokeColor }}
      data-revealed={revealed}
      role={interactive ? "button" : "group"}
      aria-label={
        interactive
          ? revealed
            ? "Hide multiple-choice answer"
            : "Reveal multiple-choice answer"
          : "Multiple-choice question"
      }
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? revealed : undefined}
      onPointerDown={
        interactive || editing ? (event) => event.stopPropagation() : undefined
      }
      onDoubleClick={editing ? (event) => event.stopPropagation() : undefined}
      onClick={interactive ? toggle : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          toggle();
        }
      }}
    >
      <svg
        ref={paper}
        className="mcq-paper"
        viewBox={`0 0 ${element.width} ${element.height}`}
        aria-hidden="true"
      />
      {editing ? (
        <QuestionEditor
          data={data}
          updateData={updateData}
          finishEditing={finishEditing}
        />
      ) : (
        <>
          <div
            className="mcq-content"
            onWheel={
              interactive
                ? (event) => {
                    if (!event.ctrlKey && !event.metaKey)
                      event.stopPropagation();
                  }
                : undefined
            }
          >
            <p className="mcq-question">{data.question || "Your question"}</p>
            <ol className="mcq-choices">
              {data.choices.map((choice, index) => (
                <li
                  key={index}
                  className={
                    revealed && data.correctIndex === index ? "is-correct" : ""
                  }
                >
                  <span className="mcq-letter">{letter(index)}</span>
                  <span>{choice || `Choice ${letter(index)}`}</span>
                  {revealed && data.correctIndex === index && (
                    <span
                      className="mcq-correct-mark"
                      aria-label="Correct answer"
                    >
                      ✓
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <div className="mcq-announcement" role="status">
              {revealed
                ? `Correct answer: ${letter(data.correctIndex)}. ${
                    data.choices[data.correctIndex]
                  }`
                : ""}
            </div>
          </div>
          {!interactive && (
            <button
              className="mcq-reveal"
              aria-label={revealed ? "Hide answer" : "Reveal answer"}
              title={revealed ? "Hide answer" : "Reveal answer"}
              aria-pressed={revealed}
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
                {revealed && <path d="M3 3l18 18" />}
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}

registerComponent<MultipleChoiceData>({
  type: "multiple-choice",
  version: 1,
  defaultSize: { width: 520, height: 400 },
  initialData: () => ({
    question: "Which city is the capital of France?",
    choices: ["London", "Paris", "Rome", "Madrid"],
    correctIndex: 1,
  }),
  isData: (value): value is MultipleChoiceData =>
    !!value &&
    typeof value === "object" &&
    "question" in value &&
    typeof value.question === "string" &&
    "choices" in value &&
    Array.isArray(value.choices) &&
    value.choices.length >= 2 &&
    value.choices.length <= 26 &&
    value.choices.every((choice) => typeof choice === "string") &&
    "correctIndex" in value &&
    typeof value.correctIndex === "number" &&
    Number.isInteger(value.correctIndex) &&
    value.correctIndex >= 0 &&
    value.correctIndex < value.choices.length,
  View: MultipleChoice,
});
