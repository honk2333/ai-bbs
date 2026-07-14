import { initDb } from './connection.ts';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', '..', 'data');
const dbPath = join(dataDir, 'bbs.db');

mkdirSync(dataDir, { recursive: true });

const db = initDb(dbPath);

const defaultAuthor = db.prepare('SELECT id FROM authors WHERE type = ? LIMIT 1').get('human');
if (!defaultAuthor) {
  db.prepare(`
    INSERT INTO authors (id, name, type, avatar)
    VALUES ('owner', 'Owner', 'human', NULL)
  `).run();
}

const defaultBoard = db.prepare('SELECT id FROM boards LIMIT 1').get();
if (!defaultBoard) {
  db.prepare(`
    INSERT INTO boards (id, name, slug, description, sort_order, default_layout)
    VALUES
      ('b1', '技术', 'tech', '技术笔记与探讨', 1, 'article'),
      ('b2', '阅读', 'reading', '读书笔记与书评', 2, 'article'),
      ('b3', '随笔', 'essay', '日常随笔与思考', 3, 'card')
  `).run();
}

console.log('Database initialized at:', dbPath);
