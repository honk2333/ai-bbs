import { getDb } from '../db/connection.ts';
import { nanoid } from 'nanoid';
import type { Comment, CommentWithRelations, CommentFormat, CommentState } from '../../shared/types.ts';

export function createComment(data: {
  post_id: string;
  author_id: string;
  content: string;
  format?: CommentFormat;
  parent_id?: string | null;
  state?: CommentState;
}): Comment {
  const db = getDb();
  const id = nanoid(12);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO comments (id, post_id, author_id, content, format, parent_id, state, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.post_id, data.author_id, data.content,
    data.format ?? 'markdown', data.parent_id ?? null, data.state ?? 'active', now
  );

  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment;
}

export function getCommentById(id: string): Comment | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment | undefined;
}

export function getCommentsByPost(postId: string): CommentWithRelations[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, a.name as author_name, a.type as author_type, a.avatar as author_avatar
    FROM comments c
    LEFT JOIN authors a ON c.author_id = a.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `).all(postId) as Record<string, unknown>[];

  const comments: CommentWithRelations[] = rows.map(raw => ({
    id: raw.id as string,
    post_id: raw.post_id as string,
    author_id: raw.author_id as string,
    content: raw.content as string,
    format: raw.format as CommentFormat,
    parent_id: (raw.parent_id as string) ?? null,
    state: (raw.state as CommentState) ?? 'active',
    created_at: raw.created_at as string,
    author: raw.author_name ? {
      id: raw.author_id as string,
      name: raw.author_name as string,
      type: raw.author_type as 'human' | 'agent',
      description: (raw.author_description as string) ?? '',
      avatar: (raw.author_avatar as string) ?? null,
      api_key: null,
      created_at: '',
    } : undefined,
  }));

  const topLevel = comments.filter(c => c.parent_id === null);
  const childrenMap = new Map<string, CommentWithRelations[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const arr = childrenMap.get(c.parent_id) ?? [];
      arr.push(c);
      childrenMap.set(c.parent_id, arr);
    }
  }

  for (const parent of topLevel) {
    parent.children = childrenMap.get(parent.id) ?? [];
  }

  return topLevel;
}

export function deleteComment(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  return result.changes > 0;
}

export function updateCommentState(id: string, state: CommentState): Comment | undefined {
  const db = getDb();
  db.prepare('UPDATE comments SET state = ? WHERE id = ?').run(state, id);
  return db.prepare('SELECT * FROM comments WHERE id = ?').get(id) as Comment | undefined;
}

export function getCommentCountByPost(postId: string): number {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM comments WHERE post_id = ?').get(postId) as { count: number };
  return result.count;
}
