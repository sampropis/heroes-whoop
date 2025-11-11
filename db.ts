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
    // Resolve migrations from project root even when running compiled code from dist/
    const rootLike =
      path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;
    const candidates = [
      path.join(rootLike, 'migrations', '001_init.sql'),
      path.join(__dirname, 'migrations', '001_init.sql'),
      path.join(process.cwd(), 'migrations', '001_init.sql'),
    ];
    const found = candidates.find(p => fs.existsSync(p));
    if (!found) {
      throw new Error(`Migration file not found. Looked in: ${candidates.join(', ')}`);
    }
    const sql = fs.readFileSync(found, 'utf-8');
    db.exec(sql);
  }

  // Ensure daily_metrics has sleep_perf_pct column
  const cols = db.prepare(`PRAGMA table_info(daily_metrics)`).all() as Array<{ name: string }>;
  const hasSleepPerf = cols.some(c => c.name === 'sleep_perf_pct');
  if (!hasSleepPerf) {
    db.exec(`ALTER TABLE daily_metrics ADD COLUMN sleep_perf_pct REAL;`);
  }
  const hasSleepConsistency = cols.some(c => c.name === 'sleep_consistency_pct');
  if (!hasSleepConsistency) {
    db.exec(`ALTER TABLE daily_metrics ADD COLUMN sleep_consistency_pct REAL;`);
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


