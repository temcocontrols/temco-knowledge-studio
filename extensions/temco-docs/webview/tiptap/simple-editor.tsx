"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Highlight } from "@tiptap/extension-highlight"
import { FindAndReplace } from "@tiptap/extension-find-and-replace"
import { Mathematics } from "@tiptap/extension-mathematics"
import { Markdown } from "@tiptap/markdown"
import { Selection } from "@tiptap/extensions"

// --- The document bridge ---
import { tidy } from "../markdown.mts"
import { attach, requestImage, requestImageSave } from "./document"
import { DocumentActions } from "./document-actions"
import { OutlinePanel } from "./outline-panel"
import { CalloutButtons, MathButtons, OutlineToggle, TableButton } from "./toolbar-extras"
import { CalloutLook } from "./callout"
import { EditorContextMenu } from "./context-menu"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import { HighlightToggle } from "./highlight-toggle"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import {
  SearchAndReplace,
  SearchAndReplaceButton,
} from "@/components/tiptap-ui/search-and-replace"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"

// --- Components ---
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"


const SEARCH_AND_REPLACE_SCROLL_OPTIONS: ScrollIntoViewOptions = {
  block: "center",
}

/** The images in a paste, or nothing — a paste of text must fall through to the editor untouched. */
function pastedImages(data: DataTransfer | null): File[] {
  if (data === null) {
    return []
  }
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"))
}

