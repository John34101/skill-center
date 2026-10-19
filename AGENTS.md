# 我的书房 — Agent 交接文档（AGENTS.md）

> 任何接手本仓库的 agent，**第一步读本文件**，再读 `CHANGELOG.md` 了解最近改了什么。
> 本文件描述的是**当前**系统。仓库名仍叫 `skill-center`，但产品已在 2026-10-15 改为「我的书房」。
> 更新：2026-10-19（Claude Code 按改版后的实际代码重写）。

## 1. 产品是什么

「我的书房」：个人阅读与划线沉淀工具，线上地址 **https://ilovelearning.top**。

- 主要给老板自己用，邀请码注册，书架和划线**按用户隔离**。
- 能做的事：书架（增删改、搜索、分类、状态）、课程阅读（按章节读 Markdown 文字稿）、EPUB 阅读、划线与批注、导出 Markdown、夜间模式、续读。
- 旧的「Skill 管理中心」功能归档在顶栏「学习中心」入口（`#/legacy`），**不再维护**，见 §7。

## 2. 架构

```
浏览器 ── ilovelearning.top / www ──▶ Worker skill-center-web（纯静态资源，web/dist）
   │
   └─ fetch https://api.ilovelearning.top/api/* ──▶ Worker skill-center-api（backend/worker.js）
                                                      ├─ D1  skill-center-db（主库）
                                                      └─ KV  AUTH（仅写接口限流）
```

- 飞书 Base **不再是数据源**，书房不读也不写飞书。
- 认证：邮箱 + 密码 + 邀请码注册，JWT（HS256，`JWT_SECRET`）存浏览器 localStorage。

## 3. 目录（只列当前在用的）

```
web/                         前端（Vite + React 19，hash 路由，无 UI 库）
  src/App.jsx                路由：#/ 书架，#/reader/<id> 阅读器，#/admin，#/legacy/* 旧版归档
  src/api.js                 API 基址 https://api.ilovelearning.top
  src/pages/Library.jsx      书架
  src/pages/Reader.jsx       阅读器入口；组件在 src/components/reader/
  src/lib/                   划线、阅读进度
  src/styles.css             纸感浅色设计系统 + 夜间模式
  public/courses/<id>/       课程：meta.json + chapters/*.md
  public/books/              EPUB 文件
  wrangler.toml              前端 Worker 配置（name=skill-center-web）
backend/
  worker.js                  API Worker（全部路由在 handleApi）
  migrations/                D1 迁移（部署时自动 apply）
  schema.sql / seed.sql      旧版全量结构与种子数据（迁移自飞书，Skill 时代）
wrangler.toml                API Worker 配置（name=skill-center-api，D1/KV 绑定）
.github/workflows/
  deploy-web.yml             前端自动部署
  deploy-worker.yml          后端自动部署 + D1 迁移
  release.yml                推 v* tag 时建 GitHub Release
VERSION / CHANGELOG.md       版本号与变更记录（见 §8）
```

## 4. 数据（D1）

书房只用三张表：

| 表 | 关键字段 |
|---|---|
| `users` | email, password_hash, nickname, role（user / admin） |
| `books` | user_id, title, author, category（课程/书籍/PDF/EPUB）, status（未读/在读/读完/搁置）, file_path |
| `highlights` | user_id, book_id, quote, note, loc（EPUB cfi 或章节位置）, tag（JSON 数组） |

`invite_codes` 管注册。其余表（skills / recs / cases / handbook / polish / commands / user_skill_states）是 Skill 时代遗留，书房不用，**暂未删除**。

新增表或字段：在 `backend/migrations/` 加 `000N_xxx.sql`，合并到 main 后由 deploy-worker 自动 apply。**先部署迁移，再部署依赖它的前端。**

## 5. API（前缀 /api，除注册登录外都要 `Authorization: Bearer <JWT>`）

| 用途 | 端点 |
|---|---|
| 账号 | `POST /auth/register`，`POST /auth/login`，`GET /auth/me`，`POST /auth/invite`（admin） |
| 书架 | `GET/POST /books`，`PUT/DELETE /books/:id` |
| 划线 | `GET /books/:id/highlights`，`GET/POST /highlights`，`PUT/DELETE /highlights/:id` |
| 管理 | `GET /admin/stats`（admin） |

