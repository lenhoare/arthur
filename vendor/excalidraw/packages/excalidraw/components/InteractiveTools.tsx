import { ToolButton } from "./ToolButton";
import { LockedIcon, UnlockedIcon } from "./icons";
import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, UIAppState } from "../types";
import { getComponent } from "../interactive/registry";
import { createComponent } from "../interactive/components";
import { viewportCoordsToSceneCoords } from "../utils";
import { CaptureUpdateAction } from "../store";
import { actionToggleViewMode } from "../actions/actionToggleViewMode";

export function InteractiveTools({
  app,
  appState,
  actionManager,
  modeOnly = false,
}: {
  app: AppClassProperties;
  appState: UIAppState;
  actionManager: ActionManager;
  modeOnly?: boolean;
}) {
  const interactive = appState.viewModeEnabled;
  return (
    <>
      {!interactive &&
        !modeOnly &&
        [
          "flashcard",
          "chooser",
          "flap-chooser",
          "markdown",
          "multiple-choice",
          "appear-text",
        ].map((type) => (
          <ToolButton
            key={type}
            type="button"
            aria-label={
              type === "flap-chooser"
                ? "Split-flap chooser"
                : type === "appear-text"
                ? "Appear text"
                : type === "multiple-choice"
                ? "Multiple-choice question"
                : type === "markdown"
                ? "Markdown lesson"
                : type === "flashcard"
                ? "Flashcard"
                : "Student chooser"
            }
            title={
              type === "flap-chooser"
                ? "Add split-flap chooser"
                : type === "appear-text"
                ? "Add appear text"
                : type === "multiple-choice"
                ? "Add multiple-choice question"
                : type === "markdown"
                ? "Add Markdown lesson"
                : type === "flashcard"
                ? "Add flashcard"
                : "Add student chooser"
            }
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                {type === "flap-chooser" ? (
                  <>
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <path d="M2 12h20M9 5v14M16 5v14" />
                  </>
                ) : type === "appear-text" ? (
                  <>
                    <path d="M3 5h12M9 5v15M18 2v6m-3-3h6M17 13v6m-3-3h6" />
                  </>
                ) : type === "multiple-choice" ? (
                  <>
                    <path d="M9 5h12M9 12h12M9 19h12M2 12l2 2 3-4" />
                    <circle cx="4" cy="5" r="1.5" />
                    <circle cx="4" cy="19" r="1.5" />
                  </>
                ) : type === "markdown" ? (
                  <>
                    <rect x="4" y="2" width="16" height="20" rx="1" />
                    <path d="M8 7h8M8 11h8M8 15h3m2 0h3M8 18h3m2 0h3" />
                  </>
                ) : type === "chooser" ? (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3v18M3 12h18M6 6l12 12M6 18L18 6" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M3 10h18M7 14h6M17 13v5m-2.5-2.5h5" />
                  </>
                )}
              </svg>
            }
            onClick={() => {
              const center = viewportCoordsToSceneCoords(
                {
                  clientX: appState.offsetLeft + appState.width / 2,
                  clientY: appState.offsetTop + appState.height / 2,
                },
                app.state,
              );
              const size = getComponent(type)!.defaultSize;
              const element = createComponent(
                type,
                center.x - size.width / 2,
                center.y - size.height / 2,
              );
              app.syncActionResult({
                elements: [...app.scene.getElementsIncludingDeleted(), element],
                appState: { selectedElementIds: { [element.id]: true } },
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
              });
              app.setActiveTool({ type: "selection" });
              app.focusContainer();
            }}
          />
        ))}
      <ToolButton
        type="button"
        aria-label={
          interactive ? "Switch to editing mode" : "Switch to interactive mode"
        }
        className="interactive-mode-toggle"
        title={
          interactive
            ? "Interact — unlock to edit (Alt+R)"
            : "Edit — lock to interact (Alt+R)"
        }
        icon={interactive ? LockedIcon : UnlockedIcon}
        selected={interactive}
        onClick={() => {
          actionManager.executeAction(actionToggleViewMode);
          app.focusContainer();
        }}
      >
        <span aria-hidden="true">{interactive ? "Interact" : "Edit"}</span>
      </ToolButton>
    </>
  );
}
