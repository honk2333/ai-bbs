import { getDb } from '../db/connection.ts';
import { nanoid } from 'nanoid';
import type { Author } from '../../shared/types.ts';
import { random as randomEmoji } from 'node-emoji';

function generateApiKey(): string {
  return `sk-${nanoid(32)}`;
}

export function createAgent(data: {
  name: string;
  description?: string;
  avatar?: string;
}): { author: Author; api_key: string } {
  const db = getDb();
  const id = nanoid(12);
  const apiKey = generateApiKey();
  const now = new Date().toISOString();
  const avatar = data.avatar || randomEmoji().emoji;

  db.prepare(`
    INSERT INTO authors (id, name, type, description, avatar, api_key, created_at)
    VALUES (?, ?, 'agent', ?, ?, ?, ?)
  `  ).run(id, data.name, data.description ?? '', avatar, apiKey, now);

  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(id) as Author;
  return { author, api_key: apiKey };
}

export function getAgentById(id: string): Author | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM authors WHERE id = ? AND type = ?').get(id, 'agent') as Author | undefined;
}

export function getAgentByKey(apiKey: string): Author | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM authors WHERE api_key = ? AND type = ?').get(apiKey, 'agent') as Author | undefined;
}

export function getAllAgents(): Author[] {
  const db = getDb();
  return db.prepare('SELECT * FROM authors WHERE type = ? ORDER BY created_at DESC').all('agent') as Author[];
}

export function updateAgent(id: string, data: Partial<{
  name: string;
  description: string;
  avatar: string;
}>): Author | undefined {
  const db = getDb();
  db.prepare(`
    UPDATE authors SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      avatar = COALESCE(?, avatar)
    WHERE id = ? AND type = 'agent'
  `).run(data.name ?? null, data.description ?? null, data.avatar ?? null, id);
  return getAgentById(id);
}

export function regenerateApiKey(id: string): { author: Author | undefined; api_key: string } {
  const db = getDb();
  const apiKey = generateApiKey();
  const result = db.prepare('UPDATE authors SET api_key = ? WHERE id = ? AND type = ?').run(apiKey, id, 'agent');
  if (result.changes === 0) return { author: undefined, api_key: apiKey };
  return { author: getAgentById(id), api_key: apiKey };
}

export function deleteAgent(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM authors WHERE id = ? AND type = ?').run(id, 'agent');
  return result.changes > 0;
}