读接口不限流；写接口按 IP 用 KV 限流。`/skills`、`/recs/today`、`/feedback`、`/command` 等是旧版接口，只服务 `#/legacy` 页面。

## 6. 开发与部署

**本地开发**

```bash
cd web && npm ci && npm run dev      # 本地页面直连线上 API（api.ilovelearning.top）
npm run build                        # 产物 web/dist（已 gitignore）
```

**部署：合并到 main 即上线，不需要本机凭证**

| 改了什么 | 触发的 workflow | 做什么 |
|---|---|---|
| `web/**` | `deploy-web.yml` | npm ci → build → wrangler deploy 到 skill-center-web → 访问首页做冒烟检查 |
| `backend/**`、根 `wrangler.toml` | `deploy-worker.yml` | wrangler deploy → D1 migrations apply → 注入 secrets |

两个 workflow 都可在 GitHub Actions 页手动触发。凭证在仓库 secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`JWT_SECRET`（`APP_ID` / `APP_SECRET` 是旧版飞书凭证，已无代码使用）。

**协作流程**：开分支 → PR → 合并到 main。不要直接在 main 上提交大改动。

**上架一门课程**

1. 新建 `web/public/courses/<id>/meta.json`（`id`、`title`、`author`、`source`、`tags`、`chapters[{id,title,file}]`），正文放 `chapters/*.md`，可参考 `modern-thinking-tools/`。
2. 合并到 main，deploy-web 自动上线。
3. 在书架「添加」，分类选「课程」，路径填 `/courses/<id>/meta.json`。

## 7. 已知问题与决定

- **课程文字稿是公开静态文件**：`/courses/**` 不经登录即可下载。老板 2026-10-19 决定：目前自用、不对外，**暂不加登录保护**。若开放给他人使用，要先把正文移到需要登录的 API 后面。
- 前端打包是单个 ~700 KB 的 JS（主要是 epubjs），构建有体积警告，暂不影响使用。
- 本机 git 访问 github.com 不稳定：用 `git -c http.version=HTTP/1.1 pull` 并给足超时；`api.github.com`（gh CLI）通常可用。
- `recommend.py` 里还有「提交 `cloud/DEPLOY_WEB_NOW` 搭车部署前端」的旧逻辑，已被 `deploy-web.yml` 取代，不要再用。

## 8. 版本与变更记录

- `VERSION` 是版本号唯一真源，对应 tag `v<VERSION>`，0.x 阶段不保证兼容，升 1.0 由老板拍板。
- **完成任何改动都要在 `CHANGELOG.md` 的 `[Unreleased]` 写一条**：做了什么、动了哪些文件、后续待办。不改他人已写的历史条目。

## 9. 角色

- **Claude Code**：2026-10-19 起承接本项目的开发与维护（老板决定）。
- 其他 agent 可参与，但都遵守 §6 的 PR 流程和 §8 的记录规则。

## 10. 旧版「Skill 管理中心」（归档，不再维护）

2026-10-07 至 10-14 的 Skill 推荐系统：飞书 Base 为数据源，每日 9 点双档推荐，HTML 发布到 doubaoapps。**已停用**：

- GitHub Actions `daily-skill-recommend-fetch`：2026-10-19 禁用并删除。
- WorkBuddy 本机自动化 `563ac448-23a1-46e1-9548-27a0017c7a95`（每日 9 点 `recommend.py all`）：需在 WorkBuddy 里手动停用。

遗留文件留在仓库根目录和 `cloud/`、`cases-1010/`、`demo/`、`data/` 下，书房不依赖它们：`Skill管理中心.html`、`recommend.py`、`sync_from_base.py`、`migrate_base_to_d1.py`、`data.json`、`ledger.json`、`recs.json`、`profile.json`、`verify_publish.mjs`、`check_snapshots.js`、`redesign-mock.html`、`交接说明-Claude-Code.md`、`运行分工补丁-20261007.md`、`产品规划-20261007.md`、`任务单*.md`、`验收清单-v*.md`、`A1-推荐闭环设计.md`、`docs/P0-产品化设计.md`。

旧版完整口径（飞书表结构、字段 ID、写入规则、lark-cli 命令）见：`git show 69afd5a:AGENTS.md`。
