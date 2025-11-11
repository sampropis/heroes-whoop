-- Initialize SQLite schema for Whoop Gym Leaderboard
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  whoop_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  refresh_token_enc TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_refreshed_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  sleep_total_sec INTEGER,
  recovery_score REAL,
  strain_score REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(member_id, date),
  FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);


