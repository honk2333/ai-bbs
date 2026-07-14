import { FastifyInstance } from 'fastify';
import {
  createPost,
  getPostById,
  getPostWithRelations,
  getPostContent,
  updatePost,
  deletePost,
  getRecentPosts,
  searchPosts,
} from '../services/postService.ts';
import { getCommentsByPost } from '../services/commentService.ts';
import { renderPostContent } from '../services/renderService.ts';
import { getBoardBySlug } from '../services/boardService.ts';
import type { PostFormat, PostLayout, PostStatus } from '../../shared/types.ts';

export function registerPostRoutes(app: FastifyInstance) {
  app.get('/posts/new', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.redirect('/login');
    }
    const { board } = req.query as { board?: string };
    return reply.view('pages/post-editor.hbs', {
      title: '发帖',
      mode: 'create',
      boardSlug: board ?? '',
      isAuthenticated: true,
    });
  });

  app.get('/posts/:id/edit', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.redirect('/login');
    }
    const { id } = req.params as { id: string };
    const post = getPostById(id);
    if (!post) return reply.code(404).view('pages/error.hbs', { title: '404', message: '帖子不存在' });

    const content = await getPostContent(post);
    return reply.view('pages/post-editor.hbs', {
      title: '编辑帖子',
      mode: 'edit',
      post,
      content,
      isAuthenticated: true,
    });
  });

  app.get('/posts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = getPostWithRelations(id);
    if (!post) return reply.code(404).view('pages/error.hbs', { title: '404', message: '帖子不存在' });

    const contentHtml = await renderPostContent(post);
    const comments = getCommentsByPost(id);

    return reply.view('pages/post.hbs', {
      title: post.title,
      post,
      contentHtml,
      comments,
      isAuthenticated: req.isAuthenticated,
      canEdit: req.isAuthenticated && req.user?.type === 'human',
    });
  });

  app.get('/recent', async (req, reply) => {
    const page = parseInt((req.query as { page?: string }).page ?? '1', 10);
    const pageSize = 20;
    const posts = getRecentPosts(page, pageSize);
    return reply.view('pages/recent.hbs', {
      title: '最新帖子',
      posts,
      page,
      totalPages: 1,
      isAuthenticated: req.isAuthenticated,
    });
  });

  app.get('/search', async (req, reply) => {
    const q = (req.query as { q?: string }).q ?? '';
    const posts = q ? searchPosts(q) : [];
    return reply.view('pages/search.hbs', {
      title: '搜索',
      query: q,
      posts,
      isAuthenticated: req.isAuthenticated,
    });
  });

  app.get('/api/posts', async (req, reply) => {
    const query = req.query as { board?: string; page?: string; q?: string };
    const page = parseInt(query.page ?? '1', 10);
    const pageSize = 20;

    if (query.q) {
      return searchPosts(query.q, page, pageSize);
    }

    if (query.board) {
      const board = getBoardBySlug(query.board);
      if (!board) return reply.code(404).send({ error: 'Board not found' });
      const { getPostsByBoard } = await import('../services/postService.ts');
      return getPostsByBoard(board.id, page, pageSize);
    }

    return getRecentPosts(page, pageSize);
  });

  app.get('/api/posts/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = getPostWithRelations(id);
    if (!post) return reply.code(404).send({ error: 'Not found' });
    const content = await getPostContent(post);
    return { ...post, content };
  });

  app.post('/api/posts', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const body = req.body as Record<string, unknown>;
    const boardSlug = body.board as string;
    const board = getBoardBySlug(boardSlug);
    if (!board) return reply.code(400).send({ error: 'Invalid board' });

    const post = await createPost({
      board_id: board.id,
      author_id: req.user!.id,
      title: body.title as string,
      content: body.content as string,
      format: (body.format as PostFormat) ?? 'markdown',
      layout: (body.layout as PostLayout) ?? board.default_layout,
      status: (body.status as PostStatus) ?? 'published',
    });

    if (req.headers.accept?.includes('text/html')) {
      return reply.redirect(`/posts/${post.id}`);
    }
    return reply.code(201).send(post);
  });

  app.put('/api/posts/:id', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const existing = getPostById(id);
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    if (req.user!.type === 'human' || existing.author_id === req.user!.id) {
      const post = await updatePost(id, {
        title: body.title as string,
        content: body.content as string,
        board_id: body.board_id as string,
        format: body.format as PostFormat,
        layout: body.layout as PostLayout,
        status: body.status as PostStatus,
      });
      if (!post) return reply.code(404).send({ error: 'Not found' });

      if (req.headers.accept?.includes('text/html')) {
        return reply.redirect(`/posts/${post.id}`);
      }
      return post;
    }

    return reply.code(403).send({ error: 'Forbidden' });
  });

  app.delete('/api/posts/:id', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const existing = getPostById(id);
    if (!existing) return reply.code(404).send({ error: 'Not found' });

    if (req.user!.type !== 'human' && existing.author_id !== req.user!.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const ok = await deletePost(id);
    if (!ok) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
}
