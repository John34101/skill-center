import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'

const CATS = ['全部', '课程', '书籍', 'PDF', 'EPUB']
const STATUS = { '未读': 'w', '在读': 'r', '读完': 'd', '搁置': 'p' }
const SAMPLE_COURSE = '/courses/sample-efficient-learning/meta.json'
const emptyForm = () => ({
  title: '', author: '', category: '书籍', source: '', status: '未读', file_path: '', note: '',
})

export default function Library() {
  const [books, setBooks] = useState([])
  const [cat, setCat] = useState('全部')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('全部')
  const [initialLoading, setInitialLoading] = useState(true)
  const [err, setErr] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [adding, setAdding] = useState(false)
  const [busyIds, setBusyIds] = useState(() => new Set()) // deleting / status updating
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)
  const booksRef = useRef(books)
  booksRef.current = books

  const flash = useCallback((msg) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2800)
  }, [])

  const markBusy = (id, on) => {
    setBusyIds(prev => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  /** 静默刷新：不清空列表、不闪空白 */
  const softReload = useCallback(() => {
    return api.books().then(d => {
      if (d.ok) setBooks(d.books || [])
      else setErr(d.error || '加载失败')
      return d
    })
  }, [])

  useEffect(() => {
    setInitialLoading(true)
    api.books().then(d => {
      setInitialLoading(false)
      if (d.ok) setBooks(d.books || [])
      else setErr(d.error || '加载失败')
    })
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

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

  const add = async () => {
    if (!form.title.trim()) return flash('请输入书名或课程名')
    if (adding) return
    setAdding(true)
    setErr('')
    const payload = { ...form, title: form.title.trim() }
    const tempId = 'tmp-' + Date.now()
    const optimistic = {
      ...payload,
      id: tempId,
      hl_count: 0,
      _pending: true,
    }
    setBooks(prev => [optimistic, ...prev])
    setShowAdd(false)
    setForm(emptyForm())

    try {
      const d = await api.addBook(payload)
      if (!d.ok) {
        setBooks(prev => prev.filter(b => b.id !== tempId))
        setShowAdd(true)
        setForm(payload)
        flash(d.error || '添加失败，已恢复表单')
        return
      }
      // 用真实 id 替换临时卡，避免整表闪烁
      setBooks(prev => prev.map(b =>
        b.id === tempId
          ? { ...optimistic, id: d.id, _pending: false }
          : b
      ))
      flash('已放入书架')
      softReload() // 后台对齐服务端字段
    } catch (e) {
      setBooks(prev => prev.filter(b => b.id !== tempId))
      setShowAdd(true)
      setForm(payload)
      flash('网络异常，添加未成功')
    } finally {
      setAdding(false)
    }
  }

  const setStatus = async (b, status) => {
    if (String(b.id).startsWith('tmp-') || busyIds.has(b.id)) return
    if (b.status === status) return
    const prevStatus = b.status
    setBooks(list => list.map(x => x.id === b.id ? { ...x, status } : x))
    markBusy(b.id, true)
    try {
      const d = await api.updateBook(b.id, { status })
      if (!d.ok) {
        setBooks(list => list.map(x => x.id === b.id ? { ...x, status: prevStatus } : x))
        flash(d.error || '状态更新失败')
      }
    } catch (e) {
      setBooks(list => list.map(x => x.id === b.id ? { ...x, status: prevStatus } : x))
      flash('网络异常，状态未保存')
    } finally {
      markBusy(b.id, false)
    }
  }

  const del = async (b) => {
    if (String(b.id).startsWith('tmp-') || busyIds.has(b.id)) return
    if (!confirm('删除《' + b.title + '》及其全部划线？')) return
    const snapshot = booksRef.current
    markBusy(b.id, true)
    // 先从列表拿掉，卡片淡出感用 pending 类在删除前一瞬间也可；直接移除更干脆
    setBooks(list => list.filter(x => x.id !== b.id))
    try {
      const d = await api.deleteBook(b.id)
      if (!d.ok) {
        setBooks(snapshot)
        flash(d.error || '删除失败，已恢复')
      } else {
        flash('已从书架移除')
      }
    } catch (e) {
      setBooks(snapshot)
      flash('网络异常，删除未成功')
    } finally {
      markBusy(b.id, false)
    }
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
      {toast && <div className="lib-toast" role="status">{toast}</div>}

      <div className="lib-hero">
        <div>
          <h1 className="lib-title">书架</h1>
          <p className="muted lib-lead">课程文字稿与电子书 · 划线沉淀，导出到 Obsidian / 飞书</p>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={adding}
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? '收起' : '+ 放入书架'}
        </button>
      </div>

      {showAdd && (
        <div className="lib-add paper-card">
          <h3 className="lib-add-tt">添加内容</h3>
          <div className="grid2">
            <input
              placeholder="书名 / 课程名 *"
              value={form.title}
              disabled={adding}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
            <input
              placeholder="作者 / 讲师"
              value={form.author}
              disabled={adding}
              onChange={e => setForm({ ...form, author: e.target.value })}
            />
            <select value={form.category} disabled={adding} onChange={e => onCategoryChange(e.target.value)}>
              {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.status} disabled={adding} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.keys(STATUS).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
              placeholder={form.category === '课程' ? '课程路径 /courses/<id>/meta.json' : '文件路径 /books/xxx.epub'}
              value={form.file_path}
              disabled={adding}
              onChange={e => setForm({ ...form, file_path: e.target.value })}
            />
            <input
              placeholder="来源（得到 / 微信读书 / 自购）"
              value={form.source}
              disabled={adding}
              onChange={e => setForm({ ...form, source: e.target.value })}
            />
          </div>
          <input
            placeholder="备注（可选）"
            value={form.note}
            disabled={adding}
            onChange={e => setForm({ ...form, note: e.target.value })}
          />
          {form.category === '课程' && (
            <p className="muted small lib-hint">
              课程：把文字稿放到 <code>web/public/courses/&lt;id&gt;/</code>，路径填
              <code> /courses/&lt;id&gt;/meta.json</code>。可先用内置示例
              <code> {SAMPLE_COURSE}</code>
            </p>
          )}
          <div className="row-right">
            <button type="button" className="btn ghost" disabled={adding} onClick={() => setShowAdd(false)}>取消</button>
            <button type="button" className="btn primary" disabled={adding} onClick={add}>
              {adding ? (
                <><span className="lib-spin" aria-hidden /> 放入中…</>
              ) : '保存到书架'}
            </button>
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

      {initialLoading && books.length === 0 ? (
        <div className="lib-skel-grid" aria-busy="true" aria-label="加载书架">
          {[1, 2, 3].map(i => (
            <div key={i} className="book paper-card lib-skel">
              <div className="lib-skel-cover" />
              <div className="lib-skel-lines">
                <i /><i /><i />
              </div>
            </div>
          ))}
        </div>
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
          {list.map(b => {
            const pending = b._pending || busyIds.has(b.id)
            const coverCat = b.category === '课程' ? 'course' : b.category === 'EPUB' ? 'epub' : b.category === 'PDF' ? 'pdf' : 'book'
            return (
              <article
                key={b.id}
                className={
                  'book paper-card'
                  + (b.status === '读完' ? ' done' : '')
                  + (pending ? ' is-busy' : '')
                }
              >
                {pending && (
                  <div className="book-busy" aria-hidden>
                    <span className="lib-spin" />
                  </div>
                )}
                <div className={'book-cover cat-' + coverCat}>
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
                  {b.file_path && !String(b.id).startsWith('tmp-')
                    ? <a className="btn sm primary" href={'#/reader/' + b.id}>阅读</a>
                    : <button type="button" className="btn sm ghost" disabled={pending} onClick={() => flash(String(b.id).startsWith('tmp-') ? '正在保存，请稍候' : '请先补全文件路径')}>
                        {String(b.id).startsWith('tmp-') ? '保存中…' : '无文件'}
                      </button>}
                  <div className="row-right wrap">
                    {['未读', '在读', '读完'].map(s => (
                      <button
                        key={s}
                        type="button"
                        disabled={pending}
                        className={'btn sm' + (b.status === s ? ' on' : '')}
                        onClick={() => setStatus(b, s)}
                      >{s}</button>
                    ))}
                    <button type="button" className="btn sm danger" disabled={pending} onClick={() => del(b)}>
                      {busyIds.has(b.id) ? '…' : '删'}
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
