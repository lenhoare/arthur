import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  linkPlugin,
  linkDialogPlugin,
  diffSourcePlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  InsertTable,
  InsertCodeBlock,
  CreateLink,
  DiffSourceToggleWrapper,
  ConditionalContents,
  ChangeCodeMirrorLanguage,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { markdownSizes, type MarkdownSize } from "./markdownSizes";

const SizeMenuContext = createContext<{
  size: MarkdownSize;
  changeSize: (size: MarkdownSize) => void;
} | null>(null);

function SizeMenu() {
  const context = useContext(SizeMenuContext)!;
  return (
    <select
      className="markdown-size-menu"
      aria-label="Lesson font size"
      value={context.size}
      onChange={(event) =>
        context.changeSize(event.target.value as MarkdownSize)
      }
    >
      <option value="tiny">Tiny</option>
      <option value="small">Small</option>
      <option value="medium">Medium</option>
      <option value="large">Large</option>
    </select>
  );
}

export default function MarkdownEditor({
  markdown,
  fontSize,
  onCommit,
  finishEditing,
}: {
  markdown: string;
  fontSize: MarkdownSize;
  onCommit: (markdown: string, fontSize: MarkdownSize) => void;
  finishEditing: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(fontSize);
  const draftSize = useRef(fontSize);
  const draft = useRef(markdown);
  const original = useRef(markdown);
  const settled = useRef(false);
  const callbacks = useRef({ onCommit, finishEditing });
  callbacks.current = { onCommit, finishEditing };
  function save() {
    if (settled.current) return;
    settled.current = true;
    if (draft.current !== original.current || draftSize.current !== fontSize)
      callbacks.current.onCommit(draft.current, draftSize.current);
  }
  function done() {
    save();
    callbacks.current.finishEditing();
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (
        !root.current?.contains(target) &&
        !target.closest(".mdxeditor-popup-container")
      )
        done();
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      // Native mode changes also finish the current edit.
      save();
    };
  }, []);
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      tablePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "python" }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          "": "Plain text",
          python: "Python",
          js: "JavaScript",
          ts: "TypeScript",
          html: "HTML",
          css: "CSS",
          sql: "SQL",
          bash: "Shell",
          json: "JSON",
        },
      }),
      diffSourcePlugin(),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper options={["source"]}>
            <UndoRedo />
            <SizeMenu />
            <ConditionalContents
              options={[
                {
                  when: (editor) => editor?.editorType === "codeblock",
                  contents: () => <ChangeCodeMirrorLanguage />,
                },
                {
                  fallback: () => (
                    <>
                      <span className="markdown-block-type">
                        <BlockTypeSelect />
                      </span>
                      <BoldItalicUnderlineToggles />
                      <ListsToggle />
                      <CreateLink />
                      <InsertTable />
                      <InsertCodeBlock />
                    </>
                  ),
                },
              ]}
            />
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [],
  );
  return (
    <div
      className="markdown-editor"
      style={{ "--markdown-font-size": markdownSizes[size] } as CSSProperties}
      ref={root}
      onWheel={(event) => {
        if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          done();
        } else if (
          event.key === "Escape" &&
          !document.querySelector(
            '.mdxeditor-popup-container [role="dialog"], .mdxeditor-popup-container [role="listbox"], .mdxeditor-popup-container [role="menu"]',
          )
        ) {
          event.preventDefault();
          settled.current = true;
          callbacks.current.finishEditing();
        }
      }}
    >
      <div className="markdown-edit-actions">
        <span>Lesson notes</span>
        <button
          type="button"
          onClick={() => {
            settled.current = true;
            callbacks.current.finishEditing();
          }}
        >
          Cancel
        </button>
        <button type="button" onClick={done}>
          Done
        </button>
      </div>
      <SizeMenuContext.Provider
        value={{
          size,
          changeSize: (next) => {
            draftSize.current = next;
            setSize(next);
          },
        }}
      >
        <MDXEditor
          markdown={original.current}
          autoFocus
          contentEditableClassName="markdown-content"
          plugins={plugins}
          onChange={(value, initial) => {
            if (!initial) draft.current = value;
          }}
        />
      </SizeMenuContext.Provider>
    </div>
  );
}
