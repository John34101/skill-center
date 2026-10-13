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
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <h1>Skill 中心</h1>
        <div className="sub">登录后使用今日推荐与工具箱</div>
        {err && <div className="auth-err">{err}</div>}
        <div className="field">
          <label>邮箱</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
        </div>
        <button className="btn primary" style={{ width: '100%', marginTop: 6 }} disabled={busy}>{busy ? '登录中…' : '登录'}</button>
        <div className="auth-foot">还没有账号？<a href="#/register">使用邀请码注册</a></div>
      </form>
    </div>
  )
}
