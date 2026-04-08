import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import JSZip from 'jszip'

// ── Viewport persistence ──────────────────────────────────────────────────────
const CANVAS_VP_KEY = 'notecode_canvas'

function loadViewport() {
  try {
    const raw = localStorage.getItem(CANVAS_VP_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { panX: 80, panY: 80, zoom: 1 }
}

function saveViewport(vp) {
  localStorage.setItem(CANVAS_VP_KEY, JSON.stringify(vp))
}

// ── Zoom math ─────────────────────────────────────────────────────────────────
function zoomAt(panX, panY, zoom, delta, mx, my) {
  const newZoom = Math.min(3, Math.max(0.2, zoom * (1 - delta * 0.001)))
  const scale   = newZoom / zoom
  return { zoom: newZoom, panX: mx - scale * (mx - panX), panY: my - scale * (my - panY) }
}

// ── Fan-out positions ─────────────────────────────────────────────────────────
function computeFanPositions(fx, fy, count) {
  if (count === 0) return []
  const r = 160 + count * 16
  return Array.from({ length: count }, (_, i) => ({
    x: fx + Math.cos(-Math.PI / 2 + i * (2 * Math.PI) / count) * r,
    y: fy + Math.sin(-Math.PI / 2 + i * (2 * Math.PI) / count) * r,
  }))
}

// ── FolderNode ────────────────────────────────────────────────────────────────
function FolderNode({ folder, isExpanded, isDropTarget, isDragging, noteCount, onDoubleClick, renamingId, renameName, onRenameChange, onRenameBlur, onRenameKeyDown, onDelete }) {
  return (
    <div
      className={[
        'canvas-folder',
        isExpanded   ? 'expanded'    : '',
        isDropTarget ? 'drop-target' : '',
        isDragging   ? 'dragging'    : '',
      ].filter(Boolean).join(' ')}
      data-folder-id={folder.id}
      style={{ left: folder.canvasX, top: folder.canvasY }}
      onDoubleClick={onDoubleClick}
    >
      <div className="canvas-folder-icon">
        <svg width="16" height="13" viewBox="0 0 14 12" fill="none">
          <path d="M0 2C0 0.9 0.9 0 2 0H5.5L7 1.5H12C13.1 1.5 14 2.4 14 3.5V10C14 11.1 13.1 12 12 12H2C0.9 12 0 11.1 0 10V2Z" fill="currentColor" opacity=".3"/>
          <path d="M0 3.5C0 2.4 0.9 1.5 2 1.5H12C13.1 1.5 14 2.4 14 3.5V10C14 11.1 13.1 12 12 12H2C0.9 12 0 11.1 0 10V3.5Z" stroke="currentColor" strokeWidth="1" fill="none" opacity=".7"/>
        </svg>
      </div>
      {renamingId === folder.id ? (
        <input
          className="canvas-folder-rename"
          value={renameName}
          onChange={onRenameChange}
          onBlur={onRenameBlur}
          onKeyDown={onRenameKeyDown}
          autoFocus
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="canvas-folder-name">{folder.name}</span>
      )}
      <span className="canvas-folder-count">{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
      <button
        className="canvas-folder-delete"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(folder.id) }}
        title="Delete folder"
      >×</button>
    </div>
  )
}

// ── NoteNode ──────────────────────────────────────────────────────────────────
function NoteNode({ note, displayX, displayY, isActive, isDragging, isFanning, onDelete }) {
  return (
    <div
      className={[
        'canvas-note',
        isActive   ? 'active'   : '',
        isDragging ? 'dragging' : '',
        isFanning  ? 'fanning'  : '',
      ].filter(Boolean).join(' ')}
      data-note-id={note.id}
      style={{ left: displayX, top: displayY }}
    >
      <div className="canvas-note-dot" />
      <span className="canvas-note-label">{note.title || 'Untitled'}</span>
      <button
        className="canvas-note-delete"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onDelete(note.id) }}
        title="Delete note"
      >×</button>
    </div>
  )
}

