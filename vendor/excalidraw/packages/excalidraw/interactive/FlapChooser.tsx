import { useEffect, useRef, useState, type CSSProperties } from "react";
import { registerComponent, type ComponentProps } from "./registry";
import "./flap-chooser.css";
import { createFlapSound } from "./flapSound";

interface FlapData {
  names: string[];
}
const glyphs = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
const letters = (text: string) =>
  Array.from(text.normalize("NFC").toLocaleUpperCase());

function Flap({ character }: { character: string }) {
  const previous = useRef(character);
  const old = previous.current;
  useEffect(() => {
    previous.current = character;
  }, [character]);
  return (
    <span className="flap-tile" aria-hidden="true">
      <span className="flap-half flap-top">
        <span>{character}</span>
      </span>
      <span className="flap-half flap-bottom">
        <span>{character}</span>
      </span>
      {old !== character && (
        <span key={character} className="flap-half flap-top flap-turn">
          <span>{old}</span>
        </span>
      )}
    </span>
  );
}

function FlapChooser({
  data,
  element,
  interactive,
  editing,
  updateData,
  finishEditing,
}: ComponentProps<FlapData>) {
  const [draft, setDraft] = useState("");
  const [display, setDisplay] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [settledCount, setSettledCount] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const running = useRef(false);
  const sound = useRef<ReturnType<typeof createFlapSound> | null>(null);
  const cancelled = useRef(false);
  const names = data.names.filter((name) => name.trim());
  const slots = names.reduce(
    (count, name) => Math.max(count, letters(name).length),
    12,
  );

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
  useEffect(() => {
    running.current = false;
    setSpinning(false);
    setDisplay([]);
    setWinner(null);
    setSettledCount(0);
    return () => {
      clearTimeout(timer.current);
      sound.current?.close();
      sound.current = null;
      running.current = false;
    };
  }, [interactive, editing, data.names]);

  function commit() {
    if (!cancelled.current) {
      cancelled.current = true;
      const next = draft
        .split(/\r?\n/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (JSON.stringify(next) !== JSON.stringify(data.names))
        updateData({ names: next });
    }
    finishEditing();
  }
  function choose() {
    if (running.current || !names.length) return;
    try {
      sound.current ??= createFlapSound();
    } catch {
      /* Audio unavailable: the draw still works. */
    }
    running.current = true;
    setSpinning(true);
    setWinner(null);
    setSettledCount(0);
    // Rejection sampling avoids modulo bias: every list entry has equal odds.
    const sample = new Uint32Array(1);
    const limit = Math.floor(2 ** 32 / names.length) * names.length;
    do {
      crypto.getRandomValues(sample);
    } while (sample[0] >= limit);
    const chosen = names[sample[0] % names.length];
    // Every flap takes part in every draw. Shorter entries finish with real
    // space targets, so their blank flaps settle after the final letter.
    const target = [
      ...letters(chosen),
      ...Array(Math.max(0, slots - letters(chosen).length)).fill(" "),
    ];
    const reducedMotion = matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    const letterDelay = Math.min(180, 3600 / Math.max(1, target.length));
    const duration = 900 + target.length * letterDelay;
    let cycle = 0;
    function tick() {
      const elapsed = performance.now() - start;
      const settled = Math.min(
        target.length,
        Math.max(0, Math.floor((elapsed - 900) / letterDelay)),
      );
      sound.current?.click(target.length - settled);
      setSettledCount(settled);
      setDisplay(
        Array.from({ length: slots }, (_, index) => {
          if (index < settled) return target[index];
          if (index >= target.length || reducedMotion) return " ";
          return glyphs[(cycle * 7 + index * 11) % glyphs.length];
        }),
      );
      if (settled === target.length) {
        running.current = false;
        setSpinning(false);
        setWinner(chosen);
      } else {
        cycle++;
        // Increasing intervals give the mechanism a slowing, coasting feel.
        timer.current = setTimeout(
          tick,
          60 + 100 * Math.min(1, elapsed / duration),
        );
      }
    }
    tick();
  }
  return (
    <div
      className={`flap-chooser ${interactive || editing ? "is-active" : ""}`}
      style={
        { "--flap-background": element.backgroundColor } as React.CSSProperties
      }
      data-spinning={spinning}
      data-settled={settledCount}
      role={interactive ? "button" : "group"}
      aria-label={
        interactive ? "Choose with split-flap board" : "Split-flap chooser"
      }
      aria-disabled={interactive ? spinning || !names.length : undefined}
      tabIndex={interactive ? 0 : undefined}
      onPointerDown={
        interactive || editing ? (event) => event.stopPropagation() : undefined
      }
      onClick={interactive ? choose : undefined}
      onDoubleClick={editing ? (event) => event.stopPropagation() : undefined}
      onKeyDown={(event) => {
        if (interactive && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          event.stopPropagation();
          choose();
        }
      }}
    >
      {editing ? (
        <div className="flap-editor">
          <label>
            One person or thing per line
            <textarea
              ref={input}
              aria-label="Edit split-flap entries"
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
          </label>
        </div>
      ) : (
        <>
          <div
            className="flap-row"
            style={{
              gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))`,
              fontSize: `min(42cqh, ${72 / slots}cqw)`,
            }}
          >
            {Array.from({ length: slots }, (_, index) => (
              <Flap key={index} character={display[index] || " "} />
            ))}
          </div>
          {!names.length && (
            <span className="flap-empty">
              {interactive
                ? "No entries yet"
                : "Double-click to add people or things"}
            </span>
          )}
          <span className="flap-status" role="status">
            {winner !== null ? `Chosen: ${winner}` : ""}
          </span>
          {!interactive && (
            <button
              className="flap-preview"
              aria-label="Preview split-flap draw"
              title="Choose an entry"
              aria-disabled={spinning || !names.length}
              onPointerDown={(event) => {
                event.stopPropagation();
                event.preventDefault();
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                choose();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M18 8a7 7 0 1 0 1 7M18 3v5h-5" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}

registerComponent<FlapData>({
  type: "flap-chooser",
  version: 1,
  defaultSize: { width: 480, height: 56 },
  defaultBackgroundColor: "#333333",
  initialData: () => ({ names: [] }),
  isData: (value): value is FlapData =>
    !!value &&
    typeof value === "object" &&
    "names" in value &&
    Array.isArray(value.names) &&
    value.names.every((name) => typeof name === "string"),
  View: FlapChooser,
});
