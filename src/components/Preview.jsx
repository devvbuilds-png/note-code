import { useMemo, useState } from 'react'
import { marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import plaintext from 'highlight.js/lib/languages/plaintext'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)
hljs.registerLanguage('plaintext', plaintext)

// Module-level counter reset before each render so checkboxes get stable indices
let _cbIdx = 0

marked.use({
  extensions: [{
    name: 'checkbox',
    level: 'inline',
    start(src) { return src.indexOf('[') },
    tokenizer(src) {
      const match = src.match(/^\[([ x])\]/)
      if (match) return { type: 'checkbox', raw: match[0], checked: match[1] === 'x' }
    },
    renderer(token) {
      const idx = _cbIdx++
      return `<input type="checkbox" class="task-checkbox" data-idx="${idx}"${token.checked ? ' checked' : ''} />`
    }
  }]
})

marked.setOptions({ breaks: true, gfm: true })

const renderer = new marked.Renderer()

renderer.code = function({ text, lang }) {
  const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
  const highlighted = hljs.highlight(text, { language }).value
  return `<pre class="hljs-pre"><div class="hljs-header"><span class="hljs-lang">${language}</span></div><code class="hljs language-${language}">${highlighted}</code></pre>`
}

renderer.codespan = function({ text }) {
  return `<code class="inline-code">${text}</code>`
}

// ── Section tree parsing ─────────────────────────────────────────────────────
// Returns a root node: { level:0, headingText:null, contentLines:[], children:[] }
function parseTree(markdown) {
  const lines = markdown.split('\n')
  const root = { level: 0, headingText: null, contentLines: [], children: [] }
  const stack = [root]
  let pendingContent = []
  let inCodeBlock = false

  for (const line of lines) {
    // Track fenced code blocks so we don't treat # inside them as headings
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock
      pendingContent.push(line)
      continue
    }

    if (inCodeBlock) {
      pendingContent.push(line)
      continue
    }

    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      // Flush pending content to the current stack top
      stack[stack.length - 1].contentLines.push(...pendingContent)
      pendingContent = []

      const level = match[1].length
      const node = { level, headingText: match[2], contentLines: [], children: [] }

      // Pop until we find a node with lower level (a valid parent)
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      stack[stack.length - 1].children.push(node)
      stack.push(node)
    } else {
      pendingContent.push(line)
    }
  }

  // Flush any trailing content
  stack[stack.length - 1].contentLines.push(...pendingContent)

  return root
}

// Pre-render the content of each node to HTML (in document order so _cbIdx is correct)
function preRenderNode(node) {
  const text = node.contentLines.join('\n').trim()
  return {
    html: text ? marked(text, { renderer }) : '',
    children: node.children.map(preRenderNode),
  }
}

// ── Section component ────────────────────────────────────────────────────────
function Section({ node, rendered, onCheckboxToggle }) {
  const [collapsed, setCollapsed] = useState(false)
  const isCollapsible = node.children.length > 0 || !!rendered.html.trim()
  const HeadingTag = `h${node.level}`

  // Render inline markdown in heading text (bold, italic, code, etc.)
  const headingHtml = useMemo(
    () => marked.parseInline(node.headingText),
    [node.headingText]
  )

  function handleContentClick(e) {
    if (e.target.classList.contains('task-checkbox') && onCheckboxToggle) {
      onCheckboxToggle(parseInt(e.target.dataset.idx, 10))
    }
  }

  return (
    <div className={`outline-node outline-level-${node.level}`}>
      <div
        className={`outline-heading-row${isCollapsible ? ' has-children' : ''}`}
        onClick={isCollapsible ? () => setCollapsed(c => !c) : undefined}
      >
        <span className={`collapse-chevron${isCollapsible ? '' : ' invisible'}${collapsed ? ' is-collapsed' : ''}`}>
          ▾
        </span>
        <HeadingTag
          className="outline-heading"
          dangerouslySetInnerHTML={{ __html: headingHtml }}
        />
      </div>

      {!collapsed && (
        <div className="outline-body">
          {rendered.html && (
            <div
              className="outline-content"
              dangerouslySetInnerHTML={{ __html: rendered.html }}
              onClick={handleContentClick}
            />
          )}
          {node.children.length > 0 && (
            <div className="outline-children">
              {node.children.map((child, i) => (
                <Section
                  key={i}
                  node={child}
                  rendered={rendered.children[i]}
                  onCheckboxToggle={onCheckboxToggle}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Preview component ────────────────────────────────────────────────────────
export default function Preview({ content, overlay, onClose, onCheckboxToggle }) {
  const parsed = useMemo(() => {
    if (!content.trim()) return null
    _cbIdx = 0
    const tree = parseTree(content)
    const rendered = preRenderNode(tree)
    return { tree, rendered }
  }, [content])

  function handleRootClick(e) {
    if (e.target.classList.contains('task-checkbox') && onCheckboxToggle) {
      onCheckboxToggle(parseInt(e.target.dataset.idx, 10))
    }
  }

  return (
    <div className={`preview-pane${overlay ? ' overlay' : ''}`}>
      <div className="preview-title-bar">
        {overlay && (
          <button className="preview-close-btn" onClick={onClose} title="Close preview">
            &#8594;
          </button>
        )}
        <span className="editor-label">reader</span>
      </div>

      {!parsed ? (
        <div className="preview-content markdown-body">
          <p className="preview-empty">Nothing to preview yet.</p>
        </div>
      ) : (
        <div className="preview-content markdown-body">
          {/* Pre-heading content (content before the first heading) */}
          {parsed.rendered.html && (
            <div
              className="outline-content"
              dangerouslySetInnerHTML={{ __html: parsed.rendered.html }}
              onClick={handleRootClick}
            />
          )}
          {/* Heading sections */}
          {parsed.tree.children.map((child, i) => (
            <Section
              key={i}
              node={child}
              rendered={parsed.rendered.children[i]}
              onCheckboxToggle={onCheckboxToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