const MainToolbarContent = ({
  onLinkClick,
  onSearchAndReplaceClick,
  isSearchAndReplaceOpen,
  searchAndReplaceButtonRef,
  isMobile,
  outlineOpen,
  onToggleOutline,
}: {
  onLinkClick: () => void
  onSearchAndReplaceClick: () => void
  isSearchAndReplaceOpen: boolean
  searchAndReplaceButtonRef: React.RefObject<HTMLButtonElement | null>
  isMobile: boolean
  outlineOpen: boolean
  onToggleOutline: () => void
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu modal={false} levels={[1, 2, 3, 4]} />
        <ListDropdownMenu
          modal={false}
          types={["bulletList", "orderedList", "taskList"]}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        <HighlightToggle />
        {!isMobile ? (
          // The popover opens when the Link button is pressed, not when the caret merely sits inside a link: a page
          // carries hundreds of links, and one that opens on every click takes the focus away from the text.
          <LinkPopover autoOpenOnLinkActive={false} />
        ) : (
          <LinkButton onClick={onLinkClick} />
        )}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TableButton />
        <CalloutButtons />
        <MathButtons />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

      <ToolbarGroup>
        <SearchAndReplaceButton
          ref={searchAndReplaceButtonRef}
          aria-expanded={isSearchAndReplaceOpen}
          data-active-state={isSearchAndReplaceOpen ? "on" : "off"}
          onClick={onSearchAndReplaceClick}
        />
        <ThemeToggle />
        <OutlineToggle open={outlineOpen} onToggle={onToggleOutline} />
      </ToolbarGroup>

      <DocumentActions />
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    <LinkContent />
  </>
)

export function SimpleEditor() {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<"main" | "link">(
    "main"
  )
  const [isSearchAndReplaceOpen, setIsSearchAndReplaceOpen] = useState(false)
  // The outline starts open: a page without one is a page you scroll to find things in.
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const searchAndReplaceButtonRef = useRef<HTMLButtonElement>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
      /**
       * A pasted screenshot arrives as a file, not as text, so ProseMirror's own paste handling drops it. The bytes go
       * to the extension, which is the only side that can put a file beside the page; the reply is the page-relative
       * address, which is what the Markdown has to contain.
       */
      handlePaste: (view, event) => {
        const files = pastedImages(event.clipboardData)
        if (files.length === 0) {
          return false
        }
        event.preventDefault()
        void (async () => {
          for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
              console.error(`Pasted image is larger than ${MAX_FILE_SIZE} bytes:`, file.size)
              continue
            }
            const source = await requestImageSave(
              new Uint8Array(await file.arrayBuffer()),
              file.name || "pasted.png"
            )
            // The editor can be closed while the file is being written.
            if (!view.dom.isConnected) {
              return
            }
            const node = view.state.schema.nodes.image?.create({ src: source })
            if (node) {
              view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView())
            }
          }
        })()
        return true
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          // Clicking a link must place the caret where the pointer is. With click-selection on, a click selects the
          // whole link instead, which also makes the link popover open — and it takes the focus, so the next
          // keystroke, Ctrl+A or paste goes into its URL field rather than into the page.
          enableClickSelection: false,
        },
      }),
      HorizontalRule,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Selection,
      FindAndReplace.configure({
        searchDebounceMs: 500,
        injectCSS: false,
      }),
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        // The picker is the extension's, not a server's: the file is copied into the page's own media/ folder and the
        // address that comes back is the page-relative one the Markdown needs.
        upload: () => requestImage(),
        onError: (error) => console.error("Upload failed:", error),
      }),
      // The document is Markdown. Without this the editor speaks HTML and every save rewrites the page.
      Markdown.configure({
        indentation: { style: "space", size: 2 },
        markedOptions: { gfm: true, breaks: false },
      }),
      // The documentation is full of tables; without these a table would not survive the first save.
      Table,
      TableRow,
      TableCell,
      TableHeader,
      // Maths is written as $?$ / $$?$$ and read back by the same extension; without it a formula would be
      // escaped into text on the first save.
      Mathematics.configure({ katexOptions: { throwOnError: false } }),
      CalloutLook,
    ],
    content: "",
  })

  // The document in, and the document out.
  useEffect(() => {
    if (!editor) {
      return
    }
    return attach(editor, tidy)
  }, [editor])

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  const openSearchAndReplace = useCallback(() => {
    setMobileView("main")
    setIsSearchAndReplaceOpen(true)
  }, [])

  const closeSearchAndReplace = useCallback(() => {
    setIsSearchAndReplaceOpen(false)
    searchAndReplaceButtonRef.current?.focus()
  }, [])

  const toggleSearchAndReplace = useCallback(() => {
    if (isSearchAndReplaceOpen) {
      closeSearchAndReplace()
      return
    }

    openSearchAndReplace()
  }, [closeSearchAndReplace, isSearchAndReplaceOpen, openSearchAndReplace])

  return (
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onLinkClick={() => setMobileView("link")}
              onSearchAndReplaceClick={toggleSearchAndReplace}
              isSearchAndReplaceOpen={isSearchAndReplaceOpen}
              searchAndReplaceButtonRef={searchAndReplaceButtonRef}
              isMobile={isMobile}
              outlineOpen={outlineOpen}
              onToggleOutline={() => setOutlineOpen((open) => !open)}
            />
          ) : (
            <MobileToolbarContent
              type="link"
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <SearchAndReplace
          className="simple-editor-search-and-replace"
          open={isSearchAndReplaceOpen}
          onOpen={openSearchAndReplace}
          onClose={closeSearchAndReplace}
          scrollIntoViewOptions={SEARCH_AND_REPLACE_SCROLL_OPTIONS}
        />

        <div className="temco-workspace">
          <OutlinePanel editor={editor} open={outlineOpen} onClose={() => setOutlineOpen(false)} />
          <div className="temco-sheet"
            onMouseDown={(event) => {
              // A right-click must leave the editor usable whatever the browser would otherwise do to the selection:
              // inside an existing selection it keeps that selection, so Cut and Copy still have something to act on;
              // anywhere else it moves the caret to the pointer, so the menu knows whether it is on a link or a table.
              if (event.button !== 2 || !editor) {
                return
              }
              if (!(event.target as HTMLElement).closest('.ProseMirror')) {
                return
              }
              const hit = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (hit === null) {
                return
              }
              event.preventDefault()
              const { from, to, empty } = editor.state.selection
              if (!empty && hit.pos >= from && hit.pos <= to) {
                // The browser drops the DOM selection on a right-click; put the editor's own selection back, so the
                // highlight the person can still see is the one Cut and Copy will use.
                editor.commands.setTextSelection({ from, to })
                return
              }
              editor.commands.setTextSelection(hit.pos)
            }}
            onContextMenu={(event) => {
              // Only the page owns a menu. Right-clicking the toolbar or the outline keeps the host's own menu.
              if (!(event.target as HTMLElement).closest('.ProseMirror')) {
                return
              }
              event.preventDefault()
              setMenuAt({ x: event.clientX, y: event.clientY })
            }}>
            <EditorContent
              editor={editor}
              role="presentation"
              className="simple-editor-content"
            />
          </div>
        </div>

        <EditorContextMenu at={menuAt} onClose={() => setMenuAt(null)} />
      </EditorContext.Provider>
    </div>
  )
}
