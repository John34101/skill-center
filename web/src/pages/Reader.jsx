import React, { useEffect, useRef, useState, useCallback } from 'react'
import { api, parseTags, fmtDate } from '../api'
import ePub from 'epubjs'
import { marked } from 'marked'

const TAGS = ['金句', '方法', '案例', '待复习', '想输出']

function isCourseBook(book) {
  if (!book) return false
  if (book.category === '课程') return true
  const p = String(book.file_path || '')
  return p.includes('/courses/') || /meta\.json$/i.test(p)
}

function resolveUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return window.location.origin + (path.startsWith('/') ? '' : '/') + path
}

function normalizeTag(tag) {
  if (Array.isArray(tag)) return tag
  return parseTags(tag)
}

function normalizeHighlights(list) {
  return (list || []).map(h => ({ ...h, tag: normalizeTag(h.tag) }))
}

function chapterIdFromLoc(loc) {
  const m = String(loc || '').match(/^chapter:([^:]+)/)
  return m ? m[1] : null
}

function baseDirOf(url) {
  return String(url).replace(/\/[^/]*$/, '/')
}

export default function Reader({ id }) {
  const [book, setBook] = useState(null)
  const [err, setErr] = useState('')
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const areaRef = useRef(null)
  const renditionRef = useRef(null)
  const bookRef = useRef(null)
  const mdBodyRef = useRef(null)
  const [noteBox, setNoteBox] = useState(null) // { quote, loc, text, tag }
  const [saving, setSaving] = useState(false)

  // 课程模式状态
  const [courseMeta, setCourseMeta] = useState(null)
  const [chapterId, setChapterId] = useState(null)
  const [chapterHtml, setChapterHtml] = useState('')
  const [chapterLoading, setChapterLoading] = useState(false)
  const [courseErr, setCourseErr] = useState('')

  const courseMode = isCourseBook(book)

  // 加载书籍 + 划线
  useEffect(() => {
    setLoading(true)
    setErr('')
    setCourseMeta(null)
    setChapterId(null)
    setChapterHtml('')
    api.books().then(d => {
      if (!d.ok) { setErr(d.error || '加载失败'); setLoading(false); return }
      const b = (d.books || []).find(x => String(x.id) === String(id))
      if (!b) { setErr('书籍不存在'); setLoading(false); return }
      setBook(b)
      api.bookHighlights(b.id).then(h => {
        setLoading(false)
        if (h.ok) setHighlights(normalizeHighlights(h.highlights))
      })
    })
  }, [id])

  // 课程：拉 meta.json
  useEffect(() => {
    if (loading || !book || !isCourseBook(book) || !book.file_path) return
    let cancelled = false
    const metaUrl = resolveUrl(book.file_path)
    setCourseErr('')
    fetch(metaUrl)
      .then(r => {
        if (!r.ok) throw new Error('无法加载课程目录（' + r.status + '）')
        return r.json()
      })
      .then(meta => {
        if (cancelled) return
        const chapters = Array.isArray(meta.chapters) ? meta.chapters : []
        if (chapters.length === 0) throw new Error('课程目录里没有章节')
        setCourseMeta({ ...meta, chapters, _base: baseDirOf(metaUrl) })
        setChapterId(chapters[0].id)
      })
      .catch(e => {
        if (!cancelled) setCourseErr(e.message || '课程加载失败')
      })
    return () => { cancelled = true }
  }, [book && book.id, book && book.file_path, loading, courseMode])

  // 课程：拉当前章节 Markdown
  useEffect(() => {
    if (!courseMeta || !chapterId) return
    const ch = courseMeta.chapters.find(c => c.id === chapterId)
    if (!ch) return
    let cancelled = false
    setChapterLoading(true)
    setCourseErr('')
    const url = courseMeta._base + ch.file
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('章节加载失败（' + r.status + '）')
        return r.text()
      })
      .then(md => {
        if (cancelled) return
        setChapterHtml(marked.parse(md, { async: false }))
        setChapterLoading(false)
      })
      .catch(e => {
        if (!cancelled) {
          setCourseErr(e.message || '章节加载失败')
          setChapterLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [courseMeta, chapterId])

  // EPUB 渲染（课程模式跳过）
  useEffect(() => {
    if (!book || !book.file_path || !areaRef.current || loading) return
    if (isCourseBook(book)) return
    let url = resolveUrl(book.file_path)
    let cancelled = false
    try {
      const epubBook = ePub(url)
      bookRef.current = epubBook
      const rendition = epubBook.renderTo(areaRef.current, {
        width: '100%', height: '100%', spread: 'none', flow: 'paginated',
      })
      renditionRef.current = rendition
      rendition.display()
      rendition.themes.default({
        body: { 'font-family': "'PingFang SC','Noto Serif SC',serif", 'font-size': '1.05em', 'line-height': '1.75', color: '#333' },
      })
      rendition.on('selected', (cfiRange, contents) => {
        const range = contents.getRange(cfiRange)
        const text = (range ? range.toString() : '').trim()
        if (!text) return
        setNoteBox({ quote: text, loc: cfiRange, text: '', tag: ['金句'] })
      })
      rendition.on('relocated', () => { /* 进度记录后续加 */ })
    } catch (e) {
      if (!cancelled) setErr('EPUB 解析失败：' + e.message)
    }
    return () => { cancelled = true; try { renditionRef.current && renditionRef.current.destroy() } catch (e) {} }
  }, [book && book.id, book && book.file_path, loading, courseMode])

  const onMdMouseUp = useCallback(() => {
    if (!chapterId) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = String(sel.toString() || '').trim()
    if (!text || text.length < 2) return
    // 确保选区在正文内
    const root = mdBodyRef.current
    if (root && sel.anchorNode && !root.contains(sel.anchorNode)) return
    let offset = 0
    try {
      const pre = document.createRange()
      pre.selectNodeContents(root)
      pre.setEnd(sel.anchorNode, sel.anchorOffset)
      offset = pre.toString().length
    } catch (e) { offset = 0 }
    setNoteBox({
      quote: text,
      loc: `chapter:${chapterId}:${offset}`,
      text: '',
      tag: ['金句'],
    })
  }, [chapterId])

  const reloadHighlights = () => {
    if (!book) return
    api.bookHighlights(book.id).then(h => {
      if (h.ok) setHighlights(normalizeHighlights(h.highlights))
    })
  }

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
        try { window.getSelection() && window.getSelection().removeAllRanges() } catch (e) {}
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
    api.deleteHighlight(hl.id).then(d => { if (d.ok) setHighlights(highlights.filter(x => x.id !== hl.id)) })
  }

  const chapterTitle = (cid) => {
    if (!cid || !courseMeta) return null
    const ch = courseMeta.chapters.find(c => c.id === cid)
    return ch ? ch.title : cid
  }

  const exportMd = () => {
    if (highlights.length === 0) return alert('还没有划线')
    const lines = [
      `# 《${book.title}》划线笔记`,
      `作者：${book.author || '佚名'}｜导出时间：${new Date().toLocaleDateString('zh-CN')}`,
      '',
    ]
    const ordered = highlights.slice().reverse()
    if (courseMode) {
      const groups = new Map()
      const noChapter = []
      ordered.forEach(h => {
        const cid = chapterIdFromLoc(h.loc)
        if (!cid) { noChapter.push(h); return }
        if (!groups.has(cid)) groups.set(cid, [])
        groups.get(cid).push(h)
      })
      const chapterOrder = (courseMeta && courseMeta.chapters) ? courseMeta.chapters.map(c => c.id) : [...groups.keys()]
      chapterOrder.forEach(cid => {
        const list = groups.get(cid)
        if (!list || list.length === 0) return
        lines.push(`## ${chapterTitle(cid) || cid}`, '')
        list.forEach(h => appendHl(lines, h))
      })
      ;[...groups.keys()].filter(cid => !chapterOrder.includes(cid)).forEach(cid => {
        const list = groups.get(cid)
        if (!list || list.length === 0) return
        lines.push(`## ${chapterTitle(cid) || cid}`, '')
        list.forEach(h => appendHl(lines, h))
      })
      if (noChapter.length) {
        lines.push('## 其他划线', '')
        noChapter.forEach(h => appendHl(lines, h))
      }
    } else {
      ordered.forEach(h => appendHl(lines, h))
    }
    const md = lines.join('\n')
    navigator.clipboard.writeText(md).then(() => alert('已复制全部划线（Markdown，可直接粘贴到 Obsidian / 飞书文档）')).catch(() => alert('复制失败，请手动复制'))
  }

  function appendHl(lines, h) {
    lines.push(`> ${h.quote.replace(/\n/g, '\n> ')}`)
    const tags = (h.tag || []).map(t => '#' + t).join(' ')
    if (h.note) lines.push(`\n📝 ${h.note}${tags ? '  ' + tags : ''}`)
    else if (tags) lines.push(`\n${tags}`)
    lines.push(`\n---\n`)
  }

  if (loading) return <p className="muted pad">加载书籍…</p>
  if (err) return <div className="pad"><p className="err">{err}</p><a className="btn" href="#/">← 返回书房</a></div>
  if (!book) return <p className="muted pad">无此书籍</p>

  const currentChapter = courseMeta && courseMeta.chapters.find(c => c.id === chapterId)

  return (
    <div className="reader">
      <div className="reader-top">
        <a className="btn sm" href="#/">← 书房</a>
        <b className="reader-title">{book.title}</b>
        <span className="muted">{book.author || ''}</span>
        {courseMode && currentChapter && (
          <span className="muted small">· {currentChapter.title}</span>
        )}
        <span className="spacer" />
        <button className="btn sm" onClick={exportMd} disabled={highlights.length === 0}>导出 Markdown</button>
        <span className="muted">{highlights.length} 条划线</span>
      </div>
      {!book.file_path ? (
        <div className="pad"><p className="err">这本书没有文件路径，回书房补上即可阅读。</p></div>
      ) : (
        <div className={'reader-main' + (courseMode ? ' course-mode' : '')}>
          {courseMode ? (
            <div className="course-layout">
              <aside className="course-nav">
                <div className="side-head">
                  <b>章节</b>
                  <span className="muted">{courseMeta ? courseMeta.chapters.length : 0} 讲</span>
                </div>
                {!courseMeta && !courseErr && <p className="muted small pad">加载目录…</p>}
                {courseErr && <p className="err small pad">{courseErr}</p>}
                {courseMeta && (
                  <ul className="course-chapters">
                    {courseMeta.chapters.map((ch, i) => (
                      <li key={ch.id}>
                        <button
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
              <div className="course-read">
                {chapterLoading ? (
                  <p className="muted pad">加载章节…</p>
                ) : (
                  <article
                    className="md-body"
                    ref={mdBodyRef}
                    onMouseUp={onMdMouseUp}
                    dangerouslySetInnerHTML={{ __html: chapterHtml }}
                  />
                )}
                <p className="muted small pad course-tip">选中正文中的文字即可划线记录</p>
              </div>
            </div>
          ) : (
            <div className="reader-area" ref={areaRef} />
          )}
          <div className="reader-side">
            <div className="side-head">
              <b>我的划线</b>
              <span className="muted">选中正文可新增</span>
            </div>
            {highlights.length === 0 ? (
              <p className="muted small pad">还没有划线。在正文里拖动选中一段文字，就能记录。</p>
            ) : (
              <div className="hl-list">
                {highlights.map(hl => {
                  const cid = chapterIdFromLoc(hl.loc)
                  const ctitle = cid ? chapterTitle(cid) : null
                  return (
                    <div key={hl.id} className="hl card">
                      {ctitle && <p className="hl-ch muted small">{ctitle}</p>}
                      <p className="hl-quote">“{hl.quote}”</p>
                      <textarea
                        className="hl-note" rows={2}
                        placeholder="写点想法…"
                        value={hl.note || ''}
                        onChange={e => saveNote({ ...hl, note: e.target.value })}
                      />
                      <div className="hl-meta">
                        {TAGS.map(t => (
                          <button key={t} className={'chip sm' + ((hl.tag || []).includes(t) ? ' on' : '')}
                            onClick={() => {
                              const cur = hl.tag || []
                              const tag = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]
                              saveNote({ ...hl, tag })
                            }}>{t}</button>
                        ))}
                        <span className="spacer" />
                        <span className="muted small">{fmtDate(hl.created_at)}</span>
                        <button className="btn sm danger" onClick={() => delHl(hl)}>删</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {noteBox && (
        <div className="mask" onClick={() => setNoteBox(null)}>
          <div className="note-dialog card" onClick={e => e.stopPropagation()}>
            <h3>记下这段</h3>
            <p className="hl-quote">“{noteBox.quote}”</p>
            <textarea
              autoFocus rows={3}
              placeholder="你的想法、疑问或要输出的点…"
              value={noteBox.text}
              onChange={e => setNoteBox({ ...noteBox, text: e.target.value })}
            />
            <div className="hl-meta">
              {TAGS.map(t => (
                <button key={t} className={'chip sm' + ((noteBox.tag || []).includes(t) ? ' on' : '')}
                  onClick={() => {
                    const cur = noteBox.tag || []
                    setNoteBox({ ...noteBox, tag: cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t] })
                  }}>{t}</button>
              ))}
            </div>
            <div className="row-right">
              <button className="btn" onClick={() => setNoteBox(null)}>取消</button>
              <button className="btn primary" disabled={saving} onClick={saveHighlight}>{saving ? '保存中…' : '保存划线'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
