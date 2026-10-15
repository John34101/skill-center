import React, { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { parseTags, fmtDate } from '../api'
import ePub from 'epubjs'

const TAGS = ['金句', '方法', '案例', '待复习', '想输出']

export default function Reader({ id }) {
  const [book, setBook] = useState(null)
  const [err, setErr] = useState('')
  const [highlights, setHighlights] = useState([])
  const [loading, setLoading] = useState(true)
  const areaRef = useRef(null)
  const renditionRef = useRef(null)
  const bookRef = useRef(null)
  const [noteBox, setNoteBox] = useState(null) // { quote, loc, text, tag }
  const [saving, setSaving] = useState(false)

  // 加载书籍
  useEffect(() => {
    setLoading(true)
    api.books().then(d => {
      if (!d.ok) { setErr(d.error || '加载失败'); setLoading(false); return }
      const b = (d.books || []).find(x => String(x.id) === String(id))
      if (!b) { setErr('书籍不存在'); setLoading(false); return }
      setBook(b)
      api.bookHighlights(b.id).then(h => {
        setLoading(false)
        if (h.ok) setHighlights(h.highlights || [])
      })
    })
  }, [id])

  // 渲染 EPUB
  useEffect(() => {
    if (!book || !book.file_path || !areaRef.current) return
    let url = book.file_path
    if (!/^https?:\/\//.test(url)) url = window.location.origin + (url.startsWith('/') ? '' : '/') + url
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
  }, [book && book.id, book && book.file_path])

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
        api.bookHighlights(book.id).then(h => { if (h.ok) setHighlights(h.highlights || []) })
      } else alert(d.error || '保存失败')
    })
  }

  const saveNote = (hl) => {
    api.updateHighlight(hl.id, { note: hl.note, tag: hl.tag }).then(d => { if (d.ok) setHighlights(highlights.map(x => x.id === hl.id ? { ...x, note: hl.note, tag: hl.tag } : x)) })
  }
  const delHl = (hl) => {
    if (!confirm('删除这条划线？')) return
    api.deleteHighlight(hl.id).then(d => { if (d.ok) setHighlights(highlights.filter(x => x.id !== hl.id)) })
  }

  const exportMd = () => {
    if (highlights.length === 0) return alert('还没有划线')
    const lines = [
      `# 《${book.title}》划线笔记`,
      `作者：${book.author || '佚名'}｜导出时间：${new Date().toLocaleDateString('zh-CN')}`,
      '',
    ]
    highlights.slice().reverse().forEach((h, i) => {
      lines.push(`> ${h.quote.replace(/\n/g, '\n> ')}`)
      const tags = (h.tag || []).map(t => '#' + t).join(' ')
      if (h.note) lines.push(`\n📝 ${h.note}${tags ? '  ' + tags : ''}`)
      else if (tags) lines.push(`\n${tags}`)
      lines.push(`\n---\n`)
    })
    const md = lines.join('\n')
    navigator.clipboard.writeText(md).then(() => alert('已复制全部划线（Markdown，可直接粘贴到 Obsidian / 飞书文档）')).catch(() => alert('复制失败，请手动复制'))
  }

  if (loading) return <p className="muted pad">加载书籍…</p>
  if (err) return <div className="pad"><p className="err">{err}</p><a className="btn" href="#/">← 返回书房</a></div>
  if (!book) return <p className="muted pad">无此书籍</p>

  return (
    <div className="reader">
      <div className="reader-top">
        <a className="btn sm" href="#/">← 书房</a>
        <b className="reader-title">{book.title}</b>
        <span className="muted">{book.author || ''}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={exportMd} disabled={highlights.length === 0}>导出 Markdown</button>
        <span className="muted">{highlights.length} 条划线</span>
      </div>
      {!book.file_path ? (
        <div className="pad"><p className="err">这本书没有文件路径，回书房补上即可阅读。</p></div>
      ) : (
        <div className="reader-main">
          <div className="reader-area" ref={areaRef} />
          <div className="reader-side">
            <div className="side-head">
              <b>我的划线</b>
              <span className="muted">选中正文可新增</span>
            </div>
            {highlights.length === 0 ? (
              <p className="muted small pad">还没有划线。在正文里拖动选中一段文字，就能记录。</p>
            ) : (
              <div className="hl-list">
                {highlights.map(hl => (
                  <div key={hl.id} className="hl card">
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
                ))}
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
