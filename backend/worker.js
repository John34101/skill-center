/* ============================================================
 * Skill 中心 · 反馈/指令代理 Worker v2（用户授权模式 OAuth）
 * 作用：网页按钮点击 → 用「用户本人」身份直接写入飞书多维表格
 *       （个人版 tenant token 无法配数据范围，改用 user token）
 * 端点：
 *   GET  /auth         → 302 跳飞书授权页（首次点按钮时自动触发）
 *   GET  /callback     → 授权回调，存 token 后 302 回网页
 *   POST /feedback     { skill, act: 有用|没用|请求试用|评分|吐槽 }
 *   POST /action       { skill, act: 安装|卸载|恢复 }
 * 环境变量：APP_ID、APP_SECRET（飞书自建应用）
 * KV 绑定：AUTH（Cloudflare KV 命名空间，存授权 token）
 * ============================================================ */

const BASE_TOKEN = "VRA1bfbiaaiUjRsK0ekcwAdsnHd";        // 多维表格「Skill 技能管理台」
const FB_TABLE   = "tblLQqY1V17uA6Ql";                   // 技能反馈表
const ACT_TABLE  = "tbl0IMDNcHit5Q65";                   // 安装指令表
const FB_TYPES   = ["有用", "没用", "请求试用", "评分", "吐槽", "感兴趣", "不感兴趣"];
const ACTS       = ["安装", "卸载", "恢复"];
const ALLOWED_ORIGIN = "https://s0zel9adg2.doubaoapps.com";

const FEISHU = "https://open.feishu.cn/open-apis";

/* ---------- 授权 token 管理（存 KV） ---------- */
async function getToken(env, kv) {
  let auth = await kv.get("auth", "json");
  if (!auth) return null;
  if (Date.now() < auth.expire) return auth.ut;                       // 未过期直接用
  if (Date.now() < auth.rexpire) {                                    // 过期但 refresh 还有效
    const r = await fetch(`${FEISHU}/authen/v2/oauth/token`, {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ grant_type: "refresh_token", client_id: env.APP_ID, client_secret: env.APP_SECRET, refresh_token: auth.urt })
    });
    const d = await r.json();
    if (d.code === 0) {
      auth = { ut: d.access_token, urt: d.refresh_token,
               expire: Date.now() + d.expires_in * 1000,
               rexpire: Date.now() + d.refresh_token_expires_in * 1000 };
      await kv.put("auth", JSON.stringify(auth));
      return auth.ut;
    }
  }
  return null;
}

