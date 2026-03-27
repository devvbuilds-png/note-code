import { useState, useRef, useEffect, useCallback } from 'react'

// ── Viewport persistence ──────────────────────────────────────────────────────
const CANVAS_VP_KEY = 'notecode_canvas'

function loadViewport() {
  try {
    const raw = localStorage.getItem(CANVAS_VP_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { panX: 60, panY: 60, zoom: 1 }
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
  const r = 140 + count * 14
  return Array.from({ length: count }, (_, i) => ({
    x: fx + Math.cos(-Math.PI / 2 + i * (2 * Math.PI) / count) * r,
    y: fy + Math.sin(-Math.PI / 2 + i * (2 * Math.PI) / count) * r,
  }))
}

// ── Screen ↔ canvas coordinate helpers ───────────────────────────────────────
function screenToCanvas(sx, sy, panX, panY, zoom) {
  return { x: (sx - panX) / zoom, y: (sy - panY) / zoom }
}

function canvasToScreen(cx, cy, panX, panY, zoom) {
  return { x: cx * zoom + panX, y: cy * zoom + panY }
}

// ── FolderNode ────────────────────────────────────────────────────────────────
function FolderNode({ folder, isExpanded, isDropTarget, isDragging, noteCount, onPointerDown, onDoubleClick, renamingId, renameName, onRenameChange, onRenameBlur, onRenameKeyDown, onDelete }) {
  const sx = folder.canvasX
  const sy = folder.canvasY
  return (
    <div
      className={[
        'canvas-folder',
        isExpanded  ? 'expanded'    : '',
        isDropTarget ? 'drop-target' : '',
        isDragging  ? 'dragging'    : '',
      ].filter(Boolean).join(' ')}
      data-folder-id={folder.id}
      style={{ left: sx, top: sy }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <div className="canvas-folder-icon">
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <path d="M0 2C0 0.9 0.9 0 2 0H5.5L7 1.5H12C13.1 1.5 14 2.4 14 3.5V10C14 11.1 13.1 12 12 12H2C0.9 12 0 11.1 0 10V2Z" fill="currentColor" opacity=".25"/>
          <path d="M0 3.5C0 2.4 0.9 1.5 2 1.5H12C13.1 1.5 14 2.4 14 3.5V10C14 11.1 13.1 12 12 12H2C0.9 12 0 11.1 0 10V3.5Z" stroke="currentColor" strokeWidth="1" fill="none" opacity=".6"/>
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
      <span className="canvas-folder-count">{noteCount}</span>
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
function NoteNode({ note, displayX, displayY, isActive, isDragging, isFanning, onPointerDown, onDelete }) {
  return (
    <div
      className={[
        'canvas-note',
        isActive  ? 'active'   : '',
        isDragging ? 'dragging' : '',
        isFanning  ? 'fanning'  : '',
      ].filter(Boolean).join(' ')}
      data-note-id={note.id}
      style={{ left: displayX, top: displayY }}
      onPointerDown={onPointerDown}
    >
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
            <button className="canvas-trash-empty" onClick={onEmptyTrash}>
              Empty trash
            </button>
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

  const [dragState, setDragState]       = useState(null)
  const [expandedFolders, setExpandedFolders] = useState(new Set())
  const [hoveredId, setHoveredId]       = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [renamingFolderId, setRenamingFolderId] = useState(null)
  const [renameName, setRenameName]     = useState('')
  const [trashOpen, setTrashOpen]       = useState(false)
  const [search, setSearch]             = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showFolderInput, setShowFolderInput] = useState(false)

  const viewportRef = useRef()
  const dragRef     = useRef(dragState) // keep a mutable ref for pointer handlers

  // keep dragRef in sync
  useEffect(() => { dragRef.current = dragState }, [dragState])

  // persist viewport
  useEffect(() => { saveViewport({ panX, panY, zoom }) }, [panX, panY, zoom])

  // non-passive wheel
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const next = zoomAt(panX, panY, zoom, e.deltaY, mx, my)
      setPanX(next.panX); setPanY(next.panY); setZoom(next.zoom)
      // update grid bg offset
      el.style.setProperty('--pan-x', next.panX)
      el.style.setProperty('--pan-y', next.panY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // sync grid bg offset on pan/zoom changes
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

      // Current display position (may be fan position)
      const folderExpanded = note.folder && expandedFolders.has(note.folder)
      let startItemX = note.canvasX
      let startItemY = note.canvasY
      if (folderExpanded) {
        const folder = folders.find(f => f.id === note.folder)
        if (folder) {
          const siblings = notes.filter(n => n.folder === note.folder)
          const idx = siblings.findIndex(n => n.id === noteId)
          const fanPositions = computeFanPositions(folder.canvasX, folder.canvasY, siblings.length)
          if (fanPositions[idx]) { startItemX = fanPositions[idx].x; startItemY = fanPositions[idx].y }
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
      const nx = d.startPanX + (e.clientX - d.startClientX)
      const ny = d.startPanY + (e.clientY - d.startClientY)
      setPanX(nx); setPanY(ny)
      return
    }

    if (d.type === 'item') {
      const dx = e.clientX - d.startClientX
      const dy = e.clientY - d.startClientY
      if (!d.hasMoved && Math.hypot(dx, dy) < 4) return

      const newX = d.startItemX + dx / zoom
      const newY = d.startItemY + dy / zoom

      setDragState(prev => ({ ...prev, liveX: newX, liveY: newY, hasMoved: true }))

      if (d.kind === 'note') {
        // detect folder drop target
        const hit = folders.find(f =>
          newX >= f.canvasX - 84 && newX <= f.canvasX + 84 &&
          newY >= f.canvasY - 44 && newY <= f.canvasY + 44
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
          onNoteFolder(d.id, dropTargetId)
        } else if (note?.folder) {
          onNoteFolder(d.id, null)
        }
        onNoteMove(d.id, { x: d.liveX, y: d.liveY })
      } else if (d.kind === 'folder') {
        onFolderMove(d.id, { x: d.liveX, y: d.liveY })
      }
    } else if (d.type === 'item' && !d.hasMoved) {
      // click
      if (d.kind === 'note') {
        onSelect(d.id)
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
  }, [notes, folders, dropTargetId, onNoteMove, onFolderMove, onNoteFolder, onSelect])

  // ── Create new note at canvas center ─────────────────────────────────────
  const handleNewNote = useCallback(() => {
    const el = viewportRef.current
    if (!el) { onNew(); return }
    const rect = el.getBoundingClientRect()
    const cx = (rect.width  / 2 - panX) / zoom
    const cy = (rect.height / 2 - panY) / zoom
    onNew({ x: cx, y: cy })
  }, [panX, panY, zoom, onNew])

  // ── Create folder at canvas center ────────────────────────────────────────
  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim() || 'New Folder'
    const el = viewportRef.current
    let cx = 400, cy = 300
    if (el) {
      const rect = el.getBoundingClientRect()
      cx = (rect.width  / 2 - panX) / zoom
      cy = (rect.height / 2 - panY) / zoom
    }
    onFolderCreate(name, { x: cx, y: cy })
    setNewFolderName('')
    setShowFolderInput(false)
  }, [newFolderName, panX, panY, zoom, onFolderCreate])

  // ── Reset viewport ────────────────────────────────────────────────────────
  const resetViewport = useCallback(() => {
    setPanX(60); setPanY(60); setZoom(1)
  }, [])

  // ── Filter notes ──────────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const visibleNotes = q
    ? notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    : notes

  // ── Build display positions ───────────────────────────────────────────────
  // For each note, compute where it actually renders (fan or stored)
  const noteDisplayPos = {}
  const fanningNoteIds = new Set()

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

  // ── Current drag live positions ───────────────────────────────────────────
  const draggingNoteId   = dragState?.kind === 'note'   ? dragState.id : null
  const draggingFolderId = dragState?.kind === 'folder' ? dragState.id : null

  const isPanning = dragState?.type === 'pan'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="canvas-panel">
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
            const cx = isDragging ? dragState.liveX : folder.canvasX
            const cy = isDragging ? dragState.liveY : folder.canvasY
            const folderWithLive = { ...folder, canvasX: cx, canvasY: cy }
            const noteCount = notes.filter(n => n.folder === folder.id).length
            return (
              <FolderNode
                key={folder.id}
                folder={folderWithLive}
                isExpanded={expandedFolders.has(folder.id)}
                isDropTarget={dropTargetId === folder.id}
                isDragging={isDragging}
                noteCount={noteCount}
                onPointerDown={e => {}} // handled by viewport
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
                onPointerDown={e => {}} // handled by viewport
                onDelete={onDelete}
              />
            )
          })}
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
          <button className="canvas-tb-btn" onClick={() => setShowFolderInput(true)} title="New folder">+ folder</button>
        )}
        <button
          className={`canvas-tb-btn canvas-tb-trash${trash.length > 0 ? ' has-items' : ''}`}
          onClick={() => setTrashOpen(o => !o)}
          title="Trash"
        >
          {trash.length > 0 ? `trash (${trash.length})` : 'trash'}
        </button>
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
