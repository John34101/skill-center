// 我的书房 API client
const BASE = 'https://api.ilovelearning.top'

let token = localStorage.getItem('sc_token') || ''
export function setToken(t) { token = t || ''; localStorage.setItem('sc_token', token) }
export function getToken() { return token }
export function clearToken() { token = ''; localStorage.removeItem('sc_token') }

async function req(method, path, body) {
  const opt = { method, headers: {} }
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body) }
  if (token) opt.headers['Authorization'] = 'Bearer ' + token
  let r
  try {
    r = await fetch(BASE + path, opt)
  } catch (e) {
    return { ok: false, error: '网络错误，请检查网络后重试' }
  }
  let d = {}
  try { d = await r.json() } catch (e) { d = { ok: false, error: '服务响应异常(' + r.status + ')' } }
  d.status = r.status
  return d
}

export const api = {
  register: (email, password, invite_code) => req('POST', '/api/auth/register', { email, password, invite_code }),
  login: (email, password) => req('POST', '/api/auth/login', { email, password }),
  me: () => req('GET', '/api/auth/me'),
  invite: () => req('POST', '/api/auth/invite'),
  skills: () => req('GET', '/api/skills'),
  skill: (id) => req('GET', '/api/skills/' + id),
  recsToday: () => req('GET', '/api/recs/today'),
  cases: () => req('GET', '/api/cases'),
  feedback: (skill_id, act) => req('POST', '/api/feedback', { skill_id, act }),
  putState: (skill_id, patch) => req('PUT', '/api/states/' + skill_id, patch),
  command: (skill_id, act) => req('POST', '/api/command', { skill_id, act }),
  pending: () => req('GET', '/api/command/pending'),
  adminStats: () => req('GET', '/api/admin/stats'),

  books: () => req('GET', '/api/books'),
  addBook: (b) => req('POST', '/api/books', b),
  updateBook: (id, patch) => req('PUT', '/api/books/' + id, patch),
  deleteBook: (id) => req('DELETE', '/api/books/' + id),
  bookHighlights: (id) => req('GET', '/api/books/' + id + '/highlights'),
  highlights: () => req('GET', '/api/highlights'),
  addHighlight: (h) => req('POST', '/api/highlights', h),
  updateHighlight: (id, patch) => req('PUT', '/api/highlights/' + id, patch),
  deleteHighlight: (id) => req('DELETE', '/api/highlights/' + id),
}

/** 统一划线 tag：API 已返回数组；兼容旧字符串 */
export function parseTags(s) {
  if (Array.isArray(s)) return s
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a : [] } catch (e) { return [] }
}
export function normalizeHighlight(h) {
  if (!h) return h
  return { ...h, tag: parseTags(h.tag) }
}
export function normalizeHighlights(list) {
  return (list || []).map(normalizeHighlight)
}
export function fmtDate(s) { return String(s || '').slice(0, 10) }
