/* ============================================================
 * Skill 管理中心 · 产品化 API Worker (P0)
 * 版本 v3.1.0（2026-10-13 M4：移除旧版兼容端点 + KV 限流）
 * 路径: /api/*  产品 API（D1 + JWT 账号体系）
 * 环境变量：JWT_SECRET（必填）
 * 绑定：skill_center_db（D1 主库）、AUTH（KV，限流计数）
 * ============================================================ */

const FB_TYPES   = ["有用", "没用", "请求试用", "评分", "吐槽", "感兴趣", "不感兴趣"];
const ACTS       = ["安装", "卸载", "恢复"];

/* ---------- 工具 ---------- */
function json(res, status) {
  return new Response(JSON.stringify(res), { status, headers: { "Content-Type": "application/json" } });
}
function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}
function nowText() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/* ---------- base64url + HMAC（Web Crypto，Workers 兼容） ---------- */
const te = new TextEncoder();
function b64urlEncode(uint8) {
  let bin = "";
  for (let i = 0; i < uint8.length; i++) bin += String.fromCharCode(uint8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, te.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}
async function hmacVerify(data, sigB64, secret) {
  try {
    const key = await crypto.subtle.importKey("raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, b64urlDecode(sigB64), te.encode(data));
  } catch (e) { return false; }
}

/* ---------- JWT (HS256) ---------- */
async function makeToken(payload, secret) {
  const header = b64urlEncode(te.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  payload.exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const body = b64urlEncode(te.encode(JSON.stringify(payload)));
  const sig = await hmacSign(header + "." + body, secret);
  return header + "." + body + "." + sig;
}
async function verifyToken(token, secret) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;
    const ok = await hmacVerify(parts[0] + "." + parts[1], parts[2], secret);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

/* ---------- 密码哈希 (PBKDF2) ---------- */
async function hashPwd(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
  return "pbkdf2$" + b64urlEncode(salt) + "$" + b64urlEncode(new Uint8Array(bits));
}
async function verifyPwd(password, stored) {
  try {
    const parts = String(stored).split("$");
    if (parts.length !== 3) return false;
    const salt = b64urlDecode(parts[1]);
    const expect = b64urlDecode(parts[2]);
    const key = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, key, 256);
    const calc = new Uint8Array(bits);
    if (calc.length !== expect.length) return false;
    let same = true;
    for (let i = 0; i < calc.length; i++) if (calc[i] !== expect[i]) { same = false; break; }
    return same;
  } catch (e) { return false; }
}

/* ---------- 鉴权 ---------- */
async function requireAuth(req, env) {
  const ah = req.headers.get("Authorization") || "";
  const token = ah.startsWith("Bearer ") ? ah.slice(7) : null;
  if (!token) return null;
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload || !payload.uid) return null;
  const row = await env.skill_center_db.prepare("SELECT id,email,nickname,tags,role,created_at FROM users WHERE id=?")
    .bind(payload.uid).first();
  if (!row) return null;
  return row;
}

/* ============================================================
 * 产品 API（/api/*）
 * ============================================================ */
async function handleApi(req, env, url) {
  const db = env.skill_center_db;
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = req.method;

  /* ---- POST /auth/register ---- */
  if (path === "/auth/register" && method === "POST") {
    const b = await req.json();
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    const code = String(b.invite_code || "").trim().toUpperCase();
    const nickname = String(b.nickname || "").trim() || email.split("@")[0];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ ok: false, error: "邮箱格式不正确" }, 400);
    if (password.length < 6) return json({ ok: false, error: "密码至少 6 位" }, 400);
    if (!code) return json({ ok: false, error: "需要邀请码" }, 400);
    const existing = await db.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if (existing) return json({ ok: false, error: "该邮箱已注册" }, 409);
    const inv = await db.prepare("SELECT code FROM invite_codes WHERE code=? AND used_by IS NULL").bind(code).first();
    if (!inv) return json({ ok: false, error: "邀请码无效或已被使用" }, 400);
    const pwd = await hashPwd(password);
    const r = await db.prepare("INSERT INTO users(email,password_hash,nickname,role) VALUES(?,?,?,?) RETURNING id,email,nickname,role")
      .bind(email, pwd, nickname, "user").first();
    await db.prepare("UPDATE invite_codes SET used_by=?, used_at=? WHERE code=?").bind(r.id, nowText(), code).run();
    const token = await makeToken({ uid: r.id, role: r.role }, env.JWT_SECRET);
    return json({ ok: true, token, user: { id: r.id, email: r.email, nickname: r.nickname, role: r.role } });
  }

  /* ---- POST /auth/login ---- */
  if (path === "/auth/login" && method === "POST") {
    const b = await req.json();
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    const u = await db.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if (!u || !(await verifyPwd(password, u.password_hash))) return json({ ok: false, error: "邮箱或密码错误" }, 401);
    const token = await makeToken({ uid: u.id, role: u.role }, env.JWT_SECRET);
    return json({ ok: true, token, user: { id: u.id, email: u.email, nickname: u.nickname, tags: u.tags, role: u.role } });
  }

  /* ---- GET /auth/me ---- */
  if (path === "/auth/me" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    return json({ ok: true, user: u });
  }

  /* ---- POST /auth/invite (admin) ---- */
  if (path === "/auth/invite" && method === "POST") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    if (u.role !== "admin") return json({ ok: false, error: "仅管理员可生成邀请码" }, 403);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    await db.prepare("INSERT INTO invite_codes(code) VALUES(?)").bind(code).run();
    return json({ ok: true, code });
  }

  /* ---- GET /skills ---- */
  if (path === "/skills" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const rows = await db.prepare(
      `SELECT s.id,s.name,s.cn,s.cat,s.tags,s.biz,s.hot,s.source,s.reg,s.score,s.desc,s.note,
              ss.status AS my_status, ss.rating AS my_rating
       FROM skills s LEFT JOIN user_skill_states ss ON ss.skill_id=s.id AND ss.user_id=?
       ORDER BY s.id`
    ).bind(u.id).all();
    return json({ ok: true, skills: rows.results });
  }

  /* ---- GET /skills/:id ---- */
  const mSkill = path.match(/^\/skills\/(\d+)$/);
  if (mSkill && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const sid = Number(mSkill[1]);
    const skill = await db.prepare("SELECT * FROM skills WHERE id=?").bind(sid).first();
    if (!skill) return json({ ok: false, error: "技能不存在" }, 404);
    const myState = await db.prepare("SELECT status,rating,note FROM user_skill_states WHERE user_id=? AND skill_id=?")
      .bind(u.id, sid).first();
    const cases = await db.prepare("SELECT * FROM cases WHERE skill_id=? ORDER BY date DESC").bind(sid).all();
    const handbook = await db.prepare("SELECT * FROM handbook WHERE skill_id=?").bind(sid).first();
    return json({ ok: true, skill, my_state: myState || null, cases: cases.results, handbook: handbook || null });
  }

  /* ---- GET /recs/today ---- */
  if (path === "/recs/today" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const latest = await db.prepare("SELECT MAX(batch) AS b FROM recs").first();
    const rows = await db.prepare(
      `SELECT r.id,r.batch,r.type,r.hot,r.source,r.why,s.id AS skill_id,s.name,s.cn,s.cat,s.desc,
              ss.status AS my_status, ss.rating AS my_rating
       FROM recs r JOIN skills s ON s.id=r.skill_id
       LEFT JOIN user_skill_states ss ON ss.skill_id=s.id AND ss.user_id=?
       WHERE r.batch=? ORDER BY r.id`
    ).bind(u.id, latest.b || "").all();
    return json({
      ok: true,
      batch: latest.b,
      personal: rows.results.filter(r => r.type === "为你推荐").slice(0, 5),
      hot: rows.results.filter(r => r.type === "全网热门").slice(0, 5)
    });
  }

  /* ---- GET /cases ---- */
  if (path === "/cases" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const rows = await db.prepare(
      `SELECT c.*, s.name AS skill_name, s.cn AS skill_cn
       FROM cases c LEFT JOIN skills s ON s.id=c.skill_id ORDER BY c.id DESC`
    ).all();
    return json({ ok: true, cases: rows.results });
  }

  /* ---- POST /feedback ---- */
  if (path === "/feedback" && method === "POST") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const b = await req.json();
    const sid = Number(b.skill_id || 0);
    const act = String(b.act || "");
    if (!FB_TYPES.includes(act)) return json({ ok: false, error: "反馈类型不合法: " + act }, 400);
    const skill = await db.prepare("SELECT id FROM skills WHERE id=?").bind(sid).first();
    if (!skill) return json({ ok: false, error: "技能不存在" }, 404);
    const t = nowText();
    let upd = "";
    // 首次插入即写入目标状态（ON CONFLICT 只在已存在记录时触发；
    // VALUES 若写死 '未安装'，新用户第一次点击会落成未安装、需点两次才生效）
    let insertStatus = "未安装";
    if (act === "感兴趣") { upd = "status='待安装',rating=NULL"; insertStatus = "待安装"; }
    else if (act === "不感兴趣") { upd = "status='不感兴趣',rating=NULL"; insertStatus = "不感兴趣"; }
    else if (act === "有用") upd = "rating='好用'";
    else if (act === "没用") upd = "rating='没用'";
    else if (act === "一般") upd = "rating='一般'";
    else upd = "note=note";
    await db.prepare(
      `INSERT INTO user_skill_states(user_id,skill_id,status,rating,note,updated_at)
       VALUES(?,?,?,NULL,'',?)
       ON CONFLICT(user_id,skill_id) DO UPDATE SET ${upd}, updated_at=excluded.updated_at`
    ).bind(u.id, sid, insertStatus, t).run();
    return json({ ok: true, updated_at: t });
  }

  /* ---- PUT /states/:skillId ---- */
  const mState = path.match(/^\/states\/(\d+)$/);
  if (mState && method === "PUT") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const sid = Number(mState[1]);
    const b = await req.json();
    const status = String(b.status || "").trim();
    const rating = String(b.rating || "").trim();
    const t = nowText();
    if (!status && !rating) return json({ ok: false, error: "需要 status 或 rating" }, 400);
    const sets = ["updated_at=?"];
    const args = [t];
    if (status) { sets.push("status=?"); args.push(status); }
    if (rating) { sets.push("rating=?"); args.push(rating); }
    args.push(u.id, sid);
    await db.prepare(
      `INSERT INTO user_skill_states(user_id,skill_id,status,rating,note,updated_at)
       VALUES(?,?,'未安装',NULL,'',?)
       ON CONFLICT(user_id,skill_id) DO UPDATE SET ${sets.join(",")}`
    ).bind(u.id, sid, t).run();
    return json({ ok: true, updated_at: t });
  }

  /* ---- POST /command ---- */
  if (path === "/command" && method === "POST") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const b = await req.json();
    const sid = Number(b.skill_id || 0);
    const act = String(b.act || "");
    if (!ACTS.includes(act)) return json({ ok: false, error: "动作不合法: " + act }, 400);
    const skill = await db.prepare("SELECT id FROM skills WHERE id=?").bind(sid).first();
    if (!skill) return json({ ok: false, error: "技能不存在" }, 404);
    const t = nowText();
    const pend = await db.prepare(
      "SELECT id FROM commands WHERE user_id=? AND skill_id=? AND act=? AND status='待处理' LIMIT 1"
    ).bind(u.id, sid, act).first();
    if (pend) {
      await db.prepare("UPDATE commands SET created_at=? WHERE id=?").bind(t, pend.id).run();
      return json({ ok: true, command_id: pend.id, reused: true });
    }
    const r = await db.prepare(
      "INSERT INTO commands(user_id,skill_id,act,status,executor,created_at) VALUES(?,?,?,'待处理','web',?) RETURNING id"
    ).bind(u.id, sid, act, t).first();
    return json({ ok: true, command_id: r.id });
  }

  /* ---- POST /command/:id/report ---- */
  const mReport = path.match(/^\/command\/(\d+)\/report$/);
  if (mReport && method === "POST") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const cid = Number(mReport[1]);
    const b = await req.json();
    const status = String(b.status || "");
    const result = String(b.result || "");
    if (!["已完成", "失败"].includes(status)) return json({ ok: false, error: "status 必须是 已完成/失败" }, 400);
    const cmd = await db.prepare("SELECT * FROM commands WHERE id=? AND user_id=?").bind(cid, u.id).first();
    if (!cmd) return json({ ok: false, error: "指令不存在" }, 404);
    await db.prepare("UPDATE commands SET status=?, result=?, handled_at=? WHERE id=?")
      .bind(status, result, nowText(), cid).run();
    if (status === "已完成" && cmd.act === "安装") {
      await db.prepare(
        `INSERT INTO user_skill_states(user_id,skill_id,status,rating,note,updated_at)
         VALUES(?,?,'已安装',NULL,'由 CLI 安装回写',?)
         ON CONFLICT(user_id,skill_id) DO UPDATE SET status='已安装', updated_at=excluded.updated_at`
      ).bind(u.id, cmd.skill_id, nowText()).run();
    } else if (status === "已完成" && cmd.act === "卸载") {
      await db.prepare(
        `INSERT INTO user_skill_states(user_id,skill_id,status,rating,note,updated_at)
         VALUES(?,?,'未安装',NULL,'由 CLI 卸载回写',?)
         ON CONFLICT(user_id,skill_id) DO UPDATE SET status='未安装', updated_at=excluded.updated_at`
      ).bind(u.id, cmd.skill_id, nowText()).run();
    }
    return json({ ok: true });
  }

  /* ---- GET /command/pending ---- */
  if (path === "/command/pending" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const rows = await db.prepare(
      `SELECT c.id,c.skill_id,c.act,c.status,c.executor,c.created_at,s.name AS skill_name,s.reg
       FROM commands c JOIN skills s ON s.id=c.skill_id
       WHERE c.user_id=? AND c.status='待处理' ORDER BY c.id`
    ).bind(u.id).all();
    return json({ ok: true, pending: rows.results });
  }

  /* ---- GET /admin/stats ---- */
  if (path === "/admin/stats" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    if (u.role !== "admin") return json({ ok: false, error: "仅管理员" }, 403);
    const users = await db.prepare("SELECT COUNT(*) AS n FROM users").first();
    const skills = await db.prepare("SELECT COUNT(*) AS n FROM skills").first();
    const recs = await db.prepare("SELECT COUNT(*) AS n FROM recs").first();
    const commands = await db.prepare("SELECT COUNT(*) AS n FROM commands").first();
    const invite = await db.prepare("SELECT COUNT(*) AS n FROM invite_codes WHERE used_by IS NULL").first();
    return json({ ok: true, stats: {
      users: users.n, skills: skills.n, recs: recs.n, commands: commands.n, unused_invites: invite.n
    }});
  }

  /* ============================================================
   * 我的书房（书籍 + 划线）API
   * ============================================================ */

  /* ---- GET /books 书架列表 ---- */
  if (path === "/books" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const rows = await db.prepare(
      `SELECT b.*, (SELECT COUNT(*) FROM highlights h WHERE h.book_id=b.id) AS hl_count
       FROM books b ORDER BY b.id DESC`
    ).all();
    return json({ ok: true, books: rows.results });
  }

  /* ---- POST /books 新增书籍 ---- */
  if (path === "/books" && method === "POST") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const b = await req.json();
    const title = String(b.title || "").trim();
    if (!title) return json({ ok: false, error: "书名不能为空" }, 400);
    const r = await db.prepare(
      "INSERT INTO books(title,author,category,source,status,file_path,note) VALUES(?,?,?,?,?,?,?) RETURNING id"
    ).bind(
      title,
      String(b.author || "").trim(),
      String(b.category || "书籍").trim(),
      String(b.source || "").trim(),
      String(b.status || "未读").trim(),
      String(b.file_path || "").trim(),
      String(b.note || "").trim()
    ).first();
    return json({ ok: true, id: r.id });
  }

  /* ---- PUT /books/:id 更新书籍（状态/进度/备注） ---- */
  const mBookPut = path.match(/^\/books\/(\d+)$/);
  if (mBookPut && method === "PUT") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const id = Number(mBookPut[1]);
    const b = await req.json();
    const sets = ["updated_at=datetime('now','localtime')"];
    const args = [];
    if (b.title !== undefined) { sets.push("title=?"); args.push(String(b.title).trim()); }
    if (b.author !== undefined) { sets.push("author=?"); args.push(String(b.author).trim()); }
    if (b.category !== undefined) { sets.push("category=?"); args.push(String(b.category).trim()); }
    if (b.status !== undefined) { sets.push("status=?"); args.push(String(b.status).trim()); }
    if (b.file_path !== undefined) { sets.push("file_path=?"); args.push(String(b.file_path).trim()); }
    if (b.note !== undefined) { sets.push("note=?"); args.push(String(b.note).trim()); }
    args.push(id);
    await db.prepare(`UPDATE books SET ${sets.join(",")} WHERE id=?`).bind(...args).run();
    return json({ ok: true });
  }

  /* ---- DELETE /books/:id ---- */
  const mBookDel = path.match(/^\/books\/(\d+)$/);
  if (mBookDel && method === "DELETE") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const id = Number(mBookDel[1]);
    await db.prepare("DELETE FROM highlights WHERE book_id=?").bind(id).run();
    await db.prepare("DELETE FROM books WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  /* ---- GET /books/:id/highlights 某书的划线 ---- */
  const mHlList = path.match(/^\/books\/(\d+)\/highlights$/);
  if (mHlList && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const bookId = Number(mHlList[1]);
    const rows = await db.prepare(
      "SELECT * FROM highlights WHERE book_id=? ORDER BY id DESC"
    ).bind(bookId).all();
    return json({ ok: true, highlights: rows.results });
  }

  /* ---- GET /highlights 全部划线（按书聚合） ---- */
  if (path === "/highlights" && method === "GET") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const rows = await db.prepare(
      `SELECT h.*, b.title AS book_title FROM highlights h
       JOIN books b ON b.id=h.book_id ORDER BY h.id DESC LIMIT 500`
    ).all();
    return json({ ok: true, highlights: rows.results });
  }

  /* ---- POST /highlights 新增划线 ---- */
  if (path === "/highlights" && method === "POST") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const b = await req.json();
    const bookId = Number(b.book_id || 0);
    const quote = String(b.quote || "").trim();
    if (!bookId || !quote) return json({ ok: false, error: "book_id 与划线内容不能为空" }, 400);
    const book = await db.prepare("SELECT id FROM books WHERE id=?").bind(bookId).first();
    if (!book) return json({ ok: false, error: "书籍不存在" }, 404);
    const r = await db.prepare(
      "INSERT INTO highlights(book_id,quote,note,loc,tag) VALUES(?,?,?,?,?) RETURNING id"
    ).bind(
      bookId, quote,
      String(b.note || "").trim(),
      String(b.loc || "").trim(),
      JSON.stringify(b.tag || [])
    ).first();
    return json({ ok: true, id: r.id });
  }

  /* ---- PUT /highlights/:id 更新划线（补笔记/标签） ---- */
  const mHlPut = path.match(/^\/highlights\/(\d+)$/);
  if (mHlPut && method === "PUT") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const id = Number(mHlPut[1]);
    const b = await req.json();
    const sets = ["updated_at=datetime('now','localtime')"];
    const args = [];
    if (b.note !== undefined) { sets.push("note=?"); args.push(String(b.note).trim()); }
    if (b.loc !== undefined) { sets.push("loc=?"); args.push(String(b.loc).trim()); }
    if (b.tag !== undefined) { sets.push("tag=?"); args.push(JSON.stringify(b.tag)); }
    args.push(id);
    await db.prepare(`UPDATE highlights SET ${sets.join(",")} WHERE id=?`).bind(...args).run();
    return json({ ok: true });
  }

  /* ---- DELETE /highlights/:id ---- */
  const mHlDel = path.match(/^\/highlights\/(\d+)$/);
  if (mHlDel && method === "DELETE") {
    const u = await requireAuth(req, env);
    if (!u) return json({ ok: false, error: "未登录" }, 401);
    const id = Number(mHlDel[1]);
    await db.prepare("DELETE FROM highlights WHERE id=?").bind(id).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: "未知端点: " + path }, 404);
}

