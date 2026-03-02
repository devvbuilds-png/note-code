import { useRef } from 'react'

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

export default function Sidebar({ notes, activeId, search, onSearch, onSelect, onNew, onDelete }) {
  const searchRef = useRef(null)

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
      </div>

      <div className="notes-list">
        {notes.length === 0 && (
          <div className="notes-empty">
            {search ? `no results for "${search}"` : 'no notes yet'}
          </div>
        )}
        {notes.map(note => (
          <div
            key={note.id}
            className={`note-item${note.id === activeId ? ' active' : ''}`}
            onClick={() => onSelect(note.id)}
          >
            <div className="note-item-header">
              <span className="note-item-title">{note.title || 'Untitled'}</span>
              <button
                className="note-delete-btn"
                onClick={e => { e.stopPropagation(); onDelete(note.id) }}
                title="Delete note"
              >
                ✕
              </button>
            </div>
            <div className="note-item-meta">
              <span className="note-item-time">{timeAgo(note.updatedAt)}</span>
            </div>
            <div className="note-item-excerpt">{excerpt(note.content)}</div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <span className="sidebar-count">{notes.length} note{notes.length !== 1 ? 's' : ''}</span>
        <button className="btn-new-sidebar" onClick={onNew}>+ new</button>
      </div>
    </aside>
  )
}
