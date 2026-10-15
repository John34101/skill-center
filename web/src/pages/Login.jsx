import React, { useState } from 'react'
import { useAuth } from '../store'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const d = await login(email.trim(), password)
    setBusy(false)
    if (!d.ok) { setErr(d.error || '登录失败'); return }
    window.location.hash = '#/'
  }

  return (
    <div className="auth-wrap paper-auth">
      <form className="auth-card paper-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark lg"><i /></span>
          <h1>我的书房</h1>
        </div>
        <p className="sub">登录后继续阅读、划线，并把笔记带走。</p>
        {err && <div className="auth-err">{err}</div>}
        <div className="field">
          <label>邮箱</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? '登录中…' : '进入书房'}</button>
        <div className="auth-foot">还没有账号？<a href="#/register">使用邀请码注册</a></div>
      </form>
    </div>
  )
}
