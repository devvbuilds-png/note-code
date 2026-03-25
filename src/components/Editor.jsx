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
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', color: '#a78bfa' },
  { tag: tags.heading2, fontSize: '1.3em', fontWeight: '700', color: '#93c5fd' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '600', color: '#86efac' },
  { tag: tags.strong,   fontWeight: 'bold', color: '#fb923c' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#34d399' },
  { tag: tags.monospace, background: '#0d1525', color: '#fb923c', borderRadius: '3px' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#4a6080' },
  { tag: tags.link,     color: '#60a5fa' },
  { tag: tags.url,      color: '#60a5fa' },
  { tag: tags.quote,    color: '#4a6080', fontStyle: 'italic' },
  // Dim the syntax punctuation (# ** _ ``` etc.)
  { tag: tags.processingInstruction, color: '#2d4060' },
  { tag: tags.punctuation,           color: '#2d4060' },
  // Code block syntax tokens
  { tag: tags.keyword,              color: '#c084fc' },
  { tag: tags.string,               color: '#86efac' },
  { tag: tags.number,               color: '#fdba74' },
  { tag: tags.bool,                 color: '#fdba74' },
  { tag: tags.null,                 color: '#fdba74' },
  { tag: tags.comment,              color: '#3e5478', fontStyle: 'italic' },
  { tag: tags.variableName,         color: '#fca5a5' },
  { tag: tags.function(tags.variableName), color: '#93c5fd' },
  { tag: tags.typeName,             color: '#fde68a' },
  { tag: tags.className,            color: '#fde68a' },
  { tag: tags.operator,             color: '#67e8f9' },
  { tag: tags.meta,                 color: '#67e8f9' },
  { tag: tags.tagName,              color: '#fca5a5' },
  { tag: tags.attributeName,        color: '#fdba74' },
  { tag: tags.attributeValue,       color: '#86efac' },
])

// ── Base EditorView theme ────────────────────────────────────────────────────
const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    background: '#070912',
    color: '#c4d2ed',
    fontSize: 'inherit',
  },
  '.cm-scroller': {
    fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
    lineHeight: '1.75',
    overflow: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#1b2540 transparent',
  },
  '.cm-content': {
    padding: '18px',
    caretColor: '#a78bfa',
  },
  '.cm-cursor': { borderLeftColor: '#a78bfa', borderLeftWidth: '2px' },
  '.cm-activeLine': { background: 'rgba(139,92,246,0.04)' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(139,92,246,0.2) !important' },
  '.cm-focused .cm-selectionBackground': { background: 'rgba(139,92,246,0.2)' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(139,92,246,0.2)' },
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
