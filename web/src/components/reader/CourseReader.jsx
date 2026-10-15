import React, { useEffect, useRef, useState, useCallback } from 'react'
import { marked } from 'marked'

function resolveUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return window.location.origin + (path.startsWith('/') ? '' : '/') + path
}
function baseDirOf(url) {
  return String(url).replace(/\/[^/]*$/, '/')
}

export default function CourseReader({ book, chapterId, setChapterId, onSelectText, courseMeta, setCourseMeta }) {
  const [chapterHtml, setChapterHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const mdBodyRef = useRef(null)

  useEffect(() => {
    if (!book?.file_path) return
    let cancelled = false
    const metaUrl = resolveUrl(book.file_path)
    setErr('')
    fetch(metaUrl)
      .then(r => {
        if (!r.ok) throw new Error('无法加载课程目录（' + r.status + '）')
        return r.json()
      })
      .then(meta => {
        if (cancelled) return
        const chapters = Array.isArray(meta.chapters) ? meta.chapters : []
        if (!chapters.length) throw new Error('课程目录里没有章节')
        const next = { ...meta, chapters, _base: baseDirOf(metaUrl) }
        setCourseMeta(next)
        if (!chapterId) setChapterId(chapters[0].id)
      })
      .catch(e => { if (!cancelled) setErr(e.message || '课程加载失败') })
    return () => { cancelled = true }
  }, [book?.id, book?.file_path])

  useEffect(() => {
    if (!courseMeta || !chapterId) return
    const ch = courseMeta.chapters.find(c => c.id === chapterId)
    if (!ch) return
    let cancelled = false
    setLoading(true)
    setErr('')
    fetch(courseMeta._base + ch.file)
      .then(r => {
        if (!r.ok) throw new Error('章节加载失败（' + r.status + '）')
        return r.text()
      })
      .then(md => {
        if (cancelled) return
        setChapterHtml(marked.parse(md, { async: false }))
        setLoading(false)
      })
      .catch(e => {
        if (!cancelled) { setErr(e.message || '章节加载失败'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [courseMeta, chapterId])

  const onMdMouseUp = useCallback(() => {
    if (!chapterId) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = String(sel.toString() || '').trim()
    if (!text || text.length < 2) return
    const root = mdBodyRef.current
    if (root && sel.anchorNode && !root.contains(sel.anchorNode)) return
    let offset = 0
    try {
      const pre = document.createRange()
      pre.selectNodeContents(root)
      pre.setEnd(sel.anchorNode, sel.anchorOffset)
      offset = pre.toString().length
    } catch (e) { offset = 0 }
    onSelectText({ quote: text, loc: `chapter:${chapterId}:${offset}` })
  }, [chapterId, onSelectText])

  return (
    <div className="course-layout">
      <aside className="course-nav">
        <div className="side-head">
          <b>目录</b>
          <span className="muted">{courseMeta ? courseMeta.chapters.length : 0} 讲</span>
        </div>
        {err && <p className="err small pad">{err}</p>}
        {!courseMeta && !err && <p className="muted small pad">加载目录…</p>}
        {courseMeta && (
          <ul className="course-chapters">
            {courseMeta.chapters.map((ch, i) => (
              <li key={ch.id}>
                <button
                  type="button"
                  className={'course-ch' + (ch.id === chapterId ? ' on' : '')}
                  onClick={() => setChapterId(ch.id)}
                >
                  <span className="ch-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="ch-title">{ch.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="course-read paper-sheet">
        {loading ? (
          <p className="muted pad">加载章节…</p>
        ) : (
          <article
            className="md-body"
            ref={mdBodyRef}
            onMouseUp={onMdMouseUp}
            dangerouslySetInnerHTML={{ __html: chapterHtml }}
          />
        )}
        <p className="muted small pad course-tip">选中文字即可划线 · 右侧可整理笔记</p>
      </div>
    </div>
  )
}
