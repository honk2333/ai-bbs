-- Personal BBS Schema

CREATE TABLE IF NOT EXISTS authors (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'human' CHECK(type IN ('human','agent')),
  avatar      TEXT,
  api_key     TEXT UNIQUE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  default_layout TEXT NOT NULL DEFAULT 'article',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id          TEXT PRIMARY KEY,
  board_id    TEXT NOT NULL REFERENCES boards(id),
  author_id   TEXT NOT NULL REFERENCES authors(id),
  title       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  format      TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown','html')),
  layout      TEXT NOT NULL DEFAULT 'article' CHECK(layout IN ('article','card','doc')),
  status      TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES authors(id),
  content     TEXT NOT NULL,
  format      TEXT NOT NULL DEFAULT 'markdown' CHECK(format IN ('markdown','html')),
  parent_id   TEXT REFERENCES comments(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
