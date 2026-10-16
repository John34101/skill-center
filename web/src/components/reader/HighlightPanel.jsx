import React from 'react'
import { fmtDate } from '../../api'
import { HL_TAGS, chapterIdFromLoc } from '../../lib/highlights'

export default function HighlightPanel({
  highlights,
  courseMeta,
  onSaveNote,
  onDelete,
  onCollapse,
}) {
  const chapterTitle = (cid) => {
    if (!cid || !courseMeta) return null
    const ch = (courseMeta.chapters || []).find(c => String(c.id) === String(cid))
    return ch ? (ch.title || cid) : cid
  }

  return (
    <aside className="reader-side" aria-label="我的划线">
      <div className="side-head">
        <b>我的划线</b>
        <span className="muted">{highlights.length} 条</span>
        {onCollapse && (
          <button
            type="button"
            className="btn sm ghost side-collapse"
            onClick={onCollapse}
            title="收起划线面板"
          >
            收起
          </button>
        )}
      </div>
      {highlights.length === 0 ? (
        <p className="muted small pad">选中文字后点「划线」或「批注」。</p>
      ) : (
        <div className="hl-list">
          {highlights.map(hl => {
            const cid = chapterIdFromLoc(hl.loc)
            const ctitle = chapterTitle(cid)
            return (
              <div key={hl.id} className="hl card">
                {ctitle && <p className="hl-ch muted small">{ctitle}</p>}
                <p className="hl-quote">“{hl.quote}”</p>
                <textarea
                  className="hl-note" rows={2}
                  placeholder="写点想法…"
                  value={hl.note || ''}
                  onChange={e => onSaveNote({ ...hl, note: e.target.value })}
                />
                <div className="hl-meta">
                  {HL_TAGS.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={'chip sm' + ((hl.tag || []).includes(t) ? ' on' : '')}
                      onClick={() => {
                        const cur = hl.tag || []
                        const tag = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]
                        onSaveNote({ ...hl, tag })
                      }}
                    >{t}</button>
                  ))}
                  <span className="spacer" />
                  <span className="muted small">{fmtDate(hl.created_at)}</span>
                  <button type="button" className="btn sm danger" onClick={() => onDelete(hl)}>删</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

export function NoteDialog({
  noteBox, setNoteBox, saving, onSave,
  title = '写批注',
  confirmLabel = '保存批注',
}) {
  if (!noteBox) return null
  return (
    <div className="mask" onClick={() => setNoteBox(null)}>
      <div className="note-dialog card" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p className="hl-quote">“{noteBox.quote}”</p>
        <textarea
          autoFocus rows={3}
          placeholder="你的想法、疑问或要输出的点…"
          value={noteBox.text}
          onChange={e => setNoteBox({ ...noteBox, text: e.target.value })}
        />
        <div className="hl-meta">
          {HL_TAGS.map(t => (
            <button
              key={t}
              type="button"
              className={'chip sm' + ((noteBox.tag || []).includes(t) ? ' on' : '')}
              onClick={() => {
                const cur = noteBox.tag || []
                setNoteBox({
                  ...noteBox,
                  tag: cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t],
                })
              }}
            >{t}</button>
          ))}
        </div>
        <div className="row-right">
          <button type="button" className="btn ghost" onClick={() => setNoteBox(null)}>取消</button>
          <button type="button" className="btn primary" disabled={saving} onClick={onSave}>
            {saving ? '保存中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
