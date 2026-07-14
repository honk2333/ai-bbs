import { getDb } from '../db/connection.ts';
import { nanoid } from 'nanoid';
import { join, dirname } from 'node:path';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Post, PostWithRelations, PostFormat, PostLayout, PostStatus, DiscussionState, PostPriority } from '../../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getDataDir(): string {
  return join(__dirname, '..', '..', '..', 'data');
}

function getPostFilePath(postId: string, createdAt: string): string {
  const d = new Date(createdAt);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return join('posts', String(year), month, `${postId}.md`);
}

export async function createPost(data: {
  board_id: string;
  author_id: string;
  title: string;
  content: string;
  format?: PostFormat;
  layout?: PostLayout;
  status?: PostStatus;
  discussion_state?: DiscussionState;
  priority?: PostPriority;
}): Promise<Post> {
  const db = getDb();
  const id = nanoid(12);
  const now = new Date().toISOString();
  const filePath = getPostFilePath(id, now);

  const absPath = join(getDataDir(), filePath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, data.content, 'utf-8');

  db.prepare(`
    INSERT INTO posts (id, board_id, author_id, title, file_path, format, layout, status, discussion_state, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.board_id, data.author_id, data.title,
    filePath, data.format ?? 'markdown', data.layout ?? 'article',
    data.status ?? 'published', data.discussion_state ?? 'open', data.priority ?? 'none', now, now
  );

  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post;
}

export async function getPostContent(post: Post): Promise<string> {
  const absPath = join(getDataDir(), post.file_path);
  return readFile(absPath, 'utf-8');
}

export async function updatePost(id: string, data: Partial<{
  title: string;
  content: string;
  board_id: string;
  format: PostFormat;
  layout: PostLayout;
  status: PostStatus;
  discussion_state: DiscussionState;
  priority: PostPriority;
}>): Promise<Post | undefined> {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
  if (!post) return undefined;

  if (data.content !== undefined) {
    const absPath = join(getDataDir(), post.file_path);
    await writeFile(absPath, data.content, 'utf-8');
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE posts SET
      title = COALESCE(?, title),
      board_id = COALESCE(?, board_id),
      format = COALESCE(?, format),
      layout = COALESCE(?, layout),
      status = COALESCE(?, status),
      discussion_state = COALESCE(?, discussion_state),
      priority = COALESCE(?, priority),
      updated_at = ?
    WHERE id = ?
  `).run(
    data.title ?? null,
    data.board_id ?? null,
    data.format ?? null,
    data.layout ?? null,
    data.status ?? null,
    data.discussion_state ?? null,
    data.priority ?? null,
    now, id
  );

  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post;
}

export function getPostById(id: string): Post | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
}

export function getPostWithRelations(id: string): PostWithRelations | undefined {
  const db = getDb();
  const post = db.prepare(`
    SELECT p.*, b.name as board_name, b.slug as board_slug,
           a.name as author_name, a.type as author_type, a.avatar as author_avatar,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND parent_id IS NULL) as comment_count
    FROM posts p
    LEFT JOIN boards b ON p.board_id = b.id
    LEFT JOIN authors a ON p.author_id = a.id
    WHERE p.id = ?
  `).get(id);

  if (!post) return undefined;

  const raw = post as Record<string, unknown>;
  return {
    id: raw.id as string,
    board_id: raw.board_id as string,
    author_id: raw.author_id as string,
    title: raw.title as string,
    file_path: raw.file_path as string,
    format: raw.format as PostFormat,
    layout: raw.layout as PostLayout,
    status: raw.status as PostStatus,
    discussion_state: (raw.discussion_state as DiscussionState) ?? 'open',
    priority: (raw.priority as PostPriority) ?? 'none',
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    board: raw.board_slug ? {
      id: raw.board_id as string,
      name: raw.board_name as string,
      slug: raw.board_slug as string,
      description: '',
      sort_order: 0,
      default_layout: 'article' as PostLayout,
      created_at: '',
    } : undefined,
    author: raw.author_name ? {
      id: raw.author_id as string,
      name: raw.author_name as string,
      type: raw.author_type as 'human' | 'agent',
      avatar: (raw.author_avatar as string) ?? null,
      api_key: null,
      created_at: '',
    } : undefined,
    comment_count: raw.comment_count as number,
  };
}

