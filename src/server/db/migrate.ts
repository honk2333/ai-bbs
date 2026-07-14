import Database from 'better-sqlite3';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '..', '..', '..', 'data', 'bbs.db');
const db = new Database(dbPath);

function addColumnIfMissing(table: string, column: string, defn: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${defn}`);
    console.log(`Added column: ${table}.${column}`);
  } else {
    console.log(`Column already exists: ${table}.${column}`);
  }
}

addColumnIfMissing('posts', 'discussion_state', "TEXT NOT NULL DEFAULT 'open' CHECK(discussion_state IN ('open','closed'))");
addColumnIfMissing('posts', 'priority', "TEXT NOT NULL DEFAULT 'none' CHECK(priority IN ('none','P0','P1','P2'))");
addColumnIfMissing('comments', 'state', "TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','resolved'))");

console.log('Migration done.');
