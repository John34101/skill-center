import React, { useEffect, useState } from 'react'
import { api, parseTags } from '../api'
import Drawer, { stChip } from '../components/Drawer.jsx'

function FeedCard({ r, onOpen, onChange }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const isInstalled = r.my_status === '已安装'

  const act = async (fn, actName) => {
    if (busy) return
    setBusy(true); setMsg('')
    onChange && onChange(r, actName) // 乐观更新：点击立即改标签，不等接口
    const d = await api.feedback(r.skill_id, actName)
    setBusy(false)
    if (!d.ok) { setMsg(d.error || '失败'); onChange && onChange(r, '__reload'); return }
  }

  return (
    <div className="card feed-card" onClick={() => onOpen(r.skill_id)}>
      <div>
        <div className="fc-name">{r.cn || r.name}</div>
        <span className="fc-en">{r.name}</span>
      </div>
      <div className="fc-why">{r.why || r.desc}</div>
      <div className="fc-meta">
        <span className="heat-tag">★ {r.hot ?? '—'}</span>
        {r.my_status && <span className={'chip ' + stChip(r.my_status)}>{r.my_status}</span>}
        {r.my_rating && <span className={'chip ' + stChip(r.my_rating)}>{r.my_rating}</span>}
      </div>
      <div className="fc-tags">
        {(r.tags ? parseTags(r.tags) : []).slice(0, 3).map((t, i) => <span key={i} className="tag">{t}</span>)}
      </div>
      {msg && <div style={{ fontSize: 12, color: 'var(--red)' }}>{msg}</div>}
      <div className="fc-acts" onClick={e => e.stopPropagation()}>
        {isInstalled ? (
          <>
            <button className="btn sub" disabled={busy} onClick={() => act('good', '有用')}>好用</button>
            <button className="btn sub" disabled={busy} onClick={() => act('bad', '没用')}>没用</button>
          </>
        ) : (
          <>
            <button className={'btn ' + (r.my_status === '待安装' ? 'locked' : 'primary')} disabled={busy} onClick={() => act('like', '感兴趣')}>感兴趣</button>
            <button className={'btn ' + (r.my_status === '不感兴趣' ? 'locked' : 'ghost')} disabled={busy} onClick={() => act('dislike', '不感兴趣')}>不感兴趣</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [openId, setOpenId] = useState(null)

  const load = async () => {
    const d = await api.recsToday()
    if (!d.ok) { setErr(d.error || '加载失败'); return }
    setData(d)
  }
  useEffect(() => { load() }, [])

  // 点击反馈后的乐观更新：立即把卡片标签改为目标状态，
  // 失败或无参数（抽屉内操作）时以重拉兜底
  const onFeedback = (r, actName) => {
    if (!r || !actName || actName === '__reload') { load(); return }
    const st = actName === '感兴趣' ? '待安装' : actName === '不感兴趣' ? '不感兴趣' : null
    if (!st) { load(); return }
    setData(d => d && ({
      ...d,
      personal: d.personal.map(x => x.id === r.id ? { ...x, my_status: st } : x),
      hot: d.hot.map(x => x.id === r.id ? { ...x, my_status: st } : x),
    }))
  }

  const sec = (title, sub, items) => (
    <div className="section">
      <div className="sec-head">
        <span className="sec-tt">{title}</span>
        <span className="sec-sub">{sub}</span>
      </div>
      {items.length === 0 ? (
        <div className="empty">暂无推荐</div>
      ) : (
        <div className="feed-grid">
          {items.map(r => <FeedCard key={r.id} r={r} onOpen={setOpenId} onChange={onFeedback} />)}
        </div>
      )}
    </div>
  )

  return (
    <div>
      {err && <div className="auth-err" style={{ marginBottom: 16 }}>{err}</div>}
      {!data && !err && <div className="empty">加载中…</div>}
      {data && (
        <>
          {sec('为你推荐', '基于你的教学/内容业务精选 · 推荐批次 ' + (data.batch || ''), data.personal || [])}
          {sec('全网热门', 'GitHub 与中文社区最热 · 不设相关筛选', data.hot || [])}
        </>
      )}
      <Drawer skillId={openId} onClose={() => setOpenId(null)} onChange={onFeedback} />
    </div>
  )
}
