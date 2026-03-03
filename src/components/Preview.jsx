import { useMemo } from 'react'
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

export default function Preview({ content, overlay, onClose }) {
  const html = useMemo(() => {
    if (!content.trim()) return ''
    return marked(content, { renderer })
  }, [content])

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
      <div
        className="preview-content markdown-body"
        dangerouslySetInnerHTML={{ __html: html || '<p class="preview-empty">Nothing to preview yet.</p>' }}
      />
    </div>
  )
}
