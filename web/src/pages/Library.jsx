import React, { useEffect, useState } from 'react'
import { api } from '../api'

const CATS = ['全部', '课程', '书籍', 'PDF', 'EPUB']
const STATUS = { '未读': 'w', '在读': 'r', '读完': 'd', '搁置': 'p' }

export default function Library() {
  const [books, setBooks] = useState([])
  const [cat, setCat] = useState('全部')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', author: '', category: '书籍', source: '', status: '未读', file_path: '', note: '' })

  const load = () => {
    setLoading(true)
    api.books().then(d => {
      setLoading(false)
      if (d.ok) setBooks(d.books || [])
      else setErr(d.error || '加载失败')
    })
  }
  useEffect(load, [])

  const add = () => {
    if (!form.title.trim()) return alert('请输入书名')
    api.addBook(form).then(d => {
      if (d.ok) { setShowAdd(false); setForm({ title: '', author: '', category: '书籍', source: '', status: '未读', file_path: '', note: '' }); load() }
      else alert(d.error || '添加失败')
    })
  }

  const setStatus = (b, status) => {
    api.updateBook(b.id, { status }).then(d => { if (d.ok) load() })
  }

  const del = (b) => {
    if (!confirm('删除《' + b.title + '》及其全部划线笔记？')) return
    api.deleteBook(b.id).then(d => { if (d.ok) load() })
  }

  const list = cat === '全部' ? books : books.filter(b => b.category === cat)
  const inRead = books.filter(b => b.status === '在读').length
  const done = books.filter(b => b.status === '读完').length
  const hlTotal = books.reduce((s, b) => s + (b.hl_count || 0), 0)

  return (
    <div className="library">
      <div className="lib-head">
        <div>
          <h2>我的书房</h2>
          <p className="muted">自托管书籍与课程 · 划线沉淀笔记，记录自由流动到飞书 / Obsidian</p>
        </div>
        <button className="btn" onClick={() => setShowAdd(!showAdd)}>{showAdd ? '收起' : '+ 添加书籍'}</button>
      </div>

      {showAdd && (
        <div className="lib-add card">
          <div className="grid2">
            <input placeholder="书名 *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input placeholder="作者" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.keys(STATUS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input placeholder="文件路径（如 /books/xxx.epub 或 https://…）" value={form.file_path} onChange={e => setForm({ ...form, file_path: e.target.value })} />
            <input placeholder="来源（如 得到 / 微信读书 / 自购）" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} />
          </div>
          <input placeholder="备注" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <div className="row-right"><button className="btn primary" onClick={add}>保存</button></div>
        </div>
      )}

      <div className="lib-stats">
        <div className="stat"><b>{books.length}</b><span>藏书</span></div>
        <div className="stat"><b>{inRead}</b><span>在读</span></div>
        <div className="stat"><b>{done}</b><span>读完</span></div>
        <div className="stat"><b>{hlTotal}</b><span>划线</span></div>
      </div>

      <div className="lib-cats">
        {CATS.map(c => <button key={c} className={'chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>)}
      </div>

      {err && <p className="err">{err}</p>}
      {loading ? <p className="muted">加载中…</p> : list.length === 0 ? (
        <div className="empty">
          <p>书架还是空的</p>
          <p className="muted">点右上角「添加书籍」，把 EPUB / PDF / 课程文件放进来，开始你的学习。</p>
        </div>
      ) : (
        <div className="lib-grid">
          {list.map(b => (
            <div key={b.id} className={'book card' + (b.status === '读完' ? ' done' : '')}>
              <div className="book-cover">{b.category === 'EPUB' ? 'EPUB' : b.category === 'PDF' ? 'PDF' : b.category === '课程' ? '课' : '书'}</div>
              <div className="book-body">
                <h3>{b.title}</h3>
                <p className="muted">{b.author || '佚名'} · {b.category}</p>
                <p className="book-note">{b.note || (b.source ? '来自 ' + b.source : '')}</p>
                <div className="book-meta">
                  <span className={'st st-' + (STATUS[b.status] || 'w')}>{b.status}</span>
                  {b.hl_count > 0 && <span className="hl-n">{b.hl_count} 条划线</span>}
                </div>
              </div>
              <div className="book-ops">
                {b.file_path && <a className="btn sm primary" href={'#/reader/' + b.id}>阅读</a>}
                {!b.file_path && <button className="btn sm" onClick={() => alert('这本书还没填文件路径，编辑后即可阅读')}>无文件</button>}
                <div className="row-right">
                  {['未读', '在读', '读完'].map(s => (
                    <button key={s} className={'btn sm' + (b.status === s ? ' on' : '')} onClick={() => setStatus(b, s)}>{s}</button>
                  ))}
                  <button className="btn sm danger" onClick={() => del(b)}>删</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
