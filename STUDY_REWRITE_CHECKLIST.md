# 书房重写清单（Phase 1–3）· 晨间验收

PR：https://github.com/John34101/skill-center/pull/2

## 做了什么

### Phase 1 · P0 + 信息架构
- [x] D1 migration `0002_books_user_id.sql`：`books` / `highlights` 增加 `user_id`，存量归 admin（或最早用户）
- [x] Worker 书房 API **全部按当前登录用户隔离**（读写删）
- [x] 划线 `tag`：API 返回时规范化为数组；前端 `normalizeHighlight(s)` 兜底
- [x] 顶栏默认只服务「我的书房」；「学习中心」为安静小入口 → `#/legacy`

### Phase 2 · UI + Reader
- [x] 纸感浅色「Paper Library」设计系统（`styles.css`）
- [x] 阅读页支持 **夜间模式**（顶栏切换，localStorage 记忆）
- [x] 登录 / 注册文案改为书房
- [x] 书架：搜索、分类、状态筛选、空态、示例课引导
- [x] Reader 拆分：`CourseReader` / `EpubReader` + 共用划线侧栏

### Phase 3 · 导出与部署
- [x] 导出：**下载 .md** + 可选「复制」到剪贴板；课程划线按章节分组
- [x] `deploy-skill-center-web` workflow（若 gh 缺 `workflow` scope 可能需网页确认）
- [x] `npm run build` 已通过

## 如何本地验证

```bash
cd web && npm install && npm run build && npm run preview
# 或 npm run dev
```

1. 登录 https://ilovelearning.top（或本地 preview + 生产 API）
2. 书架添加「课程」，路径 `/courses/sample-efficient-learning/meta.json`
3. 阅读 → 划线 → **下载 Markdown** / 复制
4. 切换「夜间」
5. 换账号确认看不到对方的书（部署 migration 之后）

## 上线注意

1. **先合并含 `backend/migrations/0002_*.sql` 的 PR**，让 `deploy-worker` 跑 D1 migrate  
2. 再部署前端 Worker `skill-center-web`（workflow 或 `cd web && npx wrangler@4 deploy`）
3. 未跑 migration 前，带 `user_id` 的 INSERT 可能失败

## 已知问题 / 后续

- 旧 Skill 页面样式仅「能用」级别，未精修（刻意）
- 课程正文仍是静态 `public/courses/`，改稿需发前端
- 划线侧栏「改笔记」仍即时 PUT（与原先一致，无防抖）
- gh OAuth 若无 `workflow` scope，`.github/workflows/deploy-web.yml` 可能推不上去，需在 GitHub 网页添加或 `gh auth refresh -s workflow`

## 建议 commit / PR 标题

`feat(书房): 用户隔离 + 纸感 UI + Reader 拆分 + Markdown 下载`

---
PR 链接：https://github.com/John34101/skill-center/pull/2
