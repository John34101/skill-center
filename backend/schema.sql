-- Skill 管理中心 · D1 主库 Schema
-- 2026-10-13 P0 产品化

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nickname      TEXT,
  tags          TEXT DEFAULT '[]',
  role          TEXT DEFAULT 'user',
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code       TEXT PRIMARY KEY,
  used_by    INTEGER REFERENCES users(id),
  used_at    TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS skills (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  cn         TEXT,
  cat        TEXT,
  tags       TEXT DEFAULT '[]',
  biz        TEXT DEFAULT '[]',
  status     TEXT DEFAULT '未安装',
  backup     TEXT DEFAULT '未备份',
  hot        TEXT,
  source     TEXT,
  reg        TEXT,
  score      INTEGER,
  desc       TEXT,
  note       TEXT,
  last_used  TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS user_skill_states (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  skill_id   INTEGER NOT NULL REFERENCES skills(id),
  status     TEXT NOT NULL DEFAULT '未安装',
  rating     TEXT,
  note       TEXT,
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS recs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch      TEXT NOT NULL,
  date       TEXT NOT NULL,
  type       TEXT NOT NULL,
  skill_id   INTEGER NOT NULL REFERENCES skills(id),
  hot        TEXT,
  source     TEXT,
  why        TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS cases (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT,
  skill_id INTEGER REFERENCES skills(id),
  scene    TEXT,
  date     TEXT,
  effect   TEXT,
  link     TEXT,
  kind     TEXT,
  steps    TEXT,
  note     TEXT,
  cover    TEXT,
  bg       TEXT,
  time     TEXT,
  repro    TEXT
);

CREATE TABLE IF NOT EXISTS handbook (
  skill_id INTEGER PRIMARY KEY REFERENCES skills(id),
  goal     TEXT,
  prompt   TEXT,
  steps    TEXT,
  examples TEXT
);

CREATE TABLE IF NOT EXISTS polish (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT,
  scene   TEXT,
  status  TEXT,
  rounds  INTEGER,
  score   INTEGER,
  issues  TEXT,
  fixes   TEXT,
  tpl     TEXT,
  note    TEXT,
  date    TEXT
);

CREATE TABLE IF NOT EXISTS commands (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  skill_id   INTEGER NOT NULL REFERENCES skills(id),
  act        TEXT NOT NULL,
  status     TEXT DEFAULT '待处理',
  executor   TEXT DEFAULT 'web',
  result     TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  handled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_states_user  ON user_skill_states(user_id, status);
CREATE INDEX IF NOT EXISTS idx_recs_batch   ON recs(batch);
CREATE INDEX IF NOT EXISTS idx_commands_uid ON commands(user_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_skill  ON cases(skill_id);
