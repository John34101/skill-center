-- Skill 管理中心 · D1 初始 Schema（P0）
-- 2026-10-13 v1（与 docs/P0-产品化设计.md §3 对齐）
-- 注意：所有 CREATE 均带 IF NOT EXISTS，幂等；已存在的表（由 migrate_base_to_d1.py 或早期建表）不会被改动

-- 用户表（邮箱+密码+邀请码注册）
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname      TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '[]',      -- JSON 数组，用户画像标签
  role          TEXT NOT NULL DEFAULT 'user',     -- user / admin
  created_at    TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 邀请码
CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,
  used_by    INTEGER,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 技能台账（从飞书 Base 同步；全站默认态 status/backup 为迁移快照，用户态见 user_skill_states）
CREATE TABLE IF NOT EXISTS skills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,               -- 英文注册名/标识
  cn          TEXT NOT NULL DEFAULT '',           -- 中文名
  cat         TEXT NOT NULL DEFAULT '其他',        -- 类别
  tags        TEXT NOT NULL DEFAULT '[]',          -- JSON 数组（功能标签）
  biz         TEXT NOT NULL DEFAULT '[]',          -- JSON 数组（对应业务）
  status      TEXT NOT NULL DEFAULT '未安装',      -- 全站默认态快照
  backup      TEXT NOT NULL DEFAULT '未备份',
  hot         TEXT NOT NULL DEFAULT '',            -- 热度指标（字符串）
  source      TEXT NOT NULL DEFAULT '',            -- 来源链接
  reg         TEXT NOT NULL DEFAULT '',            -- 可安装注册名（skills.sh owner/repo）
  score       INTEGER,                             -- 效果评分 1-5
  desc        TEXT NOT NULL DEFAULT '',            -- 一句话说明
  note        TEXT NOT NULL DEFAULT '',            -- 备注
  last_used   TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
);

-- 每日推荐记录（从飞书 Base 同步）
CREATE TABLE IF NOT EXISTS recs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  batch       TEXT NOT NULL,                       -- YYYY-MM-DD 推荐
  date        TEXT NOT NULL DEFAULT '',            -- YYYY-MM-DD
  type        TEXT NOT NULL DEFAULT '为你推荐',     -- 为你推荐 / 全网热门
  skill_id    INTEGER NOT NULL REFERENCES skills(id),
  hot         TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',
  why         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_recs_batch ON recs(batch);

-- 用法案例（从飞书 Base 同步）
CREATE TABLE IF NOT EXISTS cases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL DEFAULT '',
  skill_id    INTEGER NOT NULL REFERENCES skills(id),
  scene       TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL DEFAULT '',
  effect      TEXT NOT NULL DEFAULT '',
  link        TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL DEFAULT '',
  steps       TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  cover       TEXT NOT NULL DEFAULT '',
  bg          TEXT NOT NULL DEFAULT '',
  time        TEXT NOT NULL DEFAULT '',
  repro       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_cases_skill ON cases(skill_id);

-- 技能手册（从飞书 Base 同步）
CREATE TABLE IF NOT EXISTS handbook (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id    INTEGER NOT NULL REFERENCES skills(id),
  goal        TEXT NOT NULL DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  steps       TEXT NOT NULL DEFAULT '',
  examples    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_handbook_skill ON handbook(skill_id);

-- 打磨记录（从飞书 Base 同步）
CREATE TABLE IF NOT EXISTS polish (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL DEFAULT '',
  scene       TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT '',
  rounds      INTEGER,
  score       INTEGER,
  issues      TEXT NOT NULL DEFAULT '',
  fixes       TEXT NOT NULL DEFAULT '',
  tpl         TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  date        TEXT NOT NULL DEFAULT ''
);

-- 用户×技能 状态（兴趣/安装/评价，每人独立，产品核心表）
CREATE TABLE IF NOT EXISTS user_skill_states (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  skill_id   INTEGER NOT NULL REFERENCES skills(id),
  status     TEXT NOT NULL DEFAULT '未安装',        -- 未安装/待安装/已安装/待卸载/不感兴趣
  rating     TEXT,                                 -- 好用/一般/没用
  note       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
  PRIMARY KEY (user_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_states_user ON user_skill_states(user_id, status);

-- 安装/卸载指令（网页按钮与 CLI 共用执行队列）
CREATE TABLE IF NOT EXISTS commands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  skill_id   INTEGER NOT NULL REFERENCES skills(id),
  act        TEXT NOT NULL,                        -- 安装/卸载/恢复
  status     TEXT NOT NULL DEFAULT '待处理',        -- 待处理/处理中/已完成/失败
  executor   TEXT NOT NULL DEFAULT 'web',          -- web / cli / cloud
  result     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
  handled_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_commands_user_status ON commands(user_id, status);