/* ---------- 写记录 ---------- */
async function addRecord(env, kv, tableId, fields) {
  const token = await getToken(env, kv);
  if (!token) return { needAuth: true };
  const r = await fetch(`${FEISHU}/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error("写入失败: " + (d.msg || d.code));
  return { record_id: d.data.record.record_id };
}

/* ---------- 幂等：查同技能+同动作+状态未完成(空)的既有指令，命中则复用不新增 ---------- */
async function findPendingAction(env, kv, skill, act) {
  const token = await getToken(env, kv);
  if (!token) return { needAuth: true };
  const r = await fetch(`${FEISHU}/bitable/v1/apps/${BASE_TOKEN}/tables/${ACT_TABLE}/records/search`, {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      filter: {
        conjunction: "and",
        conditions: [
          { field_name: "技能名称", operator: "is", value: [skill] },
          { field_name: "动作", operator: "is", value: [act] },
          { field_name: "状态", operator: "isEmpty" }
        ]
      },
      page_size: 20
    })
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error("查询失败: " + (d.msg || d.code));
  const items = (d.data && d.data.items) || [];
  return items.length ? items[0].record_id : null;
}

/* ---------- 更新既有记录 ---------- */
async function updateRecord(env, kv, tableId, recordId, fields) {
  const token = await getToken(env, kv);
  if (!token) return { needAuth: true };
  const r = await fetch(`${FEISHU}/bitable/v1/apps/${BASE_TOKEN}/tables/${tableId}/records/${recordId}`, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
  const d = await r.json();
  if (d.code !== 0) throw new Error("更新失败: " + (d.msg || d.code));
  return { record_id: d.data.record.record_id };
}

/* ---------- 当前北京时间（飞书 datetime 格式） ---------- */
function nowText() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 19).replace("T", " ");
}

/* ---------- OAuth 流程 ---------- */
async function oauthStart(req, env) {
  const u = new URL(req.url);
  const redirectUri = u.origin + "/callback";
  const scope = encodeURIComponent("bitable:app offline_access"); // offline_access：换 refresh_token 必需
  const url = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=${env.APP_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=skillcenter`;
  return Response.redirect(url, 302);
}

async function oauthCallback(req, env, kv) {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  if (!code) return new Response("授权失败：缺少 code", { status: 400 });
  const redirectUri = u.origin + "/callback";
  const r = await fetch(`${FEISHU}/authen/v2/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ grant_type: "authorization_code", client_id: env.APP_ID, client_secret: env.APP_SECRET, code, redirect_uri: redirectUri })
  });
  const d = await r.json();
  if (d.code !== 0) return new Response("授权失败：" + (d.error_description || d.error || d.code), { status: 400 });
  const auth = { ut: d.access_token, urt: d.refresh_token,
                 expire: Date.now() + d.expires_in * 1000,
                 rexpire: Date.now() + d.refresh_token_expires_in * 1000 };
  await kv.put("auth", JSON.stringify(auth));
  return Response.redirect(ALLOWED_ORIGIN + "/app/app_17f88vb743c", 302); // 回 Skill 中心
}

/* ---------- 工具 ---------- */
function json(res, status) {
  return new Response(JSON.stringify(res), { status, headers: { "Content-Type": "application/json" } });
}
function cors(res) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  h.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers: h });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400"
      }});
    }
    const origin = req.headers.get("Origin") || "";
    if (origin && origin !== ALLOWED_ORIGIN) {
      return cors(json({ ok: false, error: "origin 不在白名单" }, 403));
    }
    const url = new URL(req.url);
    const kv = env.AUTH;
    if (!kv) return cors(json({ ok: false, error: "未绑定 KV 命名空间（变量名 AUTH）" }, 500));

    // 授权入口（GET，浏览器直开）
    if (url.pathname.endsWith("/auth")) return oauthStart(req, env);
    if (url.pathname.endsWith("/callback")) return oauthCallback(req, env, kv);

    if (req.method !== "POST") return cors(json({ ok: false, error: "仅支持 POST" }, 405));
    try {
      const body = await req.json();
      const skill = String(body.skill || "").trim();
      const act = String(body.act || "").trim();
      if (!skill) return cors(json({ ok: false, error: "技能名称为空" }, 400));
      let res;
      if (url.pathname.endsWith("/feedback")) {
        if (!FB_TYPES.includes(act)) return cors(json({ ok: false, error: "反馈类型不合法: " + act }, 400));
        res = await addRecord(env, kv, FB_TABLE, { "技能名称": skill, "反馈类型": act });
      } else if (url.pathname.endsWith("/action")) {
        if (!ACTS.includes(act)) return cors(json({ ok: false, error: "动作不合法: " + act }, 400));
        const t = nowText();
        const existing = await findPendingAction(env, kv, skill, act);
        if (existing) {
          res = await updateRecord(env, kv, ACT_TABLE, existing, { "提交时间": t });
          res.reused = true;
        } else {
          res = await addRecord(env, kv, ACT_TABLE, { "技能名称": skill, "动作": act, "提交时间": t });
        }
      } else {
        return cors(json({ ok: false, error: "未知端点" }, 404));
      }
      if (res.needAuth) return cors(json({ ok: false, needAuth: true, error: "需要授权" }, 401));
      return cors(json({ ok: true, record_id: res.record_id }));
    } catch (e) {
      return cors(json({ ok: false, error: String(e.message || e) }, 500));
    }
  }
};
