import React from 'react'
import { plans } from '../data/plans.js'

// 周进度统计：与 PlanDetail 写入的 key 保持一致（plan-<id>-w<周>）
function weekDoneCount(plan) {
  let n = 0
  try {
    plan.weeks.forEach(w => {
      const arr = (localStorage.getItem('plan-' + plan.id + '-w' + w.w) || '').split(',').filter(Boolean)
      if (arr.length >= w.tasks.length) n++
    })
  } catch (e) { /* ignore */ }
  return n
}

export default function Plans() {
  const totalWeeks = plans.reduce((a, p) => a + p.weeks.length, 0)
  const doneWeeks = plans.reduce((a, p) => a + weekDoneCount(p), 0)
  const totalPct = totalWeeks ? Math.round(doneWeeks / totalWeeks * 100) : 0

  return (
    <div>
      {/* ===== Hero ===== */}
      <div className="hc-hero">
        <div className="hc-hero-tag">我的专属学习中心</div>
        <h1 className="hc-hero-tt">今天学点什么？</h1>
        <p className="hc-hero-desc">这里装着我正在学的一切：提升审美的、玩转 AI 工具的、以后还会不断加入的新计划。点开一个，接着往下走。</p>
        <div className="hc-stats">
          <div className="hc-stat"><b>{plans.length}</b><span>进行中的计划</span></div>
          <div className="hc-stat"><b>{doneWeeks}/{totalWeeks}</b><span>已完成周任务</span></div>
          <div className="hc-stat"><b>{totalPct}%</b><span>总体进度</span></div>
        </div>
      </div>

      {/* ===== 计划列表 ===== */}
      <div className="sec-head" style={{ margin: '22px 0 10px' }}>
        <span className="sec-tt">我的学习计划</span>
        <span className="sec-sub">点击进入 · 进度自动保存</span>
      </div>
      <div className="plan-list">
        {plans.map(p => {
          const n = weekDoneCount(p)
          const total = p.weeks.length
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

      {/* ===== 未来计划占位 ===== */}
      <div className="hc-more">
        <div className="hc-more-ic">＋</div>
        <div>
          <b>新的学习计划正在路上</b>
          <p>把想系统学的东西告诉我，我会把它变成和上面一样可勾选、有进度的计划。</p>
        </div>
      </div>
    </div>
  )
}
