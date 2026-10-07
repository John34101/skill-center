# Skill 中心 · 后端代理部署指南（真·点击即写）

把网页按钮从「页内表单」升级为「点击直接写库」，需要一个后端代理转发飞书 API（凭证不能放前端）。
本方案用 **Cloudflare Workers 免费档**（每天 10 万次请求，个人使用绰绰有余，无需绑卡）。

---

## 一、准备：创建飞书自建应用（5 分钟）

1. 打开 https://open.feishu.cn/app 并用你的飞书账号登录。
2. 点「创建企业自建应用」（个人版也可创建），名称随意，如「Skill中心代理」。
3. 进入应用 →「权限管理」，添加权限：`bitable:app`（多维表格读写）。搜索「bitable」勾选对应权限。
4. 左侧「凭证与基础信息」，记下 **App ID** 和 **App Secret**（Secret 只显示一次，妥善保存）。
5. 点「创建版本」并发布（发布后应用才真正生效；权限若需审核，一般即时通过）。

> 该应用只会写这两个表：技能反馈表、安装指令表。不建议给多余权限。

---

## 二、部署 Worker（10 分钟）

1. 打开 https://dash.cloudflare.com 注册/登录 Cloudflare（免费）。
2. 左侧「Workers 和 Pages」→「创建」→「创建 Worker」→ 名称填 `skill-center-api`（任意）。
3. 点「编辑代码」，**全选删除**默认代码，粘贴 `worker.js` 的全部内容 → 右上角「部署」。
4. 部署完成后进入该 Worker →「设置」→「变量」→「添加」两个变量：
   - `APP_ID` = 你的飞书 App ID
   - `APP_SECRET` = 你的飞书 App Secret
5. 「保存并部署」。稍等几秒，右上角会有你的域名，形如 `https://skill-center-api.xxxx.workers.dev`。

**测试**：浏览器打开 `https://skill-center-api.xxxx.workers.dev/feedback`，应返回 `{"ok":false,"error":"技能名称为空"}`（说明 Worker 活着）。

---

## 三、OAuth 用户授权配置（个人版必需，3 分钟）

> 飞书个人版的 `bitable:app` 应用身份权限无法配置数据范围（企业版才有），tenant token 写库会被拒（Forbidden）。
> 因此 v2 改用「用户本人授权」：首次点按钮跳飞书授权一次，之后 30 天自动刷新。

1. **Cloudflare 建 KV 存储**：Worker `skill-center-api` →「设置」→「绑定」→「KV」→「创建命名空间」，名称填 `skill-auth` → 创建后绑定变量名填 `AUTH` →「保存并部署」。
2. **飞书应用配重定向 URL**：open.feishu.cn 应用 →「开发配置 / 安全设置」→「重定向 URL」→ 添加：
   `https://skill-center-api.xxx.workers.dev/callback`
   （把 xxx 换成你的实际子域，务必和你的 Worker 域名一致）
3. **替换 Worker 代码**：点「编辑代码」，全选删除，粘贴新版 `worker.js`（v2 版）→「部署」。
4. **测试**：网页点「好用」→ 自动跳飞书授权页 → 点「授权/同意」→ 自动回网页 → **再点一次按钮**即成功。之后 30 天全自动。

## 四、接通网页（1 分钟）

1. 打开 `/home/user/Doubao/chats/38444168961292802/skill-center/Skill管理中心.html`。
2. 找到这行常量：

```js
const WORKER_URL=""; // 部署后端后填入 https://skill-center-api.xxxx.workers.dev
```

3. 填入你的 Worker 域名，例如：

```js
const WORKER_URL="https://skill-center-api.xxxx.workers.dev";
```

4. 保存后重新发布（见下）。

**发布命令**：

```bash
cd /home/user/Doubao/chats/38444168961292802/skill-center && \
python3 sync_from_base.py && \
cp Skill管理中心.html /tmp/index.html && \
lark-cli apps +html-publish --path /tmp/index.html --app-id app_17f88vb743c --as user
```

（若返回 release_id，用 `lark-cli apps +release-get --app-id app_17f88vb743c --release-id <id> --as user` 轮询到 `finished`。）

---

## 四、生效后的变化

- 点「好用 / 没用 / 先试用 / 不感兴趣」→ **直接写反馈表**，按钮当场变「已提交，等待同步」，无跳转、无 iframe。
- 点「安装 / 卸载 / 恢复」→ **直接写安装指令表**，同样当场确认；cron 每小时照常执行安装/卸载。
- 不填 `WORKER_URL` 时（默认空字符串），按钮自动回退到**页内 iframe 面板**（上一版方案），两种模式互不冲突。

---

## 五、常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 按钮点了没反应、报「origin 不在白名单」 | 网页域名与 `ALLOWED_ORIGIN` 不一致（如换了发布域名），改 worker.js 顶部常量后重新部署 |
| 报「获取 token 失败」 | `APP_ID`/`APP_SECRET` 填错，或应用未发布版本 |
| 报「写入失败」 | 应用权限缺 `bitable:app`，或表/字段被改名 |
| 想加新反馈类型 | 同步改 worker.js 的 `FB_TYPES` 与网页按钮 |
