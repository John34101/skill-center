import React from 'react'
import { plans } from '../data/plans.js'

export default function Plans() {
  return (
    <div>
      <div className="sec-head" style={{ marginBottom: 6 }}>
        <span className="sec-tt">学习计划</span>
        <span className="sec-sub">我的专属学习路线 · 共 {plans.length} 个计划</span>
      </div>
      <div className="plan-list">
        {plans.map(p => {
          const done = localStorage.getItem('plan-done-' + p.id)
          const total = p.weeks.length
          const n = done ? done.split(',').filter(Boolean).length : 0
          const pct = Math.round(n / total * 100)
          return (
            <a key={p.id} className="plan-card" href={'#/plans/' + p.id}>
              <div className="plan-card-top">
                <span className="plan-tag">{p.tag}</span>
                <span className="plan-pct">{pct}%</span>
              </div>
              <div className="plan-title">{p.title}</div>
              <div className="plan-desc">{p.desc}</div>
              <div className="plan-meta">
                {p.summary.map((s, i) => (
                  <span key={i} className="plan-sum"><b>{s.k}</b>{s.v}</span>
                ))}
              </div>
              <div className="plan-bar"><i style={{ width: pct + '%' }} /></div>
              <div className="plan-foot">已完成 {n}/{total} 周 · 进入计划 →</div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
