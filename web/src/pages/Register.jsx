import React, { useState } from 'react'
import { useAuth } from '../store'

export default function Register() {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (password.length < 8) { setErr('密码至少 8 位'); return }
    setBusy(true)
    const d = await register(email.trim(), password, code.trim().toUpperCase())
    setBusy(false)
    if (!d.ok) { setErr(d.error || '注册失败'); return }
    window.location.hash = '#/'
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>注册 Skill 中心</h1>
        <div className="sub">需要有效的邀请码，请联系管理员获取</div>
        {err && <div className="auth-err">{err}</div>}
        <div className="field">
          <label>邮箱</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
        </div>
        <div className="field">
          <label>密码（至少 8 位）</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <div className="field">
          <label>邀请码</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="如 SK2026A1" required />
        </div>
        <button className="btn primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>{busy ? '注册中…' : '注册'}</button>
        <div className="auth-foot">已有账号？<a href="#/login">直接登录</a></div>
      </form>
    </div>
  )
}
