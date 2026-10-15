import React, { useState } from 'react'
import { useAuth } from '../store'

export default function Register() {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    const d = await register(email.trim(), password, invite.trim())
    setBusy(false)
    if (!d.ok) { setErr(d.error || '注册失败'); return }
    window.location.hash = '#/'
  }

  return (
    <div className="auth-wrap paper-auth">
      <form className="auth-card paper-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark lg"><i /></span>
          <h1>加入书房</h1>
        </div>
        <p className="sub">邀请制注册 · 对内使用</p>
        {err && <div className="auth-err">{err}</div>}
        <div className="field">
          <label>邮箱</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
        </div>
        <div className="field">
          <label>邀请码</label>
          <input value={invite} onChange={e => setInvite(e.target.value)} placeholder="请输入邀请码" required />
        </div>
        <button type="submit" className="btn primary block" disabled={busy}>{busy ? '提交中…' : '注册并进入'}</button>
        <div className="auth-foot">已有账号？<a href="#/login">去登录</a></div>
      </form>
    </div>
  )
}
