import { FastifyInstance } from 'fastify';
import { createComment, getCommentsByPost, deleteComment, updateCommentState } from '../services/commentService.ts';
import { renderCommentContent } from '../services/renderService.ts';
import type { CommentFormat, CommentState } from '../../shared/types.ts';

export function registerCommentRoutes(app: FastifyInstance) {
  app.get('/api/posts/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const comments = getCommentsByPost(id);
    return comments;
  });

  app.post('/api/posts/:id/comments', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const comment = createComment({
      post_id: id,
      author_id: req.user!.id,
      content: body.content as string,
      format: (body.format as CommentFormat) ?? 'markdown',
      parent_id: (body.parent_id as string) ?? null,
      state: (body.state as CommentState) ?? 'active',
    });

    const html = renderCommentContent(comment.content, comment.format);

    if (req.headers.accept?.includes('text/html')) {
      return reply.view('partials/comment-item.hbs', {
        comment: {
          ...comment,
          author: req.user,
          children: [],
        },
        commentHtml: html,
        isAuthenticated: req.isAuthenticated,
        canReply: true,
      });
    }

    return reply.code(201).send({ ...comment, html });
  });

  app.delete('/api/comments/:id', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };

    const { getCommentById } = await import('../services/commentService.ts');
    const comment = getCommentById(id);
    if (!comment) return reply.code(404).send({ error: 'Not found' });

    if (req.user!.type !== 'human' && comment.author_id !== req.user!.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const ok = deleteComment(id);
    if (!ok) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });

  app.patch('/api/comments/:id/state', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const state = body.state as CommentState;
    if (!state || !['active', 'resolved'].includes(state)) {
      return reply.code(400).send({ error: 'Invalid state' });
    }

    const comment = updateCommentState(id, state);
    if (!comment) return reply.code(404).send({ error: 'Not found' });
    return comment;
  });
}
