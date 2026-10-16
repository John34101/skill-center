import React, { useEffect, useState, useCallback } from 'react'
import { api, normalizeHighlights } from '../api'
import { isCourseBook, buildHighlightsMarkdown, downloadMarkdown, safeFilename } from '../lib/highlights'
import {
  FONT_SIZE_STEPS, loadFontSizeId, saveFontSizeId, fontSizeEm,
} from '../lib/readingProgress.js'
import { useAuth } from '../store'
import CourseReader from '../components/reader/CourseReader.jsx'
import EpubReader from '../components/reader/EpubReader.jsx'
import HighlightPanel, { NoteDialog } from '../components/reader/HighlightPanel.jsx'

const LS_TOC = 'sc_reader_toc'
const LS_HL = 'sc_reader_hl'

function isNarrow() {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  } catch (e) {
    return false
  }
}

function loadPanelOpen(key) {
  try {
    const v = localStorage.getItem(key)
    if (v === null) {
      // First visit: desktop open, phone tucked so body stays full-width
      return !isNarrow()
    }
    return v !== '0'
  } catch (e) {
    return !isNarrow()
  }
}

export default function Reader({ id }) {
  const { user } = useAuth()
  const userId = user?.id ?? user?.email ?? 'anon'
  const [book, setBook] = useState(null)
  const [err, setErr] = useState('')
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [noteBox, setNoteBox] = useState(null)
  const [saving, setSaving] = useState(false)
  const [courseMeta, setCourseMeta] = useState(null)
  const [chapterId, setChapterId] = useState(null)
  const [darkRead, setDarkRead] = useState(() => localStorage.getItem('sc_read_dark') === '1')
  const [fontId, setFontId] = useState(() => loadFontSizeId())
  // Panels: default open on desktop-ish; persist preference
  const [tocOpen, setTocOpen] = useState(() => loadPanelOpen(LS_TOC))
  const [hlOpen, setHlOpen] = useState(() => loadPanelOpen(LS_HL))

  const courseMode = isCourseBook(book)

  useEffect(() => {
    setLoading(true)
    setErr('')
    setCourseMeta(null)
    setChapterId(null)
    setHighlights([])
    // 书架列表与划线并行（路由 id 即 book_id）
    Promise.all([api.books(), api.bookHighlights(id)]).then(([d, h]) => {
      if (!d.ok) { setErr(d.error || '加载失败'); setLoading(false); return }
      const b = (d.books || []).find(x => String(x.id) === String(id))
      if (!b) { setErr('书籍不存在或无权访问'); setLoading(false); return }
      setBook(b)
      if (h.ok) setHighlights(normalizeHighlights(h.highlights))
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    localStorage.setItem('sc_read_dark', darkRead ? '1' : '0')
    document.documentElement.classList.toggle('read-dark', darkRead)
    return () => document.documentElement.classList.remove('read-dark')
  }, [darkRead])

  useEffect(() => {
    saveFontSizeId(fontId)
  }, [fontId])

  useEffect(() => {
    try { localStorage.setItem(LS_TOC, tocOpen ? '1' : '0') } catch (e) {}
  }, [tocOpen])

  useEffect(() => {
    try { localStorage.setItem(LS_HL, hlOpen ? '1' : '0') } catch (e) {}
  }, [hlOpen])

  const cycleFont = () => {
    const i = FONT_SIZE_STEPS.findIndex(s => s.id === fontId)
    const next = FONT_SIZE_STEPS[(i + 1) % FONT_SIZE_STEPS.length]
    setFontId(next.id)
  }

  const reloadHighlights = () => {
    if (!book) return
    api.bookHighlights(book.id).then(h => {
      if (h.ok) setHighlights(normalizeHighlights(h.highlights))
    })
  }

  const onSelectText = useCallback(({ quote, loc }) => {
    setNoteBox({ quote, loc, text: '', tag: ['金句'] })
  }, [])

  const saveHighlight = () => {
    if (!noteBox || !noteBox.quote.trim()) return
    setSaving(true)
    api.addHighlight({
      book_id: book.id,
      quote: noteBox.quote,
      note: noteBox.text,
      loc: noteBox.loc,
      tag: noteBox.tag || [],
    }).then(d => {
      setSaving(false)
      if (d.ok) {
        setNoteBox(null)
        try { window.getSelection()?.removeAllRanges() } catch (e) {}
        reloadHighlights()
      } else alert(d.error || '保存失败')
    })
  }

  const saveNote = (hl) => {
    api.updateHighlight(hl.id, { note: hl.note, tag: hl.tag }).then(d => {
      if (d.ok) setHighlights(highlights.map(x => x.id === hl.id ? { ...x, note: hl.note, tag: hl.tag } : x))
    })
  }
  const delHl = (hl) => {
    if (!confirm('删除这条划线？')) return
    api.deleteHighlight(hl.id).then(d => {
      if (d.ok) setHighlights(highlights.filter(x => x.id !== hl.id))
    })
  }

  const exportMd = (mode) => {
    if (!highlights.length) return alert('还没有划线')
    const md = buildHighlightsMarkdown(book, highlights, courseMeta)
    if (mode === 'copy') {
      navigator.clipboard.writeText(md)
        .then(() => alert('已复制到剪贴板，可粘贴到 Obsidian / 飞书'))
        .catch(() => alert('复制失败，请改用「下载 Markdown」'))
      return
    }
    downloadMarkdown(safeFilename(book.title) + '-划线.md', md)
  }

  if (loading) return <p className="muted pad">打开书页…</p>
  if (err) return (
    <div className="pad">
      <p className="err">{err}</p>
      <a className="btn ghost" href="#/">← 返回书房</a>
    </div>
  )
  if (!book) return <p className="muted pad">无此书籍</p>

  const currentChapter = courseMeta?.chapters?.find(c => String(c.id) === String(chapterId))
  const fontLabel = (FONT_SIZE_STEPS.find(s => s.id === fontId) || FONT_SIZE_STEPS[0]).label

  const mainClass = [
    'reader-main',
    courseMode ? 'course-mode' : '',
    hlOpen ? '' : 'hl-collapsed',
    courseMode && !tocOpen ? 'toc-collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={'reader' + (darkRead ? ' is-dark' : '')}>
      <div className="reader-top">
        <a className="btn sm ghost" href="#/">← 书房</a>
        <div className="reader-titles">
          <b className="reader-title">{book.title}</b>
          <span className="muted">
            {book.author || ''}
            {courseMode && currentChapter ? ` · ${currentChapter.title}` : ''}
          </span>
        </div>
        <span className="spacer" />
        {courseMode && (
          <button
            type="button"
            className={'btn sm ghost' + (tocOpen ? ' on-soft' : '')}
            onClick={() => setTocOpen(v => !v)}
            aria-pressed={tocOpen}
            title={tocOpen ? '收起目录' : '展开目录'}
          >
            {tocOpen ? '目录 · 开' : '目录 · 关'}
          </button>
        )}
        <button
          type="button"
          className={'btn sm ghost' + (hlOpen ? ' on-soft' : '')}
          onClick={() => setHlOpen(v => !v)}
          aria-pressed={hlOpen}
          title={hlOpen ? '收起划线' : '展开划线'}
        >
          {hlOpen ? `划线 · 开` : `划线 · 关`}
          {!hlOpen && highlights.length ? ` (${highlights.length})` : ''}
        </button>
        {courseMode && (
          <button type="button" className="btn sm ghost" onClick={cycleFont} title="切换正文字号">
            字号 · {fontLabel}
          </button>
        )}
        <button type="button" className="btn sm ghost" onClick={() => setDarkRead(v => !v)}>
          {darkRead ? '日间' : '夜间'}
        </button>
        <button type="button" className="btn sm ghost" disabled={!highlights.length} onClick={() => exportMd('copy')}>
          复制
        </button>
        <button type="button" className="btn sm primary" disabled={!highlights.length} onClick={() => exportMd('download')}>
          下载 Markdown
        </button>
        <span className="muted small">{highlights.length} 条划线</span>
      </div>

      {!book.file_path ? (
        <div className="pad"><p className="err">还没有文件路径。回书房补上课程 meta.json 或 EPUB 路径即可阅读。</p></div>
      ) : (
        <div className={mainClass}>
          {courseMode ? (
            <CourseReader
              book={book}
              chapterId={chapterId}
              setChapterId={setChapterId}
              onSelectText={onSelectText}
              courseMeta={courseMeta}
              setCourseMeta={setCourseMeta}
              userId={userId}
              fontSizeEm={fontSizeEm(fontId)}
              tocOpen={tocOpen}
              setTocOpen={setTocOpen}
            />
          ) : (
            <EpubReader book={book} onSelectText={onSelectText} onError={setErr} />
          )}
          {hlOpen ? (
            <HighlightPanel
              highlights={highlights}
              courseMeta={courseMeta}
              onSaveNote={saveNote}
              onDelete={delHl}
              onCollapse={() => setHlOpen(false)}
            />
          ) : null}
        </div>
      )}

      {/* Floating reopen affordances when panels are hidden */}
      {courseMode && !tocOpen && (
        <button
          type="button"
          className="panel-fab panel-fab-left"
          onClick={() => setTocOpen(true)}
          title="展开目录"
        >
          目录
        </button>
      )}
      {!hlOpen && (
        <button
          type="button"
          className="panel-fab panel-fab-right"
          onClick={() => setHlOpen(true)}
          title="展开划线"
        >
          划线{highlights.length ? ` · ${highlights.length}` : ''}
        </button>
      )}

      <NoteDialog noteBox={noteBox} setNoteBox={setNoteBox} saving={saving} onSave={saveHighlight} />
    </div>
  )
}
