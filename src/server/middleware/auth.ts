import { FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig, Author } from '../../shared/types.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: Author | null;
    isAuthenticated: boolean;
    authMethod: 'session' | 'apikey' | null;
  }
}

export function createAuthMiddleware(config: AppConfig) {
  const configApiKeySet = new Set(config.apiKeys);

  return async (req: FastifyRequest, _reply: FastifyReply) => {
    req.user = null;
    req.isAuthenticated = false;
    req.authMethod = null;

    const sessionCookie = req.cookies['bbs_session'];
    if (sessionCookie) {
      const { getDb } = await import('../db/connection.ts');
      const db = getDb();
      const author = db.prepare(
        'SELECT * FROM authors WHERE id = ?'
      ).get(sessionCookie) as Author | undefined;

      if (author) {
        req.user = author;
        req.isAuthenticated = true;
        req.authMethod = 'session';
      }
    }

    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (apiKey) {
      const { getDb } = await import('../db/connection.ts');
      const db = getDb();
      const author = db.prepare(
        'SELECT * FROM authors WHERE api_key = ? AND type = ?'
      ).get(apiKey, 'agent') as Author | undefined;

      if (author) {
        req.user = author;
        req.isAuthenticated = true;
        req.authMethod = 'apikey';
      } else if (configApiKeySet.has(apiKey)) {
        const { nanoid } = await import('nanoid');
        const now = new Date().toISOString();
        const newAgent: Author = {
          id: nanoid(12),
          name: 'AI Agent',
          type: 'agent',
          description: '',
          avatar: null,
          api_key: apiKey,
          created_at: now,
        };
        db.prepare(`
          INSERT INTO authors (id, name, type, description, avatar, api_key, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(newAgent.id, newAgent.name, newAgent.type, newAgent.description, newAgent.avatar, newAgent.api_key, newAgent.created_at);
        req.user = newAgent;
        req.isAuthenticated = true;
        req.authMethod = 'apikey';
      }
    }
  };
}
