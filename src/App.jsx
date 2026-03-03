import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import Preview from './components/Preview'
import './App.css'

const STORAGE_KEY = 'notecode_notes'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function createNote(title = 'Untitled') {
  return {
    id: generateId(),
    title,
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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

export default function App() {
  const [notes, setNotes] = useState(() => {
    const saved = loadNotes()
    if (saved.length > 0) return saved
    const welcome = createNote('Welcome to NoteCode')
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


##   Markdown Cheatsheet

  **bold**         → bold
  *italic*         → italic
  `inline code`    → inline code
  # Heading → large heading
  ## Heading 2 → medium heading
  > blockquote     → indented quote block
  - item           → bullet list
  1. item          → numbered list
```code```         → syntax-highlighted code block
  [text](url)      → clickable link

`
    return [welcome]
  })

  const [activeId, setActiveId] = useState(() => {
    const saved = loadNotes()
    return saved.length > 0 ? saved[0].id : null
  })

  const [search, setSearch] = useState('')
  const [mode, setMode] = useState('split') // 'edit' | 'split' | 'read'
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    if (activeId === null && notes.length > 0) {
      setActiveId(notes[0].id)
    }
  }, [notes, activeId])

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  const activeNote = notes.find(n => n.id === activeId) ?? null

  const newNote = useCallback(() => {
    const note = createNote()
    setNotes(prev => [note, ...prev])
    setActiveId(note.id)
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id)
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null)
      }
      return next
    })
  }, [activeId])

  const updateNote = useCallback((id, changes) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n
    ))
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        newNote()
      }
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const active = document.activeElement
        if (!active?.isContentEditable && active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
          setMode(m => m === 'read' ? 'edit' : 'read')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [newNote])

  const filteredNotes = search.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="icon-btn topbar-menu"
          onClick={() => setSidebarOpen(o => !o)}
          title="Toggle sidebar"
        >
          <span className="icon-hamburger">&#9776;</span>
        </button>
        <span className="topbar-title">
          <span className="topbar-prompt">~/</span>NoteCode
        </span>
        <div className="topbar-actions">
          <div className="mode-switcher">
            <button
              className={`mode-btn${mode === 'edit' ? ' active' : ''}`}
              onClick={() => setMode('edit')}
              title="Editor only"
            >[ ]</button>
            <button
              className={`mode-btn${mode === 'split' ? ' active' : ''}`}
              onClick={() => setMode('split')}
              title="Editor + Preview"
            >[|]</button>
            <button
              className={`mode-btn${mode === 'read' ? ' active' : ''}`}
              onClick={() => setMode('read')}
              title="Reader only  (R)"
            >[▶]</button>
          </div>
          <button className="icon-btn new-note-btn" onClick={newNote} title="New note (Ctrl+N)">
            + new
          </button>
        </div>
      </header>

      <div className="workspace">
        {sidebarOpen && (
          <Sidebar
            notes={filteredNotes}
            activeId={activeId}
            search={search}
            onSearch={setSearch}
            onSelect={setActiveId}
            onNew={newNote}
            onDelete={deleteNote}
          />
        )}

        <main className="main-area">
          {activeNote ? (
            <>
              {(mode === 'edit' || mode === 'split') && (
                <Editor
                  note={activeNote}
                  onChange={(content) => updateNote(activeNote.id, { content })}
                  onTitleChange={(title) => updateNote(activeNote.id, { title })}
                />
              )}
              {mode === 'split' && (
                <Preview
                  content={activeNote.content}
                  overlay
                  onClose={() => setMode('edit')}
                />
              )}
              {mode === 'read' && (
                <Preview content={activeNote.content} />
              )}
            </>
          ) : (
            <div className="empty-state">
              <p className="empty-prompt">$ <span className="cursor">_</span></p>
              <p>No note selected.</p>
              <button className="btn-primary" onClick={newNote}>+ Create your first note</button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
