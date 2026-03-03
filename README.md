# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


Details -

  NoteCode is a terminal-aesthetic markdown note-taking app. Here's a breakdown of every layer:

  ---
  The Stack

  ┌──────────────┬──────────────────────────────────────────┐
  │     Tool     │                   Role                   │
  ├──────────────┼──────────────────────────────────────────┤
  │ React 19     │ UI components and state                  │
  ├──────────────┼──────────────────────────────────────────┤
  │ Vite         │ Dev server and bundler                   │
  ├──────────────┼──────────────────────────────────────────┤
  │ CodeMirror 6 │ The editor (replaces a plain <textarea>) │
  ├──────────────┼──────────────────────────────────────────┤
  │ marked       │ Converts markdown → HTML for reader mode │
  ├──────────────┼──────────────────────────────────────────┤
  │ highlight.js │ Syntax colors in reader mode code blocks │
  └──────────────┴──────────────────────────────────────────┘

  ---
  What Each File Does

  src/
  ├── main.jsx          → Entry point, mounts React into index.html
  ├── App.jsx           → Root component: manages notes, sidebar, mode switching
  ├── index.css         → All styles (layout, colors, toolbar, editor, markdown)
  └── components/
      ├── Sidebar.jsx   → Note list, search, create/delete
      ├── Editor.jsx    → CodeMirror editor + formatting toolbar
      └── Preview.jsx   → Reader mode (full-screen rendered markdown)

  App.jsx is the brain — it holds all note data in state, saves to localStorage, and decides which panel to show based on the current mode (edit or read).

  Editor.jsx is the most complex piece. It:
  1. Mounts a CodeMirror instance into a <div> when you open a note
  2. Destroys and remounts it when you switch notes (so the content updates correctly)
  3. Fires onChange on every keystroke, which flows up to App.jsx → localStorage
  4. Has a toolbar that directly manipulates the CodeMirror editor state

  Preview.jsx just takes the raw markdown string, runs it through marked, and renders the HTML — used in reader [▶] mode.

  ---
  The CodeMirror Setup (Editor internals)

  EditorView (the actual DOM editor)
    └── EditorState
          ├── markdown() extension     → parses markdown syntax
          ├── syntaxHighlighting()     → applies colors per token type
          ├── history()                → undo/redo
          ├── keymap                   → keyboard shortcuts
          ├── EditorView.lineWrapping  → soft wrap long lines
          └── updateListener           → fires onChange when text changes

  The colors (heading purple, bold orange, italic green, etc.) are defined in markdownHighlight — a HighlightStyle that maps token types → CSS properties.

  ---
  How to Make Edits

  1. Change a color or font size in the editor

  Open src/components/Editor.jsx, find markdownHighlight:
  { tag: tags.heading1, fontSize: '1.6em', fontWeight: '700', color: '#da8fff' },
  Change the color/size there. The tag names map directly to markdown elements (tags.strong, tags.emphasis, tags.link, etc.)

  ---
  2. Add a new toolbar button

  In Editor.jsx, add a button in the <div className="toolbar">:
  <button className="toolbar-btn" onClick={() => getView() && toggleWrap(getView(), '~~', '~~')}>S</button>
  Then add the corresponding CSS in index.css under .toolbar-btn if needed.

  ---
  3. Change the color scheme / theme

  All CSS variables are at the top of src/index.css:
  :root {
    --text-accent:  #da8fff;   /* purple — headings, cursor */
    --text-orange:  #f3ae35;   /* bold, inline code */
    --text-green:   #5af78e;   /* italic */
    --text-blue:    #57c7ff;   /* h3, links */
    --bg-base:      #0d0f11;   /* main background */
  }
  Change these and both the app UI and editor decorations will update.

  ---
  4. Change how markdown renders in reader mode

  Open src/components/Preview.jsx. The renderer object overrides how marked renders specific elements. For example, to change how code blocks look, edit the
   renderer.code function there.

  ---
  5. Running it locally
  cd "/mnt/d/AI projects/Note/note-app"
  npm run dev        # start dev server at localhost:5173
  npm run build      # production build into /dist

  After any edit, the dev server hot-reloads automatically — you don't need to restart it.