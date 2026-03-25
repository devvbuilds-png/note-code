import { useEffect, useRef, useCallback } from 'react'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { tags } from '@lezer/highlight'

// ── Markdown highlight style ─────────────────────────────────────────────────
const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', color: '#da8fff' },
  { tag: tags.heading2, fontSize: '1.3em', fontWeight: '700', color: '#e2e8f0' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '600', color: '#57c7ff' },
  { tag: tags.strong,   fontWeight: 'bold', color: '#f3ae35' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#5af78e' },
  { tag: tags.monospace, background: '#1a1e24', color: '#f3ae35' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link,     color: '#57c7ff' },
  { tag: tags.url,      color: '#57c7ff' },
  { tag: tags.quote,    color: '#8892a4', fontStyle: 'italic' },
  // Dim the syntax punctuation (# ** _ ``` etc.)
  { tag: tags.processingInstruction, color: '#4a5568' },
  { tag: tags.punctuation,           color: '#4a5568' },
  // Code block syntax tokens — One Dark palette
  { tag: tags.keyword,              color: '#c678dd' },
  { tag: tags.string,               color: '#98c379' },
  { tag: tags.number,               color: '#d19a66' },
  { tag: tags.bool,                 color: '#d19a66' },
  { tag: tags.null,                 color: '#d19a66' },
  { tag: tags.comment,              color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.variableName,         color: '#e06c75' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.typeName,             color: '#e5c07b' },
  { tag: tags.className,            color: '#e5c07b' },
  { tag: tags.operator,             color: '#56b6c2' },
  { tag: tags.meta,                 color: '#56b6c2' },
  { tag: tags.tagName,              color: '#e06c75' },
  { tag: tags.attributeName,        color: '#d19a66' },
  { tag: tags.attributeValue,       color: '#98c379' },
])

// ── Base EditorView theme ────────────────────────────────────────────────────
const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    background: '#0d0f11',
    color: '#e2e8f0',
    fontSize: 'inherit',
  },
  '.cm-scroller': {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    lineHeight: '1.7',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#2a2f38 transparent',
  },
  '.cm-content': {
    padding: '16px',
    caretColor: '#da8fff',
  },
  '.cm-cursor': { borderLeftColor: '#da8fff' },
  '.cm-activeLine': { background: '#1a1e2440' },
  '.cm-selectionBackground, ::selection': { background: '#2d3748 !important' },
  '.cm-focused .cm-selectionBackground': { background: '#2d3748' },
  '&.cm-focused .cm-selectionBackground': { background: '#2d3748' },
  '.cm-gutters': { display: 'none' },
  '.cm-line': { padding: '0 2px' },
}, { dark: true })

// ── Toolbar helpers ──────────────────────────────────────────────────────────
function insertHeading(view, level) {
  const prefix = '#'.repeat(level) + ' '
  const state = view.state
  const changes = []
  const seen = new Set()

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.from)
    if (seen.has(line.number)) continue
    seen.add(line.number)

    const text = line.text
    // Strip existing heading prefix
    const stripped = text.replace(/^#{1,6}\s/, '')
    const alreadyHas = text.startsWith(prefix) && stripped !== text

    if (alreadyHas) {
      changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
    } else {
      const existingMatch = text.match(/^(#{1,6}\s)/)
      if (existingMatch) {
        changes.push({ from: line.from, to: line.from + existingMatch[1].length, insert: prefix })
      } else {
        changes.push({ from: line.from, insert: prefix })
      }
    }
  }

  if (changes.length) {
    view.dispatch({ changes })
  }
  view.focus()
}

function toggleWrap(view, before, after) {
  const state = view.state
  const changes = []

  for (const range of state.selection.ranges) {
    const selected = state.doc.sliceString(range.from, range.to)
    if (selected.startsWith(before) && selected.endsWith(after)) {
      changes.push({
        from: range.from,
        to: range.to,
        insert: selected.slice(before.length, selected.length - after.length),
      })
    } else {
      changes.push({ from: range.from, to: range.to, insert: before + selected + after })
    }
  }

  if (changes.length) {
    view.dispatch({ changes })
  }
  view.focus()
}

function insertCheckbox(view) {
  const state = view.state
  const changes = []
  for (const range of state.selection.ranges) {
    changes.push({ from: range.from, to: range.to, insert: '[ ] ' })
  }
  if (changes.length) view.dispatch({ changes })
  view.focus()
}

function insertBlock(view, type) {
  const state = view.state
  const changes = []

  if (type === 'code') {
    const insert = '```\n\n```'
    for (const range of state.selection.ranges) {
      const line = state.doc.lineAt(range.from)
      changes.push({ from: line.from, insert: insert + '\n' })
    }
  } else if (type === 'quote') {
    const seen = new Set()
    for (const range of state.selection.ranges) {
      const line = state.doc.lineAt(range.from)
      if (seen.has(line.number)) continue
      seen.add(line.number)
      changes.push({ from: line.from, insert: '> ' })
    }
  }

  if (changes.length) {
    view.dispatch({ changes })
  }
  view.focus()
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Editor({ note, onChange, onTitleChange }) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Mount/remount CodeMirror when note.id changes
  useEffect(() => {
    if (!editorRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: note.content,
        extensions: [
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(markdownHighlight),
          baseTheme,
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
        ],
      }),
      parent: editorRef.current,
    })

    viewRef.current = view
    view.focus()

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external content changes (e.g. checkbox toggle from Preview)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== note.content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: note.content } })
    }
  }, [note.content])

  const getView = useCallback(() => viewRef.current, [])

  return (
    <div className="editor-pane">
      <div className="editor-title-bar">
        <span className="editor-label">editor</span>
      </div>
      <input
        className="title-input"
        type="text"
        value={note.title}
        onChange={e => onTitleChange(e.target.value)}
        placeholder="Note title..."
        spellCheck={false}
      />

      {/* Formatting toolbar */}
      <div className="toolbar">
        <button className="toolbar-btn" title="Heading 1" onClick={() => getView() && insertHeading(getView(), 1)}>H1</button>
        <button className="toolbar-btn" title="Heading 2" onClick={() => getView() && insertHeading(getView(), 2)}>H2</button>
        <button className="toolbar-btn" title="Heading 3" onClick={() => getView() && insertHeading(getView(), 3)}>H3</button>
        <span className="toolbar-sep" />
        <button className="toolbar-btn toolbar-btn-bold" title="Bold" onClick={() => getView() && toggleWrap(getView(), '**', '**')}>B</button>
        <button className="toolbar-btn toolbar-btn-italic" title="Italic" onClick={() => getView() && toggleWrap(getView(), '_', '_')}>I</button>
        <button className="toolbar-btn toolbar-btn-code" title="Inline code" onClick={() => getView() && toggleWrap(getView(), '`', '`')}>`</button>
        <span className="toolbar-sep" />
        <button className="toolbar-btn" title="Code block" onClick={() => getView() && insertBlock(getView(), 'code')}>&#123;&#125;</button>
        <button className="toolbar-btn" title="Blockquote" onClick={() => getView() && insertBlock(getView(), 'quote')}>&gt;</button>
        <span className="toolbar-sep" />
        <button className="toolbar-btn" title="Checkbox" onClick={() => getView() && insertCheckbox(getView())}>☐</button>
      </div>

      <div className="cm-wrapper" ref={editorRef} />

      <div className="editor-statusbar">
        <span>{note.content.split('\n').length} ln</span>
        <span>{note.content.length} ch</span>
        <span>markdown</span>
      </div>
    </div>
  )
}
