# NoteCode

A terminal-themed Markdown notes app where your notes live on an infinite canvas.

**Live:** [note-code-gilt.vercel.app](https://note-code-gilt.vercel.app/)

## What it is / why I built it

Most note apps give you a flat list of files, which works for retrieval but hides how ideas relate to each other. I wanted something that felt like a developer's tool (monospace, dark, keyboard-friendly) but let me lay notes out spatially and group them visually.

In NoteCode every note is a glowing dot on a pannable, zoomable canvas, and folders are cards you can drop notes onto. Click a dot and you get a focused Markdown editor with live preview. Your notes stay portable: one click exports everything as a `.zip` of plain `.md` files, organised by folder.

## Features

- **Infinite canvas**: pan by dragging, zoom with the scroll wheel (anchored at the cursor), reset view from the toolbar
- **Spatial notes**: drag note dots anywhere; positions are remembered
- **Folders as cards**: drop a note on a folder to file it; click a folder to fan its notes out around it; drag a note out to remove it; double-click to rename
- **List sidebar**: a collapsible folder/note tree with search, alongside the canvas
- **Markdown editor** (CodeMirror 6): edit, split (editor + preview) and read modes, plus foldable headings
- **Rendered preview**: syntax-highlighted code blocks and clickable task checkboxes (checked items float to the top of their list)
- **Trash**: restore or permanently delete removed notes
- **Typography controls**: eight font choices (JetBrains Mono, Fira Code, Inter, ...) and adjustable font size
- **Export**: download all notes as `notecode-backup-YYYY-MM-DD.zip`, with folders preserved as directories
- **Keyboard shortcuts**: `Ctrl/Cmd+N` new note, `Esc` back to canvas, `R` toggle read mode
- **No account needed**: notes, folders, trash and canvas position are saved in `localStorage`

## Tech stack

- React 19 + Vite
- CodeMirror 6 (Markdown editing)
- marked + highlight.js (preview rendering)
- JSZip (export)
- Plain CSS, Google Fonts
- Deployed on Vercel

## Run locally

```bash
npm install
npm run dev
```

No environment variables are needed. Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Project structure

```
src/
  App.jsx                 # note/folder/trash state, localStorage persistence, editor view
  constants.js            # font options and size limits
  components/
    NoteCanvas.jsx        # canvas, folder cards, note dots, list sidebar, toolbar, zip export
    Editor.jsx            # CodeMirror Markdown editor
    Preview.jsx           # rendered Markdown with highlighting and checkboxes
```

## Status

Working and deployed. Data lives only in your browser, so use export for backups.
