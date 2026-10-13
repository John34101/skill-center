import React, { useEffect, useMemo, useState } from 'react'
import { api, parseTags } from '../api'
import Drawer, { stChip } from '../components/Drawer.jsx'

const SCENES = ['教研备课', '口播视频', '家长沟通', '题目解析', '内容创作', '效率工具']
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: '待安装', label: '待安装' },
  { key: '已安装', label: '已安装' },
  { key: '待卸载', label: '待卸载' },
  { key: '不感兴趣', label: '不感兴趣' },
  { key: '需恢复', label: '需恢复' },
]

export default function Market() {
  const [skills, setSkills] = useState(null)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [menuFor, setMenuFor] = useState(0)
  const [busy, setBusy] = useState({})
  const [toast, setToast] = useState('')

  const load = async () => {
    const d = await api.skills()
    if (d.ok) setSkills(d.skills)
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    const close = () => setMenuFor(0)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const showToast = (t) => { setToast(t); setTimeout(() => setToast(''), 2500) }

  const act = async (kind, s) => {
    if (busy[s.id]) return
    setBusy(b => ({ ...b, [s.id]: true }))
    setMenuFor(0)
    let d
    if (kind === 'install') d = await api.command(s.id, '安装')
    else if (kind === 'uninstall') d = await api.command(s.id, '卸载')
    else if (kind === 'recover') d = await api.command(s.id, '恢复')
    else if (kind === 'like') d = await api.feedback(s.id, '感兴趣')
    else if (kind === 'dislike') d = await api.feedback(s.id, '不感兴趣')
    setBusy(b => ({ ...b, [s.id]: false }))
    if (!d.ok) { showToast(d.error || '操作失败'); return }
    showToast(kind === 'install' ? '已提交安装指令，等待同步执行' : '已提交，等待同步')
    load()
  }

  const filtered = useMemo(() => {
    if (!skills) return []
    let list = skills
    if (filter !== 'all') list = list.filter(s => (s.my_status || '未安装') === filter)
    if (q.trim()) {
      const qq = q.trim().toLowerCase()
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(qq) ||
        (s.cn || '').toLowerCase().includes(qq) ||
        (s.desc || '').toLowerCase().includes(qq) ||
        parseTags(s.tags).some(t => t.toLowerCase().includes(qq))
      )
    }
    return list
  }, [skills, filter, q])

  // 按第一个业务归组
  const groups = useMemo(() => {
    const g = {}
    filtered.forEach(s => {
      const biz = parseTags(s.biz)
      const first = SCENES.find(x => biz.includes(x)) || (biz[0] || '未分组')
      ;(g[first] = g[first] || []).push(s)
    })
    return g
  }, [filtered])

  const countOf = (key) => skills ? skills.filter(s => (s.my_status || '未安装') === key).length : 0

  const kebabItems = (s) => {
    const st = s.my_status || '未安装'
    const base = [{ k: 'detail', label: '查看详情' }]
    if (st === '已安装') return [...base, 'sep', { k: 'uninstall', label: '卸载', danger: true }]
    if (st === '待卸载') return [...base]
    if (st === '需恢复') return [...base]
    if (st === '待安装') return [...base, 'sep', { k: 'dislike', label: '不感兴趣' }]
    if (st === '不感兴趣') return [...base, 'sep', { k: 'like', label: '恢复感兴趣' }]
    return [...base, 'sep', { k: 'dislike', label: '不感兴趣' }]
  }

  const rowRight = (s) => {
    const st = s.my_status || '未安装'
    const isRecover = st === '待卸载' || st === '需恢复'
    const isPendingInst = st === '待安装'
    return (
      <div className="tool-right" onClick={e => e.stopPropagation()}>
        {isPendingInst && (
          <button className="btn primary" style={{ minHeight: 28, padding: '3px 12px', fontSize: 12.5 }} disabled={!!busy[s.id]} onClick={() => act('install', s)}>安装</button>
        )}
        {isRecover && (
          <button className="btn" style={{ minHeight: 28, padding: '3px 12px', fontSize: 12.5, background: '#2F9E5B', color: '#fff' }} disabled={!!busy[s.id]} onClick={() => act('recover', s)}>恢复</button>
        )}
        <div className={'kebab' + (menuFor === s.id ? ' open' : '')} onClick={e => e.stopPropagation()}>
          <button className="kebab-btn" aria-label="菜单" onClick={() => setMenuFor(menuFor === s.id ? 0 : s.id)}>⋯</button>
          <div className="kebab-menu">
            {kebabItems(s).map((it, i) => it === 'sep'
              ? <div key={'s' + i} className="mi-sep" />
              : <button key={it.k} className={'mi' + (it.danger ? ' danger' : '')} onClick={() => it.k === 'detail' ? (setMenuFor(0), setOpenId(s.id)) : act(it.k, s)}>
                  {it.label}
                </button>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 120, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--ink)', color: '#fff', padding: '8px 16px', borderRadius: 999, fontSize: 13 }}>{toast}</div>}

      <div className="tool-filters">
        {FILTERS.map(f => (
          <button key={f.key} className={'btn ' + (filter === f.key ? 'on' : '')} onClick={() => setFilter(f.key)}>
            {f.label}{f.key !== 'all' && skills ? <span className="mono" style={{ marginLeft: 4, fontSize: 11 }}>{countOf(f.key)}</span> : null}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <input className="search-input" placeholder="搜索技能名称 / 功能 / 标签" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {!skills && <div className="empty">加载中…</div>}
      {skills && Object.keys(groups).length === 0 && <div className="empty">{q ? `没有找到「${q}」` : '当前筛选下没有技能'}</div>}
      {skills && Object.entries(groups).map(([scene, list]) => (
        <div className="scene-group" key={scene}>
          <div className="scene-title">
            {scene}
            <span className="scene-cnt">{list.length}</span>
          </div>
          <div className="tool-list">
            {list.map(s => {
              const st = s.my_status || '未安装'
              return (
                <div className="tool-row" key={s.id} onClick={() => setOpenId(s.id)}>
                  <span className={'dot ' + (st === '已安装' ? 'inst' : st === '待安装' ? 'missing' : st === '需恢复' || st === '待卸载' ? 'recover' : 'unload')} />
                  <div className="tool-name">
                    {s.cn || s.name}
                    <em>{s.name}</em>
                  </div>
                  <div className="tool-tags">
                    <span className="heat-tag">{s.cat || ''}</span>
                    {parseTags(s.biz).slice(1).map((t, i) => <span key={i} className="heat-tag">{t}</span>)}
                    {s.hot != null && <span className="heat-tag">★ {s.hot}</span>}
                  </div>
                  <div className="tool-tags" style={{ flex: 'none' }}>
                    {st !== '未安装' && <span className={'chip ' + stChip(st)}>{st}</span>}
                  </div>
                  {rowRight(s)}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <Drawer skillId={openId} onClose={() => setOpenId(null)} onChange={load} />
    </div>
  )
}
