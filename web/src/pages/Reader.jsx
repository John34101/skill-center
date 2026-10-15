import React, { useEffect, useState, useCallback } from 'react'
import { api, normalizeHighlights } from '../api'
import { isCourseBook, buildHighlightsMarkdown, downloadMarkdown, safeFilename } from '../lib/highlights'
import CourseReader from '../components/reader/CourseReader.jsx'
import EpubReader from '../components/reader/EpubReader.jsx'
import HighlightPanel, { NoteDialog } from '../components/reader/HighlightPanel.jsx'

export default function Reader({ id }) {
  const [book, setBook] = useState(null)
  const [err, setErr] = useState('')
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [noteBox, setNoteBox] = useState(null)
  const [saving, setSaving] = useState(false)
  const [courseMeta, setCourseMeta] = useState(null)
  const [chapterId, setChapterId] = useState(null)
  const [darkRead, setDarkRead] = useState(() => localStorage.getItem('sc_read_dark') === '1')

  const courseMode = isCourseBook(book)

  useEffect(() => {
    setLoading(true)
    setErr('')
    setCourseMeta(null)
    setChapterId(null)
    api.books().then(d => {
      if (!d.ok) { setErr(d.error || '加载失败'); setLoading(false); return }
      const b = (d.books || []).find(x => String(x.id) === String(id))
      if (!b) { setErr('书籍不存在或无权访问'); setLoading(false); return }
      setBook(b)
      api.bookHighlights(b.id).then(h => {
        setLoading(false)
        if (h.ok) setHighlights(normalizeHighlights(h.highlights))
      })
    })
  }, [id])

  useEffect(() => {
    localStorage.setItem('sc_read_dark', darkRead ? '1' : '0')
    document.documentElement.classList.toggle('read-dark', darkRead)
    return () => document.documentElement.classList.remove('read-dark')
  }, [darkRead])

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

  const currentChapter = courseMeta?.chapters?.find(c => c.id === chapterId)

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
        <div className={'reader-main' + (courseMode ? ' course-mode' : '')}>
          {courseMode ? (
            <CourseReader
              book={book}
              chapterId={chapterId}
              setChapterId={setChapterId}
              onSelectText={onSelectText}
              courseMeta={courseMeta}
              setCourseMeta={setCourseMeta}
            />
          ) : (
            <EpubReader book={book} onSelectText={onSelectText} onError={setErr} />
          )}
          <HighlightPanel
            highlights={highlights}
            courseMeta={courseMeta}
            onSaveNote={saveNote}
            onDelete={delHl}
          />
        </div>
      )}

      <NoteDialog noteBox={noteBox} setNoteBox={setNoteBox} saving={saving} onSave={saveHighlight} />
    </div>
  )
}
