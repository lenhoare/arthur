import { useEffect, useRef, useState } from "react";
import { registerComponent, type ComponentProps } from "./registry";
import "./chooser.css";

interface ChooserData {
  names: string[];
}

function Chooser({
  data,
  element,
  interactive,
  editing,
  updateData,
  finishEditing,
}: ComponentProps<ChooserData>) {
  const [draft, setDraft] = useState("");
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const running = useRef(false);
  const cancelled = useRef(false);
  const names = data.names.filter((name) => name.trim());

  useEffect(() => {
    if (editing) {
      cancelled.current = false;
      setDraft(data.names.join("\n"));
      const focus = requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
      return () => cancelAnimationFrame(focus);
    }
  }, [editing]);

  // Mode/content changes and removal cancel transient motion and results.
  useEffect(() => {
    running.current = false;
    setSpinning(false);
    setWinner(null);
    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(timer.current);
      running.current = false;
    };
  }, [interactive, editing, data.names]);

  function commit() {
    const next = draft
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (
      !cancelled.current &&
      JSON.stringify(next) !== JSON.stringify(data.names)
    ) {
      updateData({ names: next });
    }
    finishEditing();
  }

  function spin() {
    if (running.current || !names.length) return;
    running.current = true;
    setSpinning(true);
    setWinner(null);
    clearTimeout(timer.current);
    const random = crypto.getRandomValues(new Uint32Array(2));
    // A uniform angle gives every equal-sized segment the same chance.
    const target = (random[0] / 2 ** 32) * 360;
    const startAngle = ((angle % 360) + 360) % 360;
    const distance = 360 * 5 + ((target - startAngle + 360) % 360);
    const duration = 4200 + (random[1] / 2 ** 32) * 1400;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      // Constant friction: angular velocity decreases linearly to zero.
      setAngle(startAngle + distance * (2 * progress - progress * progress));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        running.current = false;
        setSpinning(false);
        const index = Math.floor(((360 - target) % 360) / (360 / names.length));
        if (interactive) {
          setWinner(index);
          timer.current = setTimeout(() => setWinner(null), 2000);
        }
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  const sliceColor = (index: number) =>
    `color-mix(in srgb, ${element.backgroundColor} 60%, hsl(${
      index * 137.508
    } 75% 75%))`;

  const point = (degrees: number, radius = 182) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [200 + Math.cos(radians) * radius, 200 + Math.sin(radians) * radius];
  };

  return (
    <div
      className={`chooser ${interactive ? "is-interactive" : ""} ${
        editing ? "is-editing" : ""
      }`}
      style={{ color: element.strokeColor }}
      data-spinning={spinning}
      role={interactive ? "button" : "group"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Spin student chooser" : "Student chooser"}
      aria-disabled={interactive && (spinning || !names.length)}
      onPointerDown={
        interactive || editing ? (event) => event.stopPropagation() : undefined
      }
      onClick={interactive ? spin : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          spin();
        }
      }}
    >
      {editing ? (
        <div
          className="chooser-editor"
          style={{ background: element.backgroundColor }}
        >
          <label htmlFor={`chooser-${element.id}`}>One name per line</label>
          <textarea
            id={`chooser-${element.id}`}
            ref={input}
            aria-label="Edit chooser names"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
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
        </div>
      ) : (
        <>
          <svg
            className="chooser-wheel"
            viewBox="0 0 400 400"
            aria-hidden="true"
          >
            <g transform={`rotate(${angle} 200 200)`}>
              {!names.length && (
                <circle
                  cx="200"
                  cy="200"
                  r="182"
                  fill={element.backgroundColor}
                  stroke="currentColor"
                />
              )}
              {names.map((name, index) => {
                const step = 360 / names.length;
                const start = point(index * step);
                const end = point((index + 1) * step);
                const fill = sliceColor(index);
                return (
                  <g key={index}>
                    {names.length === 1 ? (
                      <circle
                        cx="200"
                        cy="200"
                        r="182"
                        fill={fill}
                        stroke="currentColor"
                        strokeWidth={element.strokeWidth}
                      />
                    ) : (
                      <path
                        d={`M200 200 L${start.join(" ")} A182 182 0 ${
                          step > 180 ? 1 : 0
                        } 1 ${end.join(" ")} Z`}
                        fill={fill}
                        stroke="currentColor"
                        strokeWidth={element.strokeWidth}
                      />
                    )}
                    <g
                      transform={`rotate(${(index + 0.5) * step - 90} 200 200)`}
                    >
                      <text
                        x="367"
                        y="200"
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="currentColor"
                        fontSize={Math.min(
                          19,
                          420 / names.length,
                          220 / Math.max(name.length, 1),
                        )}
                      >
                        {name}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
            <circle
              cx="200"
              cy="200"
              r="23"
              fill={element.backgroundColor}
              stroke="currentColor"
              strokeWidth={element.strokeWidth}
            />
            <path d="M185 4H215L200 30Z" fill="currentColor" />
          </svg>
          {!interactive && (
            <button
              className="chooser-spin"
              aria-label="Spin chooser preview"
              title="Spin wheel"
              aria-disabled={spinning || !names.length}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                spin();
              }}
            />
          )}
          {!names.length && (
            <div className="chooser-hint">
              {interactive ? "No names yet" : "Double-click to add names"}
            </div>
          )}
          {interactive && winner !== null && (
            <div
              className="chooser-result"
              role="status"
              style={{ background: sliceColor(winner) }}
            >
              {names[winner]}
            </div>
          )}
        </>
      )}
    </div>
  );
}

registerComponent<ChooserData>({
  type: "chooser",
  version: 1,
  defaultSize: { width: 400, height: 400 },
  initialData: () => ({ names: [] }),
  isData: (value): value is ChooserData =>
    !!value &&
    typeof value === "object" &&
    "names" in value &&
    Array.isArray(value.names) &&
    value.names.every((name) => typeof name === "string"),
  View: Chooser,
});
