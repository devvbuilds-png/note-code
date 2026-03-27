import { useState, useEffect, useCallback } from 'react'
import NoteCanvas from './components/NoteCanvas'
import Editor from './components/Editor'
import Preview from './components/Preview'
import { FONT_OPTIONS, FONT_SIZE_MIN, FONT_SIZE_MAX } from './constants'
import './App.css'

const STORAGE_KEY     = 'notecode_notes'
const FOLDERS_KEY     = 'notecode_folders'
const TRASH_KEY       = 'notecode_trash'
const FONT_SIZE_KEY   = 'notecode_font_size'
const FONT_FAMILY_KEY = 'notecode_font_family'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function createNote(title = 'Untitled') {
  return {
    id: generateId(),
    title,
    content: '',
    folder: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    canvasX: 600,
    canvasY: 400,
  }
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

function loadFolders() {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

function loadTrash() {
  try {
    const raw = localStorage.getItem(TRASH_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveTrash(trash) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash))
}

function hashId(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return (h >>> 0) / 0xFFFFFFFF
}

function assignMissingFolderPositions(folders) {
  const n = folders.length
  return folders.map((f, i) => {
    if (f.canvasX != null) return f
    const x = 300 + i * 240 - ((n - 1) * 120)
    return { ...f, canvasX: x, canvasY: 200 }
  })
}

function assignMissingNotePositions(notes, folders) {
  const folderNoteCount = {}
  return notes.map(note => {
    if (note.canvasX != null) return note
    if (note.folder) {
      const folder = folders.find(f => f.id === note.folder)
      if (folder) {
        folderNoteCount[note.folder] = (folderNoteCount[note.folder] ?? 0) + 1
        const idx = folderNoteCount[note.folder] - 1
        const angle = -Math.PI / 2 + idx * 0.9
        const r = 120 + idx * 15
        return {
          ...note,
          canvasX: folder.canvasX + Math.cos(angle) * r,
          canvasY: folder.canvasY + Math.sin(angle) * r,
        }
      }
    }
    const h1 = hashId(note.id)
    const h2 = hashId(note.id + 'y')
    return { ...note, canvasX: 100 + h1 * 1300, canvasY: 380 + h2 * 900 }
  })
}

const CHECKBOX_RE = /^\[([ x])\]/

function toggleAndReorderCheckbox(content, idx) {
  const lines = content.split('\n')
  let count = 0, targetLine = -1
  for (let i = 0; i < lines.length; i++) {
    if (CHECKBOX_RE.test(lines[i])) {
      if (count === idx) { targetLine = i; break }
      count++
    }
  }
  if (targetLine === -1) return content
  const wasChecked = lines[targetLine].startsWith('[x]')
  lines[targetLine] = wasChecked
    ? lines[targetLine].replace('[x]', '[ ]')
    : lines[targetLine].replace('[ ]', '[x]')
  let start = targetLine, end = targetLine
  while (start > 0 && CHECKBOX_RE.test(lines[start - 1])) start--
  while (end < lines.length - 1 && CHECKBOX_RE.test(lines[end + 1])) end++
  const block = lines.slice(start, end + 1)
  block.sort((a, b) => {
    const aChecked = a.startsWith('[x]'), bChecked = b.startsWith('[x]')
    if (aChecked === bChecked) return 0
    return aChecked ? -1 : 1
  })
  lines.splice(start, end - start + 1, ...block)
  return lines.join('\n')
}

export default function App() {
  const [notes, setNotes] = useState(() => {
    const savedFolders = assignMissingFolderPositions(loadFolders())
    const saved = loadNotes()
    if (saved.length > 0) return assignMissingNotePositions(saved, savedFolders)
    const welcome = createNote('Welcome to NoteCode')
    welcome.canvasX = 500; welcome.canvasY = 350
    welcome.content = `# Welcome to NoteCode

A terminal-inspired note-taking app powered by Markdown.

## Three Modes

- Editor  — write and edit your notes in raw Markdown
- Editor + Reader — write while reading your notes in clean, formatted view.
- Reader - Read and reflect on your notes.

> Toggle from the top right corner


## Features

  • Live Markdown preview
  • Syntax highlighting for code blocks
  • Search across all notes
  • Stored locally in your browser


## Markdown Cheatsheet

**bold** → bold
*italic* → italic
\`inline code\` → inline code
# Heading → large heading
## Heading 2 → medium heading
> blockquote     → indented quote block
- item           → bullet list
1. item          → numbered list
\`\`\`code\`\`\`         → syntax-highlighted code block
[text](url)      → clickable link

`
    return [welcome]
  })

  const [folders, setFolders] = useState(() =>
    assignMissingFolderPositions(loadFolders())
  )
  const [trash, setTrash] = useState(loadTrash)

  const [activeId, setActiveId] = useState(() => {
    const saved = loadNotes()
    return saved.length > 0 ? saved[0].id : null
  })

  // 'canvas' | 'editor'
  const [view, setView] = useState('canvas')
  const [mode, setMode] = useState('split')

  const [fontSize, setFontSize] = useState(() => {
    const saved = parseInt(localStorage.getItem(FONT_SIZE_KEY), 10)
    return (saved >= FONT_SIZE_MIN && saved <= FONT_SIZE_MAX) ? saved : 13
  })
  const [fontFamily, setFontFamily] = useState(() => {
    const saved = localStorage.getItem(FONT_FAMILY_KEY)
    return FONT_OPTIONS.find(f => f.key === saved) ? saved : 'jetbrains-mono'
  })

  useEffect(() => {
    if (activeId === null && notes.length > 0) setActiveId(notes[0].id)
  }, [notes, activeId])

  useEffect(() => { saveNotes(notes) }, [notes])
  useEffect(() => { saveFolders(folders) }, [folders])
  useEffect(() => { saveTrash(trash) }, [trash])
  useEffect(() => { localStorage.setItem(FONT_SIZE_KEY, String(fontSize)) }, [fontSize])
  useEffect(() => { localStorage.setItem(FONT_FAMILY_KEY, fontFamily) }, [fontFamily])

  const activeNote = notes.find(n => n.id === activeId) ?? null

  // Select a note and open the editor view
  const handleSelect = useCallback((id) => {
    setActiveId(id)
    setView('editor')
  }, [])

  // Create a new note and open it immediately in the editor
  const newNote = useCallback((pos) => {
    const note = createNote()
    if (pos) { note.canvasX = pos.x; note.canvasY = pos.y }
    setNotes(prev => [note, ...prev])
    setActiveId(note.id)
    setView('editor')
    return note.id
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const note = prev.find(n => n.id === id)
      if (note) setTrash(t => [{ ...note, deletedAt: Date.now() }, ...t])
      const next = prev.filter(n => n.id !== id)
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null)
        setView('canvas')
      }
      return next
    })
  }, [activeId])

  const restoreNote = useCallback((id) => {
    setTrash(prev => {
      const note = prev.find(n => n.id === id)
      if (note) {
        const { deletedAt, ...restored } = note
        setNotes(ns => [restored, ...ns])
        setActiveId(restored.id)
      }
      return prev.filter(n => n.id !== id)
    })
  }, [])

  const permanentDelete = useCallback((id) => {
    setTrash(prev => prev.filter(n => n.id !== id))
  }, [])

  const emptyTrash = useCallback(() => setTrash([]), [])

  const decreaseFontSize = useCallback(() => setFontSize(s => Math.max(FONT_SIZE_MIN, s - 1)), [])
  const increaseFontSize = useCallback(() => setFontSize(s => Math.min(FONT_SIZE_MAX, s + 1)), [])

  const updateNote = useCallback((id, changes) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n
    ))
  }, [])

  const handleCheckboxToggle = useCallback((idx) => {
    if (!activeId) return
    setNotes(prev => prev.map(n => {
      if (n.id !== activeId) return n
      return { ...n, content: toggleAndReorderCheckbox(n.content, idx), updatedAt: Date.now() }
    }))
  }, [activeId])

  const createFolder = useCallback((name, pos) => {
    const folder = { id: generateId(), name }
    folder.canvasX = pos?.x ?? 400
    folder.canvasY = pos?.y ?? 300
    setFolders(prev => [...prev, folder])
  }, [])

  const deleteFolder = useCallback((id) => {
    setFolders(prev => prev.filter(f => f.id !== id))
    setNotes(prev => prev.map(n => n.folder === id ? { ...n, folder: null } : n))
  }, [])

  const renameFolder = useCallback((id, name) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))
  }, [])

  const moveNoteToFolder = useCallback((noteId, folderId) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, folder: folderId } : n))
  }, [])

  const handleNoteMove = useCallback((noteId, { x, y }) => {
    setNotes(prev => prev.map(n => n.id === noteId ? { ...n, canvasX: x, canvasY: y } : n))
  }, [])

  const handleFolderMove = useCallback((folderId, { x, y }) => {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, canvasX: x, canvasY: y } : f))
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        newNote()
      }
      if (e.key === 'Escape' && view === 'editor') {
        setView('canvas')
      }
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey && view === 'editor') {
        const active = document.activeElement
        if (!active?.isContentEditable && active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          setMode(m => m === 'read' ? 'edit' : 'read')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [newNote, view])

  // ── Canvas view ─────────────────────────────────────────────────────────────
  if (view === 'canvas') {
    return (
      <div className="app">
        <NoteCanvas
          notes={notes}
          folders={folders}
          activeId={activeId}
          onSelect={handleSelect}
          onNew={newNote}
          onDelete={deleteNote}
          onNoteMove={handleNoteMove}
          onFolderMove={handleFolderMove}
          onNoteFolder={moveNoteToFolder}
          onFolderCreate={createFolder}
          onFolderDelete={deleteFolder}
          onFolderRename={renameFolder}
          trash={trash}
          onRestore={restoreNote}
          onPermanentDelete={permanentDelete}
          onEmptyTrash={emptyTrash}
        />
      </div>
    )
  }

  // ── Editor view ─────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="editor-topbar">
        <button
          className="editor-back-btn"
          onClick={() => setView('canvas')}
          title="Back to canvas (Esc)"
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
            <path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          canvas
        </button>

        <span className="editor-topbar-divider" />

        <div className="editor-note-info">
          <span className="editor-note-title">
            {activeNote?.title || 'Untitled'}
          </span>
          {activeNote?.folder && (() => {
            const folderName = folders.find(f => f.id === activeNote.folder)?.name
            return folderName ? (
              <span className="editor-note-folder">in {folderName}</span>
            ) : null
          })()}
        </div>

        <div className="editor-topbar-right">
          <div className="mode-switcher">
            <button className={`mode-btn${mode === 'edit'  ? ' active' : ''}`} onClick={() => setMode('edit')}  title="Editor only">edit</button>
            <button className={`mode-btn${mode === 'split' ? ' active' : ''}`} onClick={() => setMode('split')} title="Editor + Preview">split</button>
            <button className={`mode-btn${mode === 'read'  ? ' active' : ''}`} onClick={() => setMode('read')}  title="Reader only (R)">read</button>
          </div>
          <button className="icon-btn new-note-btn" onClick={() => newNote()} title="New note (Ctrl+N)">+ new</button>
        </div>
      </header>

      <main
        className="main-area"
        style={{
          fontSize: fontSize + 'px',
          '--font-mono': FONT_OPTIONS.find(f => f.key === fontFamily)?.stack ?? 'inherit',
        }}
      >
        {activeNote ? (
          <>
            {(mode === 'edit' || mode === 'split') && (
              <Editor
                note={activeNote}
                onChange={(content) => updateNote(activeNote.id, { content })}
                onTitleChange={(title) => updateNote(activeNote.id, { title })}
                fontSize={fontSize}
                fontFamily={fontFamily}
                onFontSizeDecrease={decreaseFontSize}
                onFontSizeIncrease={increaseFontSize}
                onFontFamilyChange={setFontFamily}
              />
            )}
            {mode === 'split' && (
              <Preview
                content={activeNote.content}
                overlay
                onClose={() => setMode('edit')}
                onCheckboxToggle={handleCheckboxToggle}
              />
            )}
            {mode === 'read' && (
              <Preview
                content={activeNote.content}
                onCheckboxToggle={handleCheckboxToggle}
              />
            )}
          </>
        ) : (
          <div className="empty-state">
            <p className="empty-prompt">$ <span className="cursor">_</span></p>
            <p>No note selected.</p>
            <button className="btn-primary" onClick={() => setView('canvas')}>← Back to canvas</button>
          </div>
        )}
      </main>
    </div>
  )
}
