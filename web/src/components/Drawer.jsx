import React, { useEffect, useState } from 'react'
import { api, parseTags, fmtDate } from '../api'

// 详情抽屉：展示技能详情、我的状态、案例、手册
export default function Drawer({ skillId, onClose, onChange }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState({})

  useEffect(() => {
    if (!skillId) return
    setData(null)
    api.skill(skillId).then(d => { if (d.ok) setData(d) })
  }, [skillId])

  useEffect(() => {
    document.body.classList.add('drawer-lock')
    return () => document.body.classList.remove('drawer-lock')
  }, [])

  if (!skillId) return null
  const s = data && data.skill
  const st = data && data.my_state

  const act = async (fn) => {
    setBusy(b => ({ ...b, [fn]: true }))
    const d = await (fn === 'like' ? api.feedback(s.id, '感兴趣')
      : fn === 'dislike' ? api.feedback(s.id, '不感兴趣')
      : fn === 'good' ? api.feedback(s.id, '有用')
      : fn === 'bad' ? api.feedback(s.id, '没用')
      : api.command(s.id, '安装'))
    setBusy(b => ({ ...b, [fn]: false }))
    if (d.ok) {
      const dd = await api.skill(s.id)
      if (dd.ok) setData(dd)
      onChange && onChange()
    }
  }

  return (
    <>
      <div id="mask" className={'show'} onClick={onClose} />
      <div id="drawer" className={'open'}>
        <div className="drawer-in">
          {!data ? (
            <div className="empty">加载中…</div>
          ) : (
            <>
              <div className="drawer-head">
                <div>
                  <b>{s.cn || s.name}</b>
                  <div className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{s.name}</div>
                </div>
                <button className="drawer-close" onClick={onClose}>✕</button>
              </div>

              {st && (st.status || st.rating) ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {st.status && <span className={'chip ' + stChip(st.status)}>{st.status}</span>}
                  {st.rating && <span className={'chip ' + stChip(st.rating)}>{st.rating}</span>}
                </div>
              ) : <span className="chip rate-none">未评价</span>}

              <div className="desc-line">{s.desc || '暂无说明'}</div>

              <div className="meta-grid">
                <div className="meta-cell"><div className="k">类别</div><div className="v">{s.cat || '—'}</div></div>
                <div className="meta-cell"><div className="k">热度</div><div className="v mono">{s.hot ?? '—'}</div></div>
                <div className="meta-cell"><div className="k">安装注册名</div><div className="v">{s.reg || '—'}</div></div>
                <div className="meta-cell"><div className="k">评分</div><div className="v mono">{s.score ?? '—'}</div></div>
              </div>

              <div className="drawer-sec">功能标签</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(s.tags ? parseTags(s.tags) : []).map((t, i) => <span key={i} className="chip t-chip">{t}</span>)}
              </div>

              <div className="drawer-sec">对应业务</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(s.biz ? parseTags(s.biz) : []).map((t, i) => <span key={i} className="chip interested">{t}</span>)}
              </div>

              {s.note && <div className="drawer-sec">备注</div>}
              {s.note && <div className="hb-line">{s.note}</div>}

              {data.cases && data.cases.length > 0 && (
                <>
                  <div className="drawer-sec">用法案例</div>
                  {data.cases.map(c => (
                    <div key={c.id} className="hb-line" style={{ marginBottom: 8 }}>
                      <b>{c.name || '案例'}</b>
                      <div style={{ color: 'var(--ink-2)', marginTop: 3 }}>{c.effect || c.steps || ''}</div>
                      {c.link && <div style={{ marginTop: 4 }}><a href={c.link} target="_blank" rel="noreferrer">查看产物 ↗</a></div>}
                    </div>
                  ))}
                </>
              )}

              {data.handbook && data.handbook.content && (
                <>
                  <div className="drawer-sec">技能手册</div>
                  <div className="hb-line" style={{ whiteSpace: 'pre-wrap' }}>{String(data.handbook.content).slice(0, 600)}</div>
                </>
              )}

              <div className="drawer-acts">
                {st && st.status === '已安装' ? (
                  <>
                    <button className="btn sub" disabled={busy.good} onClick={() => act('good')}>好用</button>
                    <button className="btn sub" disabled={busy.bad} onClick={() => act('bad')}>没用</button>
                  </>
                ) : (
                  <>
                    <button className="btn primary" disabled={busy.like || (st && st.status === '待安装')} onClick={() => act('like')}>感兴趣</button>
                    <button className="btn ghost" disabled={busy.dislike || (st && st.status === '不感兴趣')} onClick={() => act('dislike')}>不感兴趣</button>
                    <button className="btn sub" disabled={busy.inst} onClick={() => act('inst')}>安装</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export function stChip(v) {
  if (v === '已安装' || v === '好用') return 'inst'
  if (v === '待安装') return 'missing'
  if (v === '需恢复') return 'recover'
  if (v === '不感兴趣' || v === '待卸载' || v === '没用') return 'rate-bad'
  if (v === '一般') return 'rate-mid'
  return 'rate-none'
}
