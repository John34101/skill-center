-- 我的书房：书籍台账 + 划线笔记（D1 主库）
CREATE TABLE IF NOT EXISTS books (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  author      TEXT DEFAULT '',
  category    TEXT DEFAULT '书籍',        -- 课程/书籍/PDF/EPUB
  source      TEXT DEFAULT '',
  status      TEXT DEFAULT '未读',        -- 未读/在读/读完/搁置
  file_path   TEXT DEFAULT '',            -- EPUB/PDF 文件路径或 URL
  note        TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS highlights (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id     INTEGER NOT NULL REFERENCES books(id),
  quote       TEXT NOT NULL,              -- 划线原文
  note        TEXT DEFAULT '',            -- 我的笔记
  loc         TEXT DEFAULT '',            -- 位置（EPUB cfi / PDF 页码）
  tag         TEXT DEFAULT '[]',          -- JSON 数组
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_hl_book ON highlights(book_id);
