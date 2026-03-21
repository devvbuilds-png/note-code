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

export default function Sidebar({
  notes, activeId, search, onSearch, onSelect, onNew, onDelete,
  folders, onFolderCreate, onFolderDelete, onFolderRename, onNoteFolder,
}) {
  const searchRef = useRef(null)
  const [sortBy, setSortBy] = useState('updated-desc')
  const [collapsed, setCollapsed] = useState({})
  const [editingFolder, setEditingFolder] = useState(null)
  const [folderName, setFolderName] = useState('')
  const [noteFolderMenu, setNoteFolderMenu] = useState(null)

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

  function renderNote(note) {
    return (
      <div
        key={note.id}
        className={`note-item${note.id === activeId ? ' active' : ''}`}
        onClick={() => { onSelect(note.id); setNoteFolderMenu(null) }}
      >
        <div className="note-item-header">
          <span className="note-item-title">{note.title || 'Untitled'}</span>
          <div className="note-item-actions">
            <button
              className={`note-folder-btn${noteFolderMenu === note.id ? ' open' : ''}`}
              onClick={e => { e.stopPropagation(); setNoteFolderMenu(noteFolderMenu === note.id ? null : note.id) }}
              title="Move to folder"
            >⊕</button>
            <button
              className="note-delete-btn"
              onClick={e => { e.stopPropagation(); onDelete(note.id) }}
              title="Delete note"
            >✕</button>
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
            <button className="search-clear" onClick={() => onSearch('')} title="Clear">✕</button>
          )}
        </div>
        <div className="sidebar-controls">
          <select
            className="sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="updated-desc">recent</option>
            <option value="updated-asc">oldest</option>
            <option value="created-desc">new first</option>
            <option value="created-asc">old first</option>
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
          <div key={folder.id} className="folder-section">
            <div className="folder-header">
              <button className="folder-toggle" onClick={() => toggleCollapse(folder.id)}>
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
                <span className="folder-name" onDoubleClick={() => startRename(folder)}>
                  {folder.name}
                </span>
              )}

              <span className="folder-count">{notesByFolder[folder.id]?.length ?? 0}</span>
              <button
                className="folder-delete-btn"
                onClick={() => onFolderDelete(folder.id)}
                title="Delete folder"
              >✕</button>
            </div>

            {!collapsed[folder.id] && (
              <div className="folder-notes">
                {(notesByFolder[folder.id]?.length ?? 0) === 0
                  ? <div className="notes-empty folder-empty">empty</div>
                  : notesByFolder[folder.id].map(note => renderNote(note))
                }
              </div>
            )}
          </div>
        ))}

        {/* Unfiled divider */}
        {folders.length > 0 && unfiledNotes.length > 0 && (
          <div className="folder-divider">unfiled</div>
        )}

        {/* Empty state */}
        {notes.length === 0 && (
          <div className="notes-empty">
            {search ? `no results for "${search}"` : 'no notes yet'}
          </div>
        )}

        {/* Unfiled notes */}
        {unfiledNotes.map(note => renderNote(note))}
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-count">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        <button className="btn-new-sidebar" onClick={onNew}>+ new</button>
      </div>
    </aside>
  )
}
