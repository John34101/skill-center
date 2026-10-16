import React, { useEffect, useRef, useState, useCallback } from 'react'
import { marked } from 'marked'
import { loadProgress, saveProgress } from '../../lib/readingProgress.js'

function resolveUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return window.location.origin + (path.startsWith('/') ? '' : '/') + path
}
function baseDirOf(url) {
  return String(url).replace(/\/[^/]*$/, '/')
}

export default function CourseReader({
  book,
  chapterId,
  setChapterId,
  onSelectText,
  courseMeta,
  setCourseMeta,
  userId,
  fontSizeEm,
  tocOpen = true,
  setTocOpen,
}) {
  const [chapterHtml, setChapterHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const mdBodyRef = useRef(null)
  const scrollRef = useRef(null)
  const restoreScrollRef = useRef(null) // number | null when chapter just loaded
  const skipScrollSaveRef = useRef(false)
  const chapterIdRef = useRef(chapterId)
  chapterIdRef.current = chapterId

  // Load course meta; resume last chapter when opening
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
        if (!chapterId) {
          const saved = loadProgress(userId, book.id)
          const ok = saved?.chapterId && chapters.some(c => String(c.id) === String(saved.chapterId))
          const targetId = ok ? String(saved.chapterId) : String(chapters[0].id)
          if (ok && typeof saved.scrollTop === 'number') {
            restoreScrollRef.current = saved.scrollTop
          }
          setChapterId(targetId)
        }
      })
      .catch(e => { if (!cancelled) setErr(e.message || '课程加载失败') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-fetch when book changes
  }, [book?.id, book?.file_path, userId])

  // Load chapter markdown
  useEffect(() => {
    if (!courseMeta || !chapterId) return
    const ch = courseMeta.chapters.find(c => String(c.id) === String(chapterId))
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

  // After chapter HTML paints: restore scroll or jump to top
  useEffect(() => {
    if (loading || !chapterHtml || !scrollRef.current) return
    const el = scrollRef.current
    const target = restoreScrollRef.current
    skipScrollSaveRef.current = true
    if (typeof target === 'number' && target > 0) {
      el.scrollTop = target
    } else {
      el.scrollTop = 0
    }
    restoreScrollRef.current = null
    // allow scroll saves after layout settles
    const t = setTimeout(() => { skipScrollSaveRef.current = false }, 80)
    return () => clearTimeout(t)
  }, [loading, chapterHtml, chapterId])

  // Persist chapter + scroll
  const persist = useCallback((patch) => {
    if (!book?.id) return
    saveProgress(userId, book.id, patch)
  }, [userId, book?.id])

  useEffect(() => {
    if (!chapterId || !book?.id) return
    persist({ chapterId })
  }, [chapterId, book?.id, persist])

  const onScroll = useCallback(() => {
    if (skipScrollSaveRef.current || !scrollRef.current) return
    const top = scrollRef.current.scrollTop
    persist({ chapterId: chapterIdRef.current, scrollTop: top })
  }, [persist])

  // Throttle scroll saves via rAF
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const handler = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        onScroll()
      })
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => {
      el.removeEventListener('scroll', handler)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [onScroll, courseMeta]) // rebind when layout mounts

  const onMdMouseUp = useCallback(() => {
    if (!chapterId) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.rangeCount) return
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
    let rect = null
    try {
      const r = sel.getRangeAt(0).getBoundingClientRect()
      if (r && (r.width || r.height)) {
        rect = { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height }
      }
    } catch (e) { rect = null }
    // Only surface a lightweight menu — do not create a highlight yet
    onSelectText({ quote: text, loc: `chapter:${chapterId}:${offset}`, rect })
  }, [chapterId, onSelectText])

  const chapters = courseMeta?.chapters || []
  const idx = chapters.findIndex(c => String(c.id) === String(chapterId))
  const prevCh = idx > 0 ? chapters[idx - 1] : null
  const nextCh = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null
  const currentTitle = idx >= 0 ? chapters[idx].title : ''

  const goChapter = (ch) => {
    if (!ch) return
    restoreScrollRef.current = 0
    setChapterId(String(ch.id))
    // On narrow screens, auto-hide TOC after picking a chapter
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) {
      setTocOpen?.(false)
    }
    persist({ chapterId: String(ch.id), scrollTop: 0 })
  }

  const toggleToc = () => setTocOpen?.(v => !v)

  return (
    <div className={'course-layout' + (tocOpen ? ' toc-open' : ' toc-collapsed')}>
      {tocOpen && (
        <aside className="course-nav" aria-label="课程目录">
          <div className="side-head course-nav-head">
            <b>目录</b>
            <span className="muted">{courseMeta ? courseMeta.chapters.length : 0} 讲</span>
            <button
              type="button"
              className="btn sm ghost course-nav-toggle"
              aria-expanded={tocOpen}
              onClick={toggleToc}
              title="收起目录"
            >
              收起
            </button>
          </div>
          {err && <p className="err small pad">{err}</p>}
          {!courseMeta && !err && <p className="muted small pad">加载目录…</p>}
          {courseMeta && (
            <ul className="course-chapters">
              {courseMeta.chapters.map((ch, i) => (
                <li key={ch.id}>
                  <button
                    type="button"
                    className={'course-ch' + (String(ch.id) === String(chapterId) ? ' on' : '')}
                    onClick={() => goChapter(ch)}
                  >
                    <span className="ch-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="ch-title">{ch.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      <div className="course-read paper-sheet" ref={scrollRef}>
        <div className="course-mobile-bar">
          <button
            type="button"
            className="btn sm ghost"
            onClick={toggleToc}
            aria-expanded={tocOpen}
          >
            {tocOpen ? '收起目录' : '目录'}
          </button>
          <span className="muted small course-mobile-title">{currentTitle}</span>
        </div>
        {loading ? (
          <p className="muted pad">加载章节…</p>
        ) : (
          <article
            className="md-body"
            ref={mdBodyRef}
            style={fontSizeEm ? { fontSize: fontSizeEm } : undefined}
            onMouseUp={onMdMouseUp}
            dangerouslySetInnerHTML={{ __html: chapterHtml }}
          />
        )}
        {!loading && chapters.length > 0 && (
          <nav className="chapter-pager" aria-label="章节翻页">
            <button
              type="button"
              className="btn ghost"
              disabled={!prevCh}
              onClick={() => goChapter(prevCh)}
            >
              ← 上一章{prevCh ? ` · ${prevCh.title}` : ''}
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!nextCh}
              onClick={() => goChapter(nextCh)}
            >
              {nextCh ? `下一章 · ${nextCh.title} →` : '已是最后一章'}
            </button>
          </nav>
        )}
        <p className="muted small pad course-tip">选中文字后点「划线」或「批注」· 顶栏可开关目录与划线</p>
      </div>
    </div>
  )
}
