import React, { useEffect, useMemo, useState } from 'react'
import { findPlan } from '../data/plans.js'

const PHASE_COLORS = ['#3B7CF5', '#7C5CF0', '#E0623C', '#2F9E5B']

// ---- 周进度持久化：plan-<id>-w<week> = "0,1,2"（已完成任务索引） ----
function weekKey(planId, w) { return 'plan-' + planId + '-w' + w }
function weekDone(planId, w) {
  try { return (localStorage.getItem(weekKey(planId, w)) || '').split(',').filter(Boolean).map(Number) } catch (e) { return [] }
}
function setWeekDone(planId, w, arr) {
  try { localStorage.setItem(weekKey(planId, w), arr.join(',')) } catch (e) { /* ignore */ }
}

// ---- 自检评分持久化：plan-<id>-check = JSON {维度名: 分数} ----
function loadChecks(planId) {
  try { return JSON.parse(localStorage.getItem('plan-' + planId + '-check') || '{}') } catch (e) { return {} }
}

function levelOf(avg) {
  if (avg < 2) return { t: '新手起步', c: '#E0623C', d: '别急着学技巧，先把输入量堆上去（阶段一投入加倍）' }
  if (avg < 3.5) return { t: '入门阶段', c: '#7C5CF0', d: '按计划双线推进，把 1 分的薄弱项标记出来多分配 20% 精力' }
  return { t: '成熟水平', c: '#2F9E5B', d: '可以直接加速：提前推进或增加难度，重点冲刺风格形成期' }
}

