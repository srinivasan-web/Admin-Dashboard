import {
  useState,
  type ReactNode,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Undo2,
  Redo2,
  Link,
  Unlink,
  RemoveFormatting,
  Type,
  Palette,
  Highlighter,
  AlignLeft,
  Image,
  Table2,
  Check,
  X,
} from "lucide-react";
import {
  descriptionAsEditorHtml,
  sanitizeDescriptionHtml,
} from "../../../../shared/productDescription";

const tabs = ["Home", "Insert", "Format"] as const;
type Tab = (typeof tabs)[number];

function Command({
  label,
  children,
  active,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="description-command"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="description-command-group">
      <div className="description-group-controls">{children}</div>
      <span className="description-group-label">{label}</span>
    </div>
  );
}
function Unavailable({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span
      className="description-unavailable"
      title={`${label} is not supported by the saved product-description format.`}
    >
      <button
        type="button"
        className="description-command"
        disabled
        aria-label={`${label} unavailable`}
      >
        {children}
      </button>
    </span>
  );
}

function descriptionState(current: Editor | null) {
  if (!current || current.isDestroyed || !current.schema) return null;
  const text = current.getText({ blockSeparator: "\n" });
  return {
    bold: current.isActive("bold"),
    italic: current.isActive("italic"),
    underline: current.isActive("underline"),
    strike: current.isActive("strike"),
    bullet: current.isActive("bulletList"),
    ordered: current.isActive("orderedList"),
    link: current.isActive("link"),
    style: current.isActive("heading", { level: 2 })
      ? "h2"
      : current.isActive("heading", { level: 3 })
        ? "h3"
        : "p",
    canUndo: current.can().undo(),
    canRedo: current.can().redo(),
    canIndent: current.can().sinkListItem("listItem"),
    canOutdent: current.can().liftListItem("listItem"),
    selected: !current.state.selection.empty,
    words: text.trim() ? text.trim().split(/\s+/u).length : 0,
    characters: Array.from(text).length,
    empty: current.isEmpty,
  };
}
export default function ProductDescriptionDocument({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (html: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("Home");
  const [dirty, setDirty] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const [font, setFont] = useState("Inter, sans-serif");
  const [fontSize, setFontSize] = useState("16");
  function openLink(current: Editor) {
    setHref(String(current.getAttributes("link").href ?? ""));
    setLinkError("");
    setLinkOpen(true);
  }
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          protocols: ["http", "https"],
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
    ],
    content: descriptionAsEditorHtml(initialValue),
    // This lazy module runs only in the Vite browser client. Initialize before
    // subscribing to toolbar state so a null snapshot cannot hide EditorContent.
    immediatelyRender: true,
    onUpdate: ({ editor: current }) => {
      setDirty(true);
      onChange(
        current.isEmpty ? "" : sanitizeDescriptionHtml(current.getHTML()),
      );
    },
    editorProps: {
      attributes: {
        id: "product-description-editor",
        role: "textbox",
        "aria-labelledby": "description-editor-label",
        "aria-describedby": "description-editor-help",
        "aria-multiline": "true",
        spellcheck: "true",
      },
      transformPastedHTML: (html) => sanitizeDescriptionHtml(html),
      handleDrop: (_view, event) =>
        event.dataTransfer?.files.length ? true : false,
      handleKeyDown: (_view, event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "k"
        ) {
          event.preventDefault();
          if (editor) openLink(editor);
          return true;
        }
        return false;
      },
    },
  });
  const state =
    useEditorState({
      editor,
      selector: ({ editor: current }) => descriptionState(current),
    }) ?? descriptionState(editor);
  if (!editor || !state)
    return (
      <div className="description-loading" role="status">
        Preparing document…
      </div>
    );
  function applyLink() {
    try {
      const url = new URL(href.trim());
      if (!["https:", "http:"].includes(url.protocol)) throw new Error();
      if (!editor) return;
      if (editor.state.selection.empty && !editor.isActive("link")) {
        setLinkError("Select the text you want to link first.");
        return;
      }
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url.href })
        .run();
      setLinkOpen(false);
    } catch {
      setLinkError("Enter a complete URL starting with https:// or http://.");
    }
  }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(tabs[next]);
    document.getElementById(`description-tab-${tabs[next]}`)?.focus();
  }
  const inline = (
    <>
      <Command
        label="Bold (Ctrl+B)"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={17} />
      </Command>
      <Command
        label="Italic (Ctrl+I)"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={17} />
      </Command>
      <Command
        label="Underline (Ctrl+U)"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline size={17} />
      </Command>
      <Command
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={17} />
      </Command>
    </>
  );
  const style = (
    <label className="description-select">
      <span>Paragraph style</span>
      <select
        aria-label="Paragraph style"
        value={state.style}
        onChange={(event) =>
          event.target.value === "p"
            ? editor.chain().focus().setParagraph().run()
            : editor
                .chain()
                .focus()
                .setHeading({ level: event.target.value === "h2" ? 2 : 3 })
                .run()
        }
      >
        <option value="p">Normal text</option>
        <option value="h2">Heading</option>
        <option value="h3">Subheading</option>
      </select>
    </label>
  );
  const link = (
    <Command
      label="Add or edit link (Ctrl+K)"
      active={state.link}
      onClick={() => openLink(editor)}
    >
      <Link size={17} />
    </Command>
  );
  return (
    <div className="description-editor-shell">
      <div
        className="description-ribbon-tabs"
        role="tablist"
        aria-label="Description ribbon"
      >
        {tabs.map((name, index) => (
          <button
            type="button"
            role="tab"
            key={name}
            id={`description-tab-${name}`}
            aria-selected={tab === name}
            aria-controls="description-ribbon-panel"
            tabIndex={tab === name ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => tabKeys(event, index)} className={"pl-4 flex justify-between description-ribbon-tab" + (tab === name ? " active" : "")}
          >
            {name}
          </button>
        ))}
        <span className="description-edit-status">
          {dirty ? "Unsaved changes" : ""}
        </span>
      </div>
      <div
        id="description-ribbon-panel"
        role="tabpanel"
        aria-labelledby={`description-tab-${tab}`}
        className="description-ribbon"
      >
        {tab === "Home" && (
          <>
            <Group label="History">
              <Command
                label="Undo (Ctrl+Z)"
                disabled={!state.canUndo}
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo2 size={18} />
              </Command>
              <Command
                label="Redo (Ctrl+Shift+Z)"
                disabled={!state.canRedo}
                onClick={() => editor.chain().focus().redo().run()}
              >
                <Redo2 size={18} />
              </Command>
            </Group>
            <Group label="Text">
              {inline}
              <Command
                label="Clear text formatting"
                onClick={() => editor.chain().focus().unsetAllMarks().run()}
              >
                <RemoveFormatting size={17} />
              </Command>
            </Group>
            <Group label="Styles">{style}</Group>
            <Group label="Paragraph">
              <Command
                label="Bulleted list"
                active={state.bullet}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List size={18} />
              </Command>
              <Command
                label="Numbered list"
                active={state.ordered}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered size={18} />
              </Command>
              <Command
                label="Increase list indent"
                disabled={!state.canIndent}
                onClick={() =>
                  editor.chain().focus().sinkListItem("listItem").run()
                }
              >
                <IndentIncrease size={18} />
              </Command>
              <Command
                label="Decrease list indent"
                disabled={!state.canOutdent}
                onClick={() =>
                  editor.chain().focus().liftListItem("listItem").run()
                }
              >
                <IndentDecrease size={18} />
              </Command>
              {link}
            </Group>
          </>
        )}
        {tab === "Insert" && (
          <>
            <Group label="Links">
              {link}
              <Command
                label="Remove link"
                disabled={!state.link}
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .unsetLink()
                    .run()
                }
              >
                <Unlink size={18} />
              </Command>
            </Group>
            <Group label="Additional content">
              <Unavailable label="Inline images">
                <Image size={18} />
                <span>Image</span>
              </Unavailable>
              <Unavailable label="Tables">
                <Table2 size={18} />
                <span>Table</span>
              </Unavailable>
            </Group>
            <p className="description-ribbon-note">
              Images belong in Product Media. Inline images and tables are
              unavailable in descriptions.
            </p>
          </>
        )}
        {tab === "Format" && (
          <>
            <Group label="Document styles">
              {style}
              <Command
                label="Reset paragraph and text formatting"
                onClick={() =>
                  editor.chain().focus().unsetAllMarks().clearNodes().run()
                }
              >
                <RemoveFormatting size={18} />
              </Command>
            </Group>
            <Group label="Editor view">
              <label className="description-select">
                <span>Canvas font</span>
                <select
                  aria-label="Canvas font"
                  value={font}
                  onChange={(event) => setFont(event.target.value)}
                >
                  <option value="Inter, sans-serif">Inter</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Arial, sans-serif">Arial</option>
                </select>
              </label>
              <label className="description-select description-size">
                <span>Canvas size</span>
                <select
                  aria-label="Canvas size"
                  value={fontSize}
                  onChange={(event) => setFontSize(event.target.value)}
                >
                  {[14, 16, 18, 20].map((size) => (
                    <option key={size} value={size}>
                      {size}px
                    </option>
                  ))}
                </select>
              </label>
            </Group>
            <Group label="Unavailable formats">
              <Unavailable label="Text color">
                <Palette size={18} />
              </Unavailable>
              <Unavailable label="Text highlight">
                <Highlighter size={18} />
              </Unavailable>
              <Unavailable label="Text alignment">
                <AlignLeft size={18} />
              </Unavailable>
            </Group>
          </>
        )}
      </div>
      {tab === "Format" && (
        <p className="description-format-note">
      
        </p>
      )}
      {linkOpen && (
        <div
          className="description-link-panel"
          role="group"
          aria-label="Edit description link"
        >
          <label htmlFor="description-link-url">Link address</label>
          <input
            autoFocus
            id="description-link-url"
            type="url"
            value={href}
            placeholder="https://example.com"
            aria-invalid={Boolean(linkError)}
            aria-describedby={linkError ? "description-link-error" : undefined}
            onChange={(event) => {
              setHref(event.target.value);
              setLinkError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setLinkOpen(false);
                editor.commands.focus();
              }
            }}
          />
          <button type="button" onClick={applyLink}>
            <Check size={16} /> Apply link
          </button>
          <button
            type="button"
            className="description-close"
            aria-label="Cancel link"
            onClick={() => {
              setLinkOpen(false);
              editor.commands.focus();
            }}
          >
            <X size={17} />
          </button>
          {linkError && (
            <p id="description-link-error" role="alert">
              {linkError}
            </p>
          )}
        </div>
      )}
      {state.selected && !linkOpen && (
        <div
          className="description-selection-tools"
          role="toolbar"
          aria-label="Selected text formatting"
        >
          {inline}
          {link}
        </div>
      )}
      <div
        className="description-canvas"
        style={
          {
            "--description-font": font,
            "--description-size": `${fontSize}px`,
          } as CSSProperties
        }
      >
        <div className="description-page">
          <EditorContent editor={editor} />
          {state.empty && (
            <p className="description-placeholder" aria-hidden="true">
           
            </p>
          )}
        </div>
      </div>
     

    </div>
  );
}
