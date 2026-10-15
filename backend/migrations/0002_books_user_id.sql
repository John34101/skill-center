-- 书房按用户隔离：books / highlights 增加 user_id，存量归到首位 admin（若无则首位用户）
ALTER TABLE books ADD COLUMN user_id INTEGER REFERENCES users(id);
ALTER TABLE highlights ADD COLUMN user_id INTEGER REFERENCES users(id);

-- 回填：优先 admin，否则最早注册用户
UPDATE books
SET user_id = COALESCE(
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
  (SELECT id FROM users ORDER BY id LIMIT 1)
)
WHERE user_id IS NULL;

UPDATE highlights
SET user_id = COALESCE(
  (SELECT b.user_id FROM books b WHERE b.id = highlights.book_id),
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1),
  (SELECT id FROM users ORDER BY id LIMIT 1)
)
WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_hl_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_hl_user_book ON highlights(user_id, book_id);