export function getPostsByBoard(boardId: string, page: number = 1, pageSize: number = 20): PostWithRelations[] {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT p.*, b.name as board_name, b.slug as board_slug,
           a.name as author_name, a.type as author_type, a.avatar as author_avatar,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND parent_id IS NULL) as comment_count
    FROM posts p
    LEFT JOIN boards b ON p.board_id = b.id
    LEFT JOIN authors a ON p.author_id = a.id
    WHERE p.board_id = ? AND p.status = 'published'
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(boardId, pageSize, offset) as Record<string, unknown>[];

  return rows.map(raw => ({
    id: raw.id as string,
    board_id: raw.board_id as string,
    author_id: raw.author_id as string,
    title: raw.title as string,
    file_path: raw.file_path as string,
    format: raw.format as PostFormat,
    layout: raw.layout as PostLayout,
    status: raw.status as PostStatus,
    discussion_state: (raw.discussion_state as DiscussionState) ?? 'open',
    priority: (raw.priority as PostPriority) ?? 'none',
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    board: raw.board_slug ? {
      id: raw.board_id as string,
      name: raw.board_name as string,
      slug: raw.board_slug as string,
      description: '',
      sort_order: 0,
      default_layout: 'article' as PostLayout,
      created_at: '',
    } : undefined,
    author: raw.author_name ? {
      id: raw.author_id as string,
      name: raw.author_name as string,
      type: raw.author_type as 'human' | 'agent',
      avatar: (raw.author_avatar as string) ?? null,
      api_key: null,
      created_at: '',
    } : undefined,
    comment_count: raw.comment_count as number,
  }));
}

export function getRecentPosts(page: number = 1, pageSize: number = 20): PostWithRelations[] {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT p.*, b.name as board_name, b.slug as board_slug,
           a.name as author_name, a.type as author_type, a.avatar as author_avatar,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND parent_id IS NULL) as comment_count
    FROM posts p
    LEFT JOIN boards b ON p.board_id = b.id
    LEFT JOIN authors a ON p.author_id = a.id
    WHERE p.status = 'published'
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset) as Record<string, unknown>[];

  return rows.map(raw => ({
    id: raw.id as string,
    board_id: raw.board_id as string,
    author_id: raw.author_id as string,
    title: raw.title as string,
    file_path: raw.file_path as string,
    format: raw.format as PostFormat,
    layout: raw.layout as PostLayout,
    status: raw.status as PostStatus,
    discussion_state: (raw.discussion_state as DiscussionState) ?? 'open',
    priority: (raw.priority as PostPriority) ?? 'none',
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    board: raw.board_slug ? {
      id: raw.board_id as string,
      name: raw.board_name as string,
      slug: raw.board_slug as string,
      description: '',
      sort_order: 0,
      default_layout: 'article' as PostLayout,
      created_at: '',
    } : undefined,
    author: raw.author_name ? {
      id: raw.author_id as string,
      name: raw.author_name as string,
      type: raw.author_type as 'human' | 'agent',
      avatar: (raw.author_avatar as string) ?? null,
      api_key: null,
      created_at: '',
    } : undefined,
    comment_count: raw.comment_count as number,
  }));
}

export function getPostCountByBoard(boardId: string): number {
  const db = getDb();
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM posts WHERE board_id = ? AND status = ?'
  ).get(boardId, 'published') as { count: number };
  return result.count;
}

export async function deletePost(id: string): Promise<boolean> {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as Post | undefined;
  if (!post) return false;

  try {
    const absPath = join(getDataDir(), post.file_path);
    await unlink(absPath);
  } catch {
    // file may already be gone
  }

  const result = db.prepare('DELETE FROM posts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function searchPosts(query: string, page: number = 1, pageSize: number = 20): PostWithRelations[] {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const pattern = `%${query}%`;
  const rows = db.prepare(`
    SELECT p.*, b.name as board_name, b.slug as board_slug,
           a.name as author_name, a.type as author_type, a.avatar as author_avatar
    FROM posts p
    LEFT JOIN boards b ON p.board_id = b.id
    LEFT JOIN authors a ON p.author_id = a.id
    WHERE p.status = 'published' AND (p.title LIKE ? OR p.id IN (
      SELECT id FROM posts WHERE file_path IS NOT NULL
    ))
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(pattern, pageSize, offset) as Record<string, unknown>[];

  return rows.map(raw => ({
    id: raw.id as string,
    board_id: raw.board_id as string,
    author_id: raw.author_id as string,
    title: raw.title as string,
    file_path: raw.file_path as string,
    format: raw.format as PostFormat,
    layout: raw.layout as PostLayout,
    status: raw.status as PostStatus,
    discussion_state: (raw.discussion_state as DiscussionState) ?? 'open',
    priority: (raw.priority as PostPriority) ?? 'none',
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
    board: raw.board_slug ? {
      id: raw.board_id as string,
      name: raw.board_name as string,
      slug: raw.board_slug as string,
      description: '',
      sort_order: 0,
      default_layout: 'article' as PostLayout,
      created_at: '',
    } : undefined,
    author: raw.author_name ? {
      id: raw.author_id as string,
      name: raw.author_name as string,
      type: raw.author_type as 'human' | 'agent',
      avatar: (raw.author_avatar as string) ?? null,
      api_key: null,
      created_at: '',
    } : undefined,
  }));
}