// ── TrashPanel ────────────────────────────────────────────────────────────────
function TrashPanel({ trash, onRestore, onPermanentDelete, onEmptyTrash, onClose }) {
  return (
    <div className="canvas-trash-panel">
      <div className="canvas-trash-header">
        <span className="canvas-trash-title">Trash ({trash.length})</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {trash.length > 0 && (
            <button className="canvas-trash-empty" onClick={onEmptyTrash}>Empty trash</button>
          )}
          <button className="canvas-trash-close" onClick={onClose}>✕</button>
        </div>
      </div>
      {trash.length === 0 ? (
        <p className="canvas-trash-empty-state">Trash is empty.</p>
      ) : (
        <div className="canvas-trash-list">
          {trash.map(note => (
            <div key={note.id} className="canvas-trash-item">
              <span className="canvas-trash-item-title">{note.title || 'Untitled'}</span>
              <div className="canvas-trash-actions">
                <button onClick={() => onRestore(note.id)} title="Restore">↩</button>
                <button onClick={() => onPermanentDelete(note.id)} title="Delete forever">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CanvasSidebar ─────────────────────────────────────────────────────────────
function CanvasSidebar({ notes, folders, activeId, onSelect, onDelete }) {
  const [expanded, setExpanded]   = useState(() => new Set(folders.map(f => f.id)))
  const [sbSearch, setSbSearch]   = useState('')

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const q = sbSearch.toLowerCase().trim()
  const filtered = useMemo(() =>
    q ? notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      : notes,
    [notes, q]
  )

  const unfiledNotes   = filtered.filter(n => !n.folder)
  const folderHasMatch = (fid) => filtered.some(n => n.folder === fid)

  return (
    <div className="csb">
      <div className="csb-search-wrap">
        <input
          className="csb-search"
          placeholder="search…"
          value={sbSearch}
          onChange={e => setSbSearch(e.target.value)}
        />
        {sbSearch && (
          <button className="csb-search-clear" onClick={() => setSbSearch('')}>×</button>
        )}
      </div>

      <div className="csb-list">
        {folders.map(folder => {
          const folderNotes = filtered.filter(n => n.folder === folder.id)
          if (q && !folderHasMatch(folder.id)) return null
          const isOpen = expanded.has(folder.id)
          return (
            <div key={folder.id} className="csb-folder-group">
              <button
                className="csb-folder-row"
                onClick={() => toggle(folder.id)}
              >
                <span className={`csb-arrow${isOpen ? ' open' : ''}`}>▸</span>
                <svg className="csb-folder-icon" width="13" height="11" viewBox="0 0 14 12" fill="none">
                  <path d="M0 3.5C0 2.4 0.9 1.5 2 1.5H12C13.1 1.5 14 2.4 14 3.5V10C14 11.1 13.1 12 12 12H2C0.9 12 0 11.1 0 10V3.5Z" fill="currentColor" opacity=".15"/>
                  <path d="M0 3.5C0 2.4 0.9 1.5 2 1.5H12C13.1 1.5 14 2.4 14 3.5V10C14 11.1 13.1 12 12 12H2C0.9 12 0 11.1 0 10V3.5Z" stroke="currentColor" strokeWidth="1" fill="none" opacity=".5"/>
                </svg>
                <span className="csb-folder-name">{folder.name}</span>
                <span className="csb-folder-count">{notes.filter(n => n.folder === folder.id).length}</span>
              </button>
              {isOpen && folderNotes.map(note => (
                <div
                  key={note.id}
                  className={`csb-note${note.id === activeId ? ' active' : ''}`}
                  onClick={() => onSelect(note.id)}
                >
                  <span className="csb-note-dot" />
                  <span className="csb-note-title">{note.title || 'Untitled'}</span>
                  <button
                    className="csb-note-del"
                    onClick={e => { e.stopPropagation(); onDelete(note.id) }}
                    title="Delete"
                  >×</button>
                </div>
              ))}
            </div>
          )
        })}

        {unfiledNotes.length > 0 && (
          <div className="csb-unfiled-group">
            {folders.length > 0 && <div className="csb-section-label">unfiled</div>}
            {unfiledNotes.map(note => (
              <div
                key={note.id}
                className={`csb-note${note.id === activeId ? ' active' : ''}`}
                onClick={() => onSelect(note.id)}
              >
                <span className="csb-note-dot" />
                <span className="csb-note-title">{note.title || 'Untitled'}</span>
                <button
                  className="csb-note-del"
                  onClick={e => { e.stopPropagation(); onDelete(note.id) }}
                  title="Delete"
                >×</button>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="csb-empty">No notes found.</p>
        )}
      </div>
    </div>
  )
}

// ── Main NoteCanvas ───────────────────────────────────────────────────────────
export default function NoteCanvas({
  notes, folders, activeId,
  onSelect, onNew, onDelete,
  onNoteMove, onFolderMove,
  onNoteFolder,
  onFolderCreate, onFolderDelete, onFolderRename,
  trash, onRestore, onPermanentDelete, onEmptyTrash,
}) {
  const vp0 = loadViewport()
  const [panX, setPanX] = useState(vp0.panX)
  const [panY, setPanY] = useState(vp0.panY)
  const [zoom, setZoom] = useState(vp0.zoom)

  const [dragState, setDragState]             = useState(null)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [dropTargetId, setDropTargetId]       = useState(null)
  const [renamingFolderId, setRenamingFolderId] = useState(null)
  const [renameName, setRenameName]           = useState('')
  const [trashOpen, setTrashOpen]             = useState(false)
  const [sidebarOpen, setSidebarOpen]         = useState(true)
  const [search, setSearch]                   = useState('')
  const [newFolderName, setNewFolderName]     = useState('')
  const [showFolderInput, setShowFolderInput] = useState(false)

  const viewportRef = useRef()
  const dragRef     = useRef(dragState)
  useEffect(() => { dragRef.current = dragState }, [dragState])

  // persist viewport
  useEffect(() => { saveViewport({ panX, panY, zoom }) }, [panX, panY, zoom])

  // non-passive wheel for zoom
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const next = zoomAt(panX, panY, zoom, e.deltaY, e.clientX - rect.left, e.clientY - rect.top)
      setPanX(next.panX); setPanY(next.panY); setZoom(next.zoom)
      el.style.setProperty('--pan-x', next.panX)
      el.style.setProperty('--pan-y', next.panY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // sync grid offset
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    el.style.setProperty('--pan-x', panX)
    el.style.setProperty('--pan-y', panY)
  }, [panX, panY])

  // ── Pointer handlers ──────────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()

    const noteEl   = e.target.closest('[data-note-id]')
    const folderEl = e.target.closest('[data-folder-id]')

    if (noteEl && !e.target.closest('button')) {
      const noteId = noteEl.dataset.noteId
      const note   = notes.find(n => n.id === noteId)
      if (!note) return

      // Determine display position (fan or stored)
      let startItemX = note.canvasX, startItemY = note.canvasY
      if (note.folder && expandedFolders.has(note.folder)) {
        const folder   = folders.find(f => f.id === note.folder)
        if (folder) {
          const siblings = notes.filter(n => n.folder === note.folder)
          const idx      = siblings.findIndex(n => n.id === noteId)
          const fanPos   = computeFanPositions(folder.canvasX, folder.canvasY, siblings.length)
          if (fanPos[idx]) { startItemX = fanPos[idx].x; startItemY = fanPos[idx].y }
        }
      }

      setDragState({
        type: 'item', kind: 'note', id: noteId,
        startClientX: e.clientX, startClientY: e.clientY,
        startItemX, startItemY,
        liveX: startItemX, liveY: startItemY,
        hasMoved: false,
      })
      viewportRef.current?.setPointerCapture(e.pointerId)
      return
    }

    if (folderEl && !e.target.closest('button') && !e.target.closest('input')) {
      const folderId = folderEl.dataset.folderId
      const folder   = folders.find(f => f.id === folderId)
      if (!folder) return
      setDragState({
        type: 'item', kind: 'folder', id: folderId,
        startClientX: e.clientX, startClientY: e.clientY,
        startItemX: folder.canvasX, startItemY: folder.canvasY,
        liveX: folder.canvasX, liveY: folder.canvasY,
        hasMoved: false,
      })
      viewportRef.current?.setPointerCapture(e.pointerId)
      return
    }

    // background pan
    setDragState({
      type: 'pan',
      startClientX: e.clientX, startClientY: e.clientY,
      startPanX: panX, startPanY: panY,
    })
    viewportRef.current?.setPointerCapture(e.pointerId)
  }, [notes, folders, expandedFolders, panX, panY])

  const handlePointerMove = useCallback((e) => {
    const d = dragRef.current
    if (!d) return

    if (d.type === 'pan') {
      setPanX(d.startPanX + (e.clientX - d.startClientX))
      setPanY(d.startPanY + (e.clientY - d.startClientY))
      return
    }

    if (d.type === 'item') {
      const dx = e.clientX - d.startClientX
      const dy = e.clientY - d.startClientY
      if (!d.hasMoved && Math.hypot(dx, dy) < 5) return

      const newX = d.startItemX + dx / zoom
      const newY = d.startItemY + dy / zoom
      setDragState(prev => ({ ...prev, liveX: newX, liveY: newY, hasMoved: true }))

      if (d.kind === 'note') {
        const hit = folders.find(f =>
          newX >= f.canvasX - 90 && newX <= f.canvasX + 90 &&
          newY >= f.canvasY - 46 && newY <= f.canvasY + 46
        )
        setDropTargetId(hit ? hit.id : null)
      }
    }
  }, [zoom, folders])

  const handlePointerUp = useCallback((e) => {
    const d = dragRef.current
    if (!d) return

    if (d.type === 'item' && d.hasMoved) {
      if (d.kind === 'note') {
        const note = notes.find(n => n.id === d.id)
        if (dropTargetId) {
          // Dropped onto a folder card → assign to it
          onNoteFolder(d.id, dropTargetId)
        } else if (note?.folder) {
          // If dragged outside the fan-out radius of its own folder → unfile
          const parentFolder = folders.find(f => f.id === note.folder)
          if (parentFolder) {
            const siblingCount = notes.filter(n => n.folder === note.folder).length
            const fanRadius    = 160 + siblingCount * 16
            const dist         = Math.hypot(d.liveX - parentFolder.canvasX, d.liveY - parentFolder.canvasY)
            if (dist > fanRadius + 40) {
              onNoteFolder(d.id, null)
            }
          }
        }
        onNoteMove(d.id, { x: d.liveX, y: d.liveY })
      } else if (d.kind === 'folder') {
        onFolderMove(d.id, { x: d.liveX, y: d.liveY })
      }
    } else if (d.type === 'item' && !d.hasMoved) {
      if (d.kind === 'note') {
        onSelect(d.id) // parent switches to editor view
      } else if (d.kind === 'folder') {
        setExpandedFolders(prev => {
          const next = new Set(prev)
          if (next.has(d.id)) next.delete(d.id)
          else next.add(d.id)
          return next
        })
      }
    }

    setDragState(null)
    setDropTargetId(null)
  }, [notes, dropTargetId, onNoteMove, onFolderMove, onNoteFolder, onSelect])

  // ── New note at canvas center ─────────────────────────────────────────────
  const handleNewNote = useCallback(() => {
    const el = viewportRef.current
    if (!el) { onNew(); return }
    const rect = el.getBoundingClientRect()
    onNew({ x: (rect.width / 2 - panX) / zoom, y: (rect.height / 2 - panY) / zoom })
  }, [panX, panY, zoom, onNew])

  // ── New folder at canvas center ───────────────────────────────────────────
  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim() || 'New Folder'
    const el   = viewportRef.current
    const cx   = el ? (el.getBoundingClientRect().width  / 2 - panX) / zoom : 400
    const cy   = el ? (el.getBoundingClientRect().height / 2 - panY) / zoom : 300
    onFolderCreate(name, { x: cx, y: cy })
    setNewFolderName(''); setShowFolderInput(false)
  }, [newFolderName, panX, panY, zoom, onFolderCreate])

  const resetViewport = useCallback(() => { setPanX(80); setPanY(80); setZoom(1) }, [])

  const handleExport = useCallback(async () => {
    const zip = new JSZip()
    const folderMap = {}
    for (const f of folders) folderMap[f.id] = f.name

    const usedNames = {}
    function safeName(title, folder) {
      const base = (title || 'Untitled').replace(/[<>:"/\\|?*]/g, '_').trim() || 'Untitled'
      const key = (folder || '') + '/' + base
      usedNames[key] = (usedNames[key] || 0) + 1
      return usedNames[key] > 1 ? `${base} (${usedNames[key] - 1})` : base
    }

    for (const note of notes) {
      const folderName = note.folder && folderMap[note.folder]
      const fileName = safeName(note.title, note.folder) + '.md'
      const path = folderName ? `${folderName}/${fileName}` : fileName
      zip.file(path, note.content || '')
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notecode-backup-${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }, [notes, folders])

  // ── Filter notes ──────────────────────────────────────────────────────────
  // Folder notes are hidden unless their folder is expanded (fan-out)
  const q = search.toLowerCase().trim()
  const visibleNotes = notes.filter(n => {
    if (n.folder) return expandedFolders.has(n.folder)  // only show when expanded
    if (q) return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    return true
  })

  // ── Ephemeral fan positions ───────────────────────────────────────────────
  const noteDisplayPos  = {}
  const fanningNoteIds  = new Set()

  for (const folder of folders) {
    if (expandedFolders.has(folder.id)) {
      const children = notes.filter(n => n.folder === folder.id)
      const fanPos   = computeFanPositions(folder.canvasX, folder.canvasY, children.length)
      children.forEach((n, i) => {
        noteDisplayPos[n.id] = fanPos[i]
        fanningNoteIds.add(n.id)
      })
    }
  }

  const draggingNoteId   = dragState?.kind === 'note'   ? dragState.id : null
  const draggingFolderId = dragState?.kind === 'folder' ? dragState.id : null
  const isPanning        = dragState?.type === 'pan'

  return (
    <div className="canvas-screen">
      {/* Canvas header */}
      <header className="canvas-header">
        <button
          className={`canvas-sidebar-toggle${sidebarOpen ? ' active' : ''}`}
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Hide list' : 'Show list'}
        >
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
            <rect width="14" height="1.5" rx="0.75" fill="currentColor"/>
            <rect y="5.25" width="10" height="1.5" rx="0.75" fill="currentColor"/>
            <rect y="10.5" width="14" height="1.5" rx="0.75" fill="currentColor"/>
          </svg>
        </button>
        <span className="canvas-header-title">
          <span className="canvas-header-prompt">~/</span>NoteCode
        </span>
        <span className="canvas-header-sub">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
          {folders.length > 0 && ` · ${folders.length} folder${folders.length !== 1 ? 's' : ''}`}
        </span>
      </header>

      {/* Body = optional sidebar + canvas */}
      <div className="canvas-body">
        {sidebarOpen && (
          <CanvasSidebar
            notes={notes}
            folders={folders}
            activeId={activeId}
            onSelect={onSelect}
            onDelete={onDelete}
          />
        )}

        {/* The actual canvas */}
        <div
          ref={viewportRef}
          className={`canvas-viewport${isPanning ? ' panning' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
        <div
          className="canvas-world"
          style={{ transform: `translate(${panX}px,${panY}px) scale(${zoom})` }}
        >
          {/* Folders */}
          {folders.map(folder => {
            const isDragging = folder.id === draggingFolderId
            const liveFolder = isDragging
              ? { ...folder, canvasX: dragState.liveX, canvasY: dragState.liveY }
              : folder
            return (
              <FolderNode
                key={folder.id}
                folder={liveFolder}
                isExpanded={expandedFolders.has(folder.id)}
                isDropTarget={dropTargetId === folder.id}
                isDragging={isDragging}
                noteCount={notes.filter(n => n.folder === folder.id).length}
                onDoubleClick={e => {
                  e.stopPropagation()
                  setRenamingFolderId(folder.id)
                  setRenameName(folder.name)
                }}
                renamingId={renamingFolderId}
                renameName={renameName}
                onRenameChange={e => setRenameName(e.target.value)}
                onRenameBlur={() => {
                  if (renameName.trim()) onFolderRename(renamingFolderId, renameName.trim())
                  setRenamingFolderId(null)
                }}
                onRenameKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (renameName.trim()) onFolderRename(renamingFolderId, renameName.trim())
                    setRenamingFolderId(null)
                  }
                  if (e.key === 'Escape') setRenamingFolderId(null)
                }}
                onDelete={onFolderDelete}
              />
            )
          })}

          {/* Notes */}
          {visibleNotes.map(note => {
            const isDragging = note.id === draggingNoteId
            let dx, dy
            if (isDragging) {
              dx = dragState.liveX; dy = dragState.liveY
            } else {
              const fanPos = noteDisplayPos[note.id]
              dx = fanPos ? fanPos.x : note.canvasX
              dy = fanPos ? fanPos.y : note.canvasY
            }
            return (
              <NoteNode
                key={note.id}
                note={note}
                displayX={dx}
                displayY={dy}
                isActive={note.id === activeId}
                isDragging={isDragging}
                isFanning={fanningNoteIds.has(note.id) && !isDragging}
                onDelete={onDelete}
              />
            )
          })}
        </div>
        </div>
      </div>

      {/* Floating toolbar */}
      <div className="canvas-toolbar">
        <input
          className="canvas-search"
          placeholder="search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onPointerDown={e => e.stopPropagation()}
        />
        <button className="canvas-tb-btn" onClick={handleNewNote} title="New note (Ctrl+N)">+ note</button>
        {showFolderInput ? (
          <form
            className="canvas-folder-form"
            onSubmit={e => { e.preventDefault(); handleCreateFolder() }}
            onPointerDown={e => e.stopPropagation()}
          >
            <input
              className="canvas-folder-input"
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              autoFocus
              onBlur={() => { if (!newFolderName.trim()) setShowFolderInput(false) }}
              onKeyDown={e => { if (e.key === 'Escape') setShowFolderInput(false) }}
            />
            <button type="submit" className="canvas-tb-btn">ok</button>
          </form>
        ) : (
          <button className="canvas-tb-btn" onClick={() => setShowFolderInput(true)}>+ folder</button>
        )}
        <button
          className={`canvas-tb-btn canvas-tb-trash${trash.length > 0 ? ' has-items' : ''}`}
          onClick={() => setTrashOpen(o => !o)}
        >
          {trash.length > 0 ? `trash (${trash.length})` : 'trash'}
        </button>
        <button className="canvas-tb-btn" onClick={handleExport} title="Download all notes as JSON">↓ export</button>
        <button className="canvas-tb-btn canvas-tb-reset" onClick={resetViewport} title="Reset zoom">⌖</button>
      </div>

      {trashOpen && (
        <TrashPanel
          trash={trash}
          onRestore={onRestore}
          onPermanentDelete={onPermanentDelete}
          onEmptyTrash={onEmptyTrash}
          onClose={() => setTrashOpen(false)}
        />
      )}
    </div>
  )
}
