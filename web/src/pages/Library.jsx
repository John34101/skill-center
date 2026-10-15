import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const CATS = ['全部', '课程', '书籍', 'PDF', 'EPUB']
const STATUS = { '未读': 'w', '在读': 'r', '读完': 'd', '搁置': 'p' }
const SAMPLE_COURSE = '/courses/sample-efficient-learning/meta.json'

export default function Library() {
  const [books, setBooks] = useState([])
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    title: '', author: '', category: '书籍', source: '', status: '未读', file_path: '', note: '',
  })

  const load = () => {
    setLoading(true)
    api.books().then(d => {
      setLoading(false)
      if (d.ok) setBooks(d.books || [])
      else setErr(d.error || '加载失败')
    })
  }
  useEffect(load, [])

  const onCategoryChange = (category) => {
    const next = { ...form, category }
    if (category === '课程' && !form.file_path.trim()) {
      next.file_path = SAMPLE_COURSE
      if (!next.title.trim()) next.title = '如何高效学习'
      if (!next.author.trim()) next.author = '示例讲师'
      if (!next.source.trim()) next.source = '得到（示例）'
    }
    setForm(next)
  }

  const add = () => {
    if (!form.title.trim()) return alert('请输入书名或课程名')
    api.addBook(form).then(d => {
      if (d.ok) {
        setShowAdd(false)
        setForm({ title: '', author: '', category: '书籍', source: '', status: '未读', file_path: '', note: '' })
        load()
      } else alert(d.error || '添加失败')
    })
  }

  const setStatus = (b, status) => {
    api.updateBook(b.id, { status }).then(d => { if (d.ok) load() })
  }

  const del = (b) => {
    if (!confirm('删除《' + b.title + '》及其全部划线？')) return
    api.deleteBook(b.id).then(d => { if (d.ok) load() })
  }

  const list = useMemo(() => {
    let rows = books
    if (cat !== '全部') rows = rows.filter(b => b.category === cat)
    if (statusFilter !== '全部') rows = rows.filter(b => b.status === statusFilter)
    const qq = q.trim().toLowerCase()
    if (qq) {
      rows = rows.filter(b =>
        [b.title, b.author, b.source, b.note].join(' ').toLowerCase().includes(qq)
      )
    }
    return rows
  }, [books, cat, statusFilter, q])

  const inRead = books.filter(b => b.status === '在读').length
  const done = books.filter(b => b.status === '读完').length
  const hlTotal = books.reduce((s, b) => s + (b.hl_count || 0), 0)

  return (
    <div className="library">
      <div className="lib-hero">
        <div>
          <h1 className="lib-title">书架</h1>
          <p className="muted lib-lead">课程文字稿与电子书 · 划线沉淀，导出到 Obsidian / 飞书</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '收起' : '+ 放入书架'}
        </button>
      </div>

      {showAdd && (
        <div className="lib-add paper-card">
          <h3 className="lib-add-tt">添加内容</h3>
          <div className="grid2">
            <input placeholder="书名 / 课程名 *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input placeholder="作者 / 讲师" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
            <select value={form.category} onChange={e => onCategoryChange(e.target.value)}>
              {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.keys(STATUS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              placeholder={form.category === '课程' ? '课程路径 /courses/<id>/meta.json' : '文件路径 /books/xxx.epub'}
              value={form.file_path}
              onChange={e => setForm({ ...form, file_path: e.target.value })}
            />
            <input placeholder="来源（得到 / 微信读书 / 自购）" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
          </div>
          <input placeholder="备注（可选）" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          {form.category === '课程' && (
            <p className="muted small lib-hint">
              课程：把文字稿放到 <code>web/public/courses/&lt;id&gt;/</code>，路径填
              <code> /courses/&lt;id&gt;/meta.json</code>。可先用内置示例
              <code> {SAMPLE_COURSE}</code>
            </p>
          )}
          <div className="row-right">
            <button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>取消</button>
            <button type="button" className="btn primary" onClick={add}>保存到书架</button>
          </div>
        </div>
      )}

      <div className="lib-stats">
        <div className="stat"><b>{books.length}</b><span>藏书</span></div>
        <div className="stat"><b>{inRead}</b><span>在读</span></div>
        <div className="stat"><b>{done}</b><span>读完</span></div>
        <div className="stat"><b>{hlTotal}</b><span>划线</span></div>
      </div>

      <div className="lib-toolbar">
        <input
          className="lib-search"
          placeholder="搜索书名、作者、来源…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="lib-cats">
          {CATS.map(c => (
            <button key={c} type="button" className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="lib-cats">
          {['全部', '未读', '在读', '读完', '搁置'].map(s => (
            <button key={s} type="button" className={'chip soft' + (statusFilter === s ? ' on' : '')} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      {err && <p className="err">{err}</p>}
      {loading ? (
        <p className="muted">整理书架…</p>
      ) : list.length === 0 ? (
        <div className="empty paper-empty">
          <p className="empty-tt">{books.length === 0 ? '书架还是空的' : '没有符合条件的书'}</p>
          <p className="muted">
            {books.length === 0
              ? '点右上角「放入书架」，添加一门课程文字稿或一本 EPUB。'
              : '试试清空搜索或换一个分类。'}
          </p>
          {books.length === 0 && (
            <button type="button" className="btn primary" onClick={() => { setShowAdd(true); onCategoryChange('课程') }}>
              放入示例课程
            </button>
          )}
        </div>
      ) : (
        <div className="lib-grid">
          {list.map(b => (
            <article key={b.id} className={'book paper-card' + (b.status === '读完' ? ' done' : '')}>
              <div className={'book-cover cat-' + (b.category === '课程' ? 'course' : b.category === 'EPUB' ? 'epub' : b.category === 'PDF' ? 'pdf' : 'book')}>
                {b.category === '课程' ? '课' : b.category === 'EPUB' ? 'E' : b.category === 'PDF' ? 'P' : '书'}
              </div>
              <div className="book-body">
                <h3>{b.title}</h3>
                <p className="muted">{b.author || '佚名'} · {b.category}</p>
                <p className="book-note">{b.note || (b.source ? '来自 ' + b.source : '暂无备注')}</p>
                <div className="book-meta">
                  <span className={'st st-' + (STATUS[b.status] || 'w')}>{b.status}</span>
                  {b.hl_count > 0 && <span className="hl-n">{b.hl_count} 条划线</span>}
                </div>
              </div>
              <div className="book-ops">
                {b.file_path
                  ? <a className="btn sm primary" href={'#/reader/' + b.id}>阅读</a>
                  : <button type="button" className="btn sm ghost" onClick={() => alert('请先补全文件路径')}>无文件</button>}
                <div className="row-right wrap">
                  {['未读', '在读', '读完'].map(s => (
                    <button key={s} type="button" className={'btn sm' + (b.status === s ? ' on' : '')} onClick={() => setStatus(b, s)}>{s}</button>
                  ))}
                  <button type="button" className="btn sm danger" onClick={() => del(b)}>删</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
