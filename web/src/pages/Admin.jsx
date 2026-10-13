import React, { useEffect, useState } from 'react'
import { api, fmtDate } from '../api'

export default function Admin({ stats }) {
  const [pending, setPending] = useState([])
  const [newCode, setNewCode] = useState('')
  const [busy, setBusy] = useState({})
  const [msg, setMsg] = useState('')

  const load = async () => {
    const d = await api.pending()
    if (d.ok) setPending(d.pending)
  }
  useEffect(() => { load() }, [])

  const genInvite = async () => {
    const d = await api.invite()
    if (d.ok) { setNewCode(d.code); setMsg('新邀请码：' + d.code) }
    else setMsg(d.error || '生成失败')
  }

  const report = async (cmd, status) => {
    if (busy[cmd.id]) return
    setBusy(b => ({ ...b, [cmd.id]: true }))
    const d = await (async () => {
      // 通过 command/report 接口回写（需要真实 CLI 执行时由 agent 处理；此处提供标记已完成/失败入口）
      const r = await fetch('https://api.ilovelearning.top/api/command/' + cmd.id + '/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('sc_token') },
        body: JSON.stringify({ status, result: status === '已完成' ? '管理员确认' : '管理员标记失败' }),
      })
      return r.json()
    })()
    setBusy(b => ({ ...b, [cmd.id]: false }))
    if (d.ok) { setMsg('指令 #' + cmd.id + ' 已标记 ' + status); load() }
    else setMsg(d.error || '回写失败')
  }

  const cards = [
    { k: '用户数', v: stats ? stats.users : '—' },
    { k: '技能数', v: stats ? stats.skills : '—' },
    { k: '推荐数', v: stats ? stats.recs : '—' },
    { k: '指令总数', v: stats ? stats.commands : '—' },
    { k: '未用邀请码', v: stats ? stats.unused_invites : '—' },
  ]

  return (
    <div>
      <div className="sec-head"><span className="sec-tt">数据概览</span></div>
      <div className="admin-grid">
        {cards.map(c => (
          <div className="stat-card" key={c.k}>
            <div className="k">{c.k}</div>
            <div className="v">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="sec-head">
          <span className="sec-tt">邀请码</span>
          <button className="btn primary" onClick={genInvite}>生成新邀请码</button>
        </div>
        {newCode && <div className="auth-ok">新邀请码：<b className="mono">{newCode}</b></div>}
      </div>

      <div className="section">
        <div className="sec-head">
          <span className="sec-tt">待处理指令</span>
          <span className="sec-sub">实际安装/卸载由 CLI 执行后回写</span>
        </div>
        {msg && <div className="auth-err" style={{ marginBottom: 12 }}>{msg}</div>}
        {pending.length === 0 ? (
          <div className="empty">当前没有待处理指令</div>
        ) : (
          <div className="inbox-list">
            {pending.map(c => (
              <div className="inbox-row" key={c.id}>
                <span className="inbox-name">
                  {c.skill_name}
                  <em>#{c.id} · {c.act} · {fmtDate(c.created_at)}</em>
                </span>
                <span className="chip missing">{c.status}</span>
                <span className="inbox-why">{c.reg || '—'}</span>
                <div className="inbox-acts">
                  <button className="btn sub" disabled={!!busy[c.id]} onClick={() => report(c, '已完成')}>标记已完成</button>
                  <button className="btn danger" disabled={!!busy[c.id]} onClick={() => report(c, '失败')}>标记失败</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
