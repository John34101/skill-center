import React, { createContext, useContext, useEffect, useState } from 'react'
import { api, setToken, clearToken } from './api'

const AuthCtx = createContext(null)
export function useAuth() { return useContext(AuthCtx) }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    (async () => {
      if (!localStorage.getItem('sc_token')) { setReady(true); return }
      const d = await api.me()
      if (d.ok && d.user) setUser(d.user)
      else if (d.status === 401) clearToken() // 仅 token 明确失效才清除，网络波动保留待下次恢复
      setReady(true)
    })()
  }, [])

  const login = async (email, password) => {
    const d = await api.login(email, password)
    if (d.ok) { setToken(d.token); setUser(d.user) }
    return d
  }
  const register = async (email, password, invite_code) => {
    const d = await api.register(email, password, invite_code)
    if (d.ok) { setToken(d.token); setUser(d.user) }
    return d
  }
  const logout = () => { clearToken(); setUser(null) }
  const refresh = async () => { const d = await api.me(); if (d.ok && d.user) setUser(d.user) }

  return <AuthCtx.Provider value={{ user, ready, login, register, logout, refresh }}>{children}</AuthCtx.Provider>
}
