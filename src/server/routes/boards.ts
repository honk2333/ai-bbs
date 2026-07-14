import { FastifyInstance } from 'fastify';
import { getBoards, getBoardBySlug, createBoard, updateBoard, deleteBoard } from '../services/boardService.ts';
import { getPostsByBoard, getPostCountByBoard } from '../services/postService.ts';

export function registerBoardRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    const boards = getBoards();
    return reply.view('pages/home.hbs', {
      title: '首页',
      boards,
      isAuthenticated: req.isAuthenticated,
    });
  });

  app.get('/board/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const page = parseInt((req.query as { page?: string }).page ?? '1', 10);
    const board = getBoardBySlug(slug);
    if (!board) {
      return reply.code(404).view('pages/error.hbs', { title: '404', message: '板块不存在' });
    }

    const pageSize = 20;
    const posts = getPostsByBoard(board.id, page, pageSize);
    const total = getPostCountByBoard(board.id);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return reply.view('pages/board.hbs', {
      title: board.name,
      board,
      posts,
      page,
      totalPages,
      isAuthenticated: req.isAuthenticated,
    });
  });

  app.get('/api/boards', async (req, reply) => {
    const boards = getBoards();
    return boards;
  });

  app.post('/api/boards', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = req.body as Record<string, unknown>;
    const board = createBoard({
      name: body.name as string,
      slug: body.slug as string,
      description: body.description as string,
      sort_order: body.sort_order as number,
      default_layout: body.default_layout as string,
    });
    return reply.code(201).send(board);
  });

  app.put('/api/boards/:id', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const board = updateBoard(id, {
      name: body.name as string,
      slug: body.slug as string,
      description: body.description as string,
      sort_order: body.sort_order as number,
      default_layout: body.default_layout as string,
    });
    if (!board) return reply.code(404).send({ error: 'Not found' });
    return board;
  });

  app.delete('/api/boards/:id', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = req.params as { id: string };
    const ok = deleteBoard(id);
    if (!ok) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
}