export default function PlanDetail({ id }) {
  const plan = useMemo(() => findPlan(id), [id])
  const [phase, setPhase] = useState(1)
  const [selWeek, setSelWeek] = useState(plan ? plan.weeks[0].w : 1)
  const [checkVals, setCheckVals] = useState({})
  const [, force] = useState(0)

  useEffect(() => {
    if (plan) setCheckVals(loadChecks(plan.id))
  }, [plan])

  if (!plan) return <div className="empty">计划不存在</div>

  const totalWeeks = plan.weeks.length
  const doneWeeks = plan.weeks.filter(w => weekDone(plan.id, w.w).length >= w.tasks.length).length
  const pct = Math.round(doneWeeks / totalWeeks * 100)

  // 自检平均分（未评分维度按最低 1 分计）
  const allItems = plan.selfCheck.flatMap(g => g.items)
  const scored = allItems.map(i => checkVals[i.name] || 1)
  const rated = allItems.filter(i => checkVals[i.name]).length
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length * 10) / 10 : 0
  const lv = levelOf(avg)

  const cur = plan.phases.find(p => p.id === phase)
  const sel = plan.weeks.find(w => w.w === selWeek)
  const selPhase = plan.phases.find(p => p.id === sel.phase)

  const toggleTask = (w, idx) => {
    const arr = weekDone(plan.id, w)
    const i = arr.indexOf(idx)
    if (i >= 0) arr.splice(i, 1); else arr.push(idx)
    arr.sort((a, b) => a - b)
    setWeekDone(plan.id, w, arr)
    force(x => x + 1)
  }

  const setScore = (name, v) => {
    const next = { ...checkVals, [name]: v }
    setCheckVals(next)
    try { localStorage.setItem('plan-' + plan.id + '-check', JSON.stringify(next)) } catch (e) { /* ignore */ }
  }

  return (
    <div>
      {/* ===== 头部 ===== */}
      <div className="pd-head">
        <div className="pd-title-row">
          <div>
            <div className="pd-tag">{plan.tag}</div>
            <h2 className="pd-title">{plan.title}</h2>
            <div className="pd-desc">{plan.desc}</div>
          </div>
          <div className="pd-ov">
            {plan.summary.map((s, i) => (
              <div key={i} className="pd-ov-cell"><span>{s.k}</span><b>{s.v}</b></div>
            ))}
          </div>
        </div>
        <div className="pd-progress">
          <div className="pd-progress-top">
            <span>总体进度</span>
            <b>{doneWeeks}/{totalWeeks} 周 · {pct}%</b>
          </div>
          <div className="plan-bar big"><i style={{ width: pct + '%' }} /></div>
        </div>
      </div>

      {/* ===== 阶段 Tab ===== */}
      <div className="pd-tabs">
        {plan.phases.map(p => (
          <button key={p.id} className={'pd-tab' + (phase === p.id ? ' on' : '')}
            style={phase === p.id ? { borderColor: PHASE_COLORS[p.id - 1], color: PHASE_COLORS[p.id - 1] } : {}}
            onClick={() => {
              setPhase(p.id)
              const first = plan.weeks.find(w => w.phase === p.id)
              setSelWeek(first ? first.w : 1)
            }}>
            <b>{p.name}</b><span>{p.range}</span>
          </button>
        ))}
      </div>

      {/* ===== 当前阶段详情 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head">
          <b style={{ color: PHASE_COLORS[phase - 1] }}>{cur.name} · {cur.range}</b>
          <span>{cur.time}</span>
        </div>
        <div className="pd-goal">{cur.goal}</div>
        <div className="pd-note">{cur.note}</div>
        <div className="pd-sec-tt">每天做什么</div>
        <ul className="pd-list">{cur.daily.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <div className="pd-sec-tt">阶段检验</div>
        <ul className="pd-list check">{cur.check.map((t, i) => <li key={i}>☐ {t}</li>)}</ul>
      </div>

      {/* ===== 24 周时间线 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>24 周时间线</b><span>点击查看当周任务 · 勾选即记录进度</span></div>
        <div className="pd-timeline">
          {plan.weeks.map(w => {
            const ph = plan.phases.find(p => p.id === w.phase)
            const d = weekDone(plan.id, w.w)
            const full = d.length >= w.tasks.length
            const on = w.w === selWeek
            return (
              <button key={w.w} className={'tl-w' + (on ? ' on' : '') + (full ? ' full' : '')}
                style={{ borderColor: on ? PHASE_COLORS[w.phase - 1] : undefined, background: on ? PHASE_COLORS[w.phase - 1] + '14' : undefined }}
                onClick={() => setSelWeek(w.w)}>
                <i className="tl-dot" style={{ background: full ? PHASE_COLORS[w.phase - 1] : undefined }} />
                <span className="tl-num">{w.w}</span>
                <span className="tl-ph" style={{ color: PHASE_COLORS[w.phase - 1] }}>{ph.name}</span>
              </button>
            )
          })}
        </div>

        {/* 选中周任务 */}
        <div className="pd-week">
          <div className="pd-week-head">
            <div>
              <b>第 {sel.w} 周</b>
              <span className="pd-week-theme" style={{ color: PHASE_COLORS[selPhase.id - 1] }}>{sel.theme}</span>
            </div>
            <span className={'pd-week-st' + (weekDone(plan.id, sel.w).length >= sel.tasks.length ? ' done' : '')}>
              {weekDone(plan.id, sel.w).length}/{sel.tasks.length}
            </span>
          </div>
          <ul className="pd-tasks">
            {sel.tasks.map((t, i) => {
              const done = weekDone(plan.id, sel.w).includes(i)
              return (
                <li key={i} className={done ? 'done' : ''} onClick={() => toggleTask(sel.w, i)}>
                  <span className={'pd-check' + (done ? ' on' : '')}>{done ? '✓' : ''}</span>
                  <span>{t}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      {/* ===== 起点自检 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>起点自检</b>
          <span className="pd-self-avg" style={{ color: lv.c }}>
            {rated ? '平均 ' + avg.toFixed(1) + ' · ' + lv.t : '未评分 · 拖动滑块开始自评'}
          </span>
        </div>
        <div className="pd-note">诚实自评，找到薄弱项。1 分的项在对应阶段多分配 20% 精力。未评分维度按最低分 1 计。</div>
        {plan.selfCheck.map(g => (
          <div key={g.group} className="pd-group">
            <div className="pd-group-tt">{g.group}</div>
            {g.items.map(it => (
              <div key={it.name} className="pd-slider-row">
                <div className="pd-slider-info">
                  <b>{it.name}</b>
                  <span className="pd-slider-desc">
                    {(checkVals[it.name] || 1) <= 2 ? it.d1 : (checkVals[it.name] || 1) >= 4 ? it.d5 : it.d3}
                  </span>
                </div>
                <div className="pd-slider">
                  <input type="range" min="1" max="5" step="1" value={checkVals[it.name] || 1}
                    onChange={e => setScore(it.name, Number(e.target.value))} />
                  <span className="pd-slider-val">{checkVals[it.name] || 1}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
        {avg > 0 && <div className="pd-self-lv" style={{ background: lv.c + '12', color: lv.c }}>{lv.d}</div>}
      </div>

      {/* ===== 进度调整指南 ===== */}
      <div className="pd-card">
        <div className="pd-sec-head"><b>进度调整指南</b><span>每 4 周做一次复盘</span></div>
        <div className="pd-guide-grid">
          {plan.guide.map((g, i) => (
            <div key={i} className="pd-guide">
              <b style={{ color: g.type === '加速' ? '#2F9E5B' : '#E0623C' }}>{g.type}的信号</b>
              <ul>{g.signals.map((s, j) => <li key={j}>{s}</li>)}</ul>
              <div className="pd-guide-act" style={{ borderColor: g.type === '加速' ? '#BFE0CB' : '#F0C9C2', color: g.type === '加速' ? '#1F7A3E' : '#B3462E' }}>
                → {g.action}
              </div>
            </div>
          ))}
        </div>
        <div className="pd-sec-tt">遇到瓶颈怎么办</div>
        <div className="pd-bt-grid">
          {plan.bottleneck.map((b, i) => (
            <div key={i} className="pd-bt">
              <b>{b.kind}</b>
              <div className="pd-bt-sym">{b.symptom}</div>
              <div className="pd-bt-fix">{b.fix}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
