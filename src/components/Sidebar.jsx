import { useRef, useState, useEffect } from 'react'

function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function excerpt(content, len = 60) {
  const plain = content.replace(/[#*`>\[\]_~]/g, '').trim()
  return plain.length > len ? plain.slice(0, len) + '…' : plain
}

function sortNotes(arr, sortBy) {
  return [...arr].sort((a, b) => {
    switch (sortBy) {
      case 'updated-asc':  return a.updatedAt - b.updatedAt
      case 'created-desc': return b.createdAt - a.createdAt
      case 'created-asc':  return a.createdAt - b.createdAt
      case 'title-asc':    return (a.title || '').localeCompare(b.title || '')
      case 'title-desc':   return (b.title || '').localeCompare(a.title || '')
      default:             return b.updatedAt - a.updatedAt // updated-desc
    }
  })
}

function timeSince(ts) {
  const diff = Date.now() - ts
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function Sidebar({
  notes, activeId, search, onSearch, onSelect, onNew, onDelete,
  folders, onFolderCreate, onFolderDelete, onFolderRename, onNoteFolder,
  trash, onRestore, onPermanentDelete, onEmptyTrash,
}) {
  const searchRef = useRef(null)
  const [view, setView] = useState('notes') // 'notes' | 'trash'
  const [sortBy, setSortBy] = useState('updated-desc')
  const [collapsed, setCollapsed] = useState({})
  const [editingFolder, setEditingFolder] = useState(null)
  const [folderName, setFolderName] = useState('')
  const [noteFolderMenu, setNoteFolderMenu] = useState(null)
  const [draggedId, setDraggedId] = useState(null)
  const [dragOver, setDragOver] = useState(null) // folderId | 'unfiled'

  // Close folder menu on outside click
  useEffect(() => {
    if (!noteFolderMenu) return
    function handleGlobalClick() { setNoteFolderMenu(null) }
    document.addEventListener('click', handleGlobalClick)
    return () => document.removeEventListener('click', handleGlobalClick)
  }, [noteFolderMenu])

  const sorted = sortNotes(notes, sortBy)
  const unfiledNotes = sorted.filter(n => !n.folder)
  const notesByFolder = Object.fromEntries(
    folders.map(f => [f.id, sorted.filter(n => n.folder === f.id)])
  )

  function toggleCollapse(id) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function startRename(folder) {
    setEditingFolder(folder.id)
    setFolderName(folder.name)
  }

  function commitRename(id) {
    if (folderName.trim()) onFolderRename(id, folderName.trim())
    setEditingFolder(null)
  }

  // Drag handlers
  function handleDragStart(e, noteId) {
    setDraggedId(noteId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    setDraggedId(null)
    setDragOver(null)
  }

  function handleFolderDragOver(e, folderId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(folderId)
  }

  function handleFolderDrop(e, folderId) {
    e.preventDefault()
    if (draggedId) onNoteFolder(draggedId, folderId)
    setDraggedId(null)
    setDragOver(null)
  }

  function handleFolderDragLeave(e, folderId) {
    // Only clear if truly leaving this folder section (not just moving between children)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(prev => prev === folderId ? null : prev)
    }
  }

  function handleUnfiledDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver('unfiled')
  }

  function handleUnfiledDrop(e) {
    e.preventDefault()
    if (draggedId) onNoteFolder(draggedId, null)
    setDraggedId(null)
    setDragOver(null)
  }

  function renderNote(note) {
    return (
      <div
        key={note.id}
        className={`note-item${note.id === activeId ? ' active' : ''}${draggedId === note.id ? ' dragging' : ''}`}
        draggable
        onDragStart={e => handleDragStart(e, note.id)}
        onDragEnd={handleDragEnd}
        onClick={() => { onSelect(note.id); setNoteFolderMenu(null) }}
      >
        <div className="note-item-header">
          <span className="note-item-title">{note.title || 'Untitled'}</span>
          <div className="note-item-actions">
            <button
              className={`note-folder-btn${noteFolderMenu === note.id ? ' open' : ''}`}
              onClick={e => { e.stopPropagation(); setNoteFolderMenu(noteFolderMenu === note.id ? null : note.id) }}
              title="Move to folder"
            >⊞</button>
            <button
              className="note-delete-btn"
              onClick={e => { e.stopPropagation(); onDelete(note.id) }}
              title="Delete note"
            >×</button>
          </div>
        </div>

        {noteFolderMenu === note.id && (
          <div className="folder-menu" onClick={e => e.stopPropagation()}>
            <div
              className={`folder-menu-item${!note.folder ? ' selected' : ''}`}
              onClick={() => { onNoteFolder(note.id, null); setNoteFolderMenu(null) }}
            >— no folder</div>
            {folders.map(f => (
              <div
                key={f.id}
                className={`folder-menu-item${note.folder === f.id ? ' selected' : ''}`}
                onClick={() => { onNoteFolder(note.id, f.id); setNoteFolderMenu(null) }}
              >{f.name}</div>
            ))}
          </div>
        )}

        <div className="note-item-meta">
          <span className="note-item-time">{timeAgo(note.updatedAt)}</span>
        </div>
        <div className="note-item-excerpt">{excerpt(note.content)}</div>
      </div>
    )
  }

  if (view === 'trash') {
    return (
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="trash-header-row">
            <span className="trash-title">bin</span>
            {trash.length > 0 && (
              <button className="btn-empty-trash" onClick={onEmptyTrash}>empty bin</button>
            )}
          </div>
        </div>

        <div className="notes-list">
          {trash.length === 0 ? (
            <div className="notes-empty">bin is empty</div>
          ) : (
            trash.map(note => (
              <div key={note.id} className="note-item trash-item">
                <div className="note-item-header">
                  <span className="note-item-title">{note.title || 'Untitled'}</span>
                </div>
                <div className="note-item-excerpt">{excerpt(note.content)}</div>
                <div className="trash-item-footer">
                  <span className="note-item-time">deleted {timeSince(note.deletedAt)}</span>
                  <div className="trash-actions">
                    <button className="btn-restore" onClick={() => onRestore(note.id)} title="Restore note">restore</button>
                    <button className="btn-perm-delete" onClick={() => onPermanentDelete(note.id)} title="Delete forever">×</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sidebar-footer">
          <span className="sidebar-count">{trash.length} deleted</span>
          <button className="btn-back-notes" onClick={() => setView('notes')}>← notes</button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input
            ref={searchRef}
            className="search-input"
            type="text"
            placeholder="search notes..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            spellCheck={false}
          />
          {search && (
            <button className="search-clear" onClick={() => onSearch('')} title="Clear">×</button>
          )}
        </div>
        <div className="sidebar-controls">
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="updated-desc">recently updated</option>
            <option value="updated-asc">oldest updated</option>
            <option value="created-desc">newest created</option>
            <option value="created-asc">oldest created</option>
            <option value="title-asc">a → z</option>
            <option value="title-desc">z → a</option>
          </select>
          <button
            className="btn-folder-new"
            onClick={() => onFolderCreate('New Folder')}
            title="New folder"
          >+ folder</button>
        </div>
      </div>

      <div className="notes-list">
        {/* Folder sections */}
        {folders.map(folder => (
          <div
            key={folder.id}
            className={`folder-section${dragOver === folder.id ? ' drag-over' : ''}`}
            onDragOver={e => handleFolderDragOver(e, folder.id)}
            onDrop={e => handleFolderDrop(e, folder.id)}
            onDragLeave={e => handleFolderDragLeave(e, folder.id)}
          >
            <div className="folder-header" onClick={() => toggleCollapse(folder.id)}>
              <button className="folder-toggle" onClick={e => { e.stopPropagation(); toggleCollapse(folder.id) }}>
                {collapsed[folder.id] ? '▶' : '▼'}
              </button>

              {editingFolder === folder.id ? (
                <input
                  className="folder-name-input"
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  onBlur={() => commitRename(folder.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename(folder.id)
                    if (e.key === 'Escape') setEditingFolder(null)
                  }}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="folder-name" onDoubleClick={e => { e.stopPropagation(); startRename(folder) }}>
                  {folder.name}
                </span>
              )}

              <span className="folder-count">{notesByFolder[folder.id]?.length ?? 0}</span>
              <button
                className="folder-delete-btn"
                onClick={e => { e.stopPropagation(); onFolderDelete(folder.id) }}
                title="Delete folder"
              >×</button>
            </div>

            {!collapsed[folder.id] && (
              <div className="folder-notes">
                {(notesByFolder[folder.id]?.length ?? 0) === 0
                  ? <div className="notes-empty folder-empty">drop notes here</div>
                  : notesByFolder[folder.id].map(note => renderNote(note))
                }
              </div>
            )}
          </div>
        ))}

        {/* Unfiled drop zone — wraps divider + all unfiled notes */}
        {folders.length > 0 ? (
          <div
            className={`unfiled-zone${dragOver === 'unfiled' ? ' drag-over' : ''}${draggedId ? ' drag-active' : ''}`}
            onDragOver={handleUnfiledDragOver}
            onDrop={handleUnfiledDrop}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setDragOver(prev => prev === 'unfiled' ? null : prev)
            }}
          >
            <div className="folder-divider">unfiled</div>
            {notes.length === 0 && !draggedId && (
              <div className="notes-empty">
                {search ? `no results for "${search}"` : 'no notes yet'}
              </div>
            )}
            {unfiledNotes.map(note => renderNote(note))}
          </div>
        ) : (
          <>
            {notes.length === 0 && (
              <div className="notes-empty">
                {search ? `no results for "${search}"` : 'no notes yet'}
              </div>
            )}
            {unfiledNotes.map(note => renderNote(note))}
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-count">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        <div className="footer-right">
          <button
            className={`btn-bin${trash.length > 0 ? ' has-items' : ''}`}
            onClick={() => setView('trash')}
            title="Bin"
          >⌫{trash.length > 0 ? ` ${trash.length}` : ''}</button>
          <button className="btn-new-sidebar" onClick={onNew}>+ new</button>
        </div>
      </div>
    </aside>
  )
}