/* ---------- KV 限流 ---------- */
async function rateLimit(env, ip, isWrite) {
  try {
    const limit = isWrite ? 30 : 120; // 写口 30/min，读口 120/min（几十人规模防滥用且不误伤正常点击）
    const bucket = Math.floor(Date.now() / 60000);
    const key = "rl:" + (ip || "unknown") + ":" + bucket;
    const cur = parseInt((await env.AUTH.get(key)) || "0", 10);
    if (cur >= limit) return false;
    await env.AUTH.put(key, String(cur + 1), { expirationTtl: 120 });
    return true;
  } catch (e) {
    return true; // 限流存储异常时不阻塞业务
  }
}

/* ============================================================
 * 入口
 * ============================================================ */
export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400"
      }});
    }
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api")) {
      const isWrite = req.method === "POST" || req.method === "PUT";
      const ip = req.headers.get("CF-Connecting-IP") || "unknown";
      if (!(await rateLimit(env, ip, isWrite))) {
        return cors(json({ ok: false, error: "请求过于频繁，请稍后再试" }, 429));
      }
      try {
        return cors(await handleApi(req, env, url));
      } catch (e) {
        return cors(json({ ok: false, error: String(e.message || e) }, 500));
      }
    }

    return cors(json({ ok: false, error: "未知端点" }, 404));
  }
};
