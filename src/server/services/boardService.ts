import { getDb } from '../db/connection.ts';
import type { Board } from '../../shared/types.ts';

export function getBoards(): Board[] {
  const db = getDb();
  return db.prepare('SELECT * FROM boards ORDER BY sort_order ASC').all() as Board[];
}

export function getBoardBySlug(slug: string): Board | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM boards WHERE slug = ?').get(slug) as Board | undefined;
}

export function getBoardById(id: string): Board | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as Board | undefined;
}

export function createBoard(data: {
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  default_layout?: string;
}): Board {
  const db = getDb();
  const id = `b${Date.now()}`;
  db.prepare(`
    INSERT INTO boards (id, name, slug, description, sort_order, default_layout)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.name, data.slug, data.description ?? '', data.sort_order ?? 0, data.default_layout ?? 'article');
  return getBoardById(id)!;
}

export function updateBoard(id: string, data: Partial<{
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  default_layout: string;
}>): Board | undefined {
  const db = getDb();
  const board = getBoardById(id);
  if (!board) return undefined;

  db.prepare(`
    UPDATE boards SET
      name = COALESCE(?, name),
      slug = COALESCE(?, slug),
      description = COALESCE(?, description),
      sort_order = COALESCE(?, sort_order),
      default_layout = COALESCE(?, default_layout)
    WHERE id = ?
  `).run(
    data.name ?? null,
    data.slug ?? null,
    data.description ?? null,
    data.sort_order ?? null,
    data.default_layout ?? null,
    id
  );
  return getBoardById(id);
}

export function deleteBoard(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM boards WHERE id = ?').run(id);
  return result.changes > 0;
}
