import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api'
import Drawer from '../components/Drawer.jsx'

export default function Cases() {
  const [cases, setCases] = useState(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [skillMap, setSkillMap] = useState({})

  useEffect(() => {
    api.cases().then(d => { if (d.ok) setCases(d.cases) })
    api.skills().then(d => {
      if (d.ok) {
        const m = {}
        d.skills.forEach(s => { m[s.id] = s })
        setSkillMap(m)
      }
    })
  }, [])

  const filtered = cases ? cases.filter(c => {
    if (!q.trim()) return true
    const qq = q.trim().toLowerCase()
    return (c.name || '').toLowerCase().includes(qq) ||
      (c.skill_name || '').toLowerCase().includes(qq) ||
      (c.scene || '').toLowerCase().includes(qq) ||
      (c.effect || '').toLowerCase().includes(qq)
  }) : []

  return (
    <div>
      <div className="tool-filters">
        <span className="sec-tt" style={{ marginRight: 8 }}>用法案例</span>
        <span style={{ flex: 1 }} />
        <input className="search-input" placeholder="搜索案例 / 技能" value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {!cases && <div className="empty">加载中…</div>}
      {cases && filtered.length === 0 && <div className="empty">{q ? `没有找到「${q}」` : '暂无案例'}</div>}
      {cases && (
        <div className="case-grid">
          {filtered.map(c => (
            <div className="card case-card" key={c.id}>
              {c.cover && <img className="case-cover" src={c.cover} alt={c.name} onError={e => { e.target.style.display = 'none' }} />}
              <div className="case-top">
                <b>{c.name}</b>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{fmtDate(c.date)}</span>
              </div>
              <div className="case-meta">
                <span
                  className="skill-link"
                  onClick={() => { const sk = skillMap[c.skill_id]; if (sk) setOpenId(sk.id) }}
                >
                  {c.skill_cn || c.skill_name || '#' + c.skill_id}
                </span>
                {c.scene && <span className="chip t-chip">{c.scene}</span>}
                {c.kind && <span className="chip t-chip">{c.kind}</span>}
              </div>
              <div className="case-steps">{c.steps || c.effect || c.note || ''}</div>
              {c.note && <div className="case-note">{c.note}</div>}
              <div className="case-foot">
                <span>{c.effect ? '效果：' + c.effect : ''}</span>
                {c.link && <a href={c.link} target="_blank" rel="noreferrer">查看产物 ↗</a>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Drawer skillId={openId} onClose={() => setOpenId(null)} />
    </div>
  )
}
