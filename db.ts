import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

let dbInstance: Database.Database | null = null;

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function runMigrations(db: Database.Database): void {
  // Minimal migration runner: apply 001_init.sql if members table missing
  const tableCheck = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='members'")
    .get() as { name?: string } | undefined;

  if (!tableCheck || !tableCheck.name) {
    const migrationPath = path.join(__dirname, 'migrations', '001_init.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    db.exec(sql);
  }

  // Ensure daily_metrics has sleep_perf_pct column
  const cols = db.prepare(`PRAGMA table_info(daily_metrics)`).all() as Array<{ name: string }>;
  const hasSleepPerf = cols.some(c => c.name === 'sleep_perf_pct');
  if (!hasSleepPerf) {
    db.exec(`ALTER TABLE daily_metrics ADD COLUMN sleep_perf_pct REAL;`);
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'storage', 'app.sqlite');
  ensureDirectoryExists(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  dbInstance = db;
  return dbInstance;
}

export type Sqlite = Database.Database;


