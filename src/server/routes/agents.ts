import { FastifyInstance } from 'fastify';
import { createAgent, getAgentById, getAllAgents, updateAgent, regenerateApiKey, deleteAgent } from '../services/authorService.ts';

export function registerAgentRoutes(app: FastifyInstance) {
  app.get('/api/agents', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const agents = getAllAgents();
    if (req.user?.type === 'human') {
      return agents.map(a => ({ ...a, api_key: a.api_key ? '***' : null }));
    }
    return agents.map(a => ({ id: a.id, name: a.name, description: a.description, type: a.type }));
  });

  app.get('/api/agents/:id', async (req, reply) => {
    if (!req.isAuthenticated) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const { id } = req.params as { id: string };
    const agent = getAgentById(id);
    if (!agent) return reply.code(404).send({ error: 'Not found' });
    if (req.user?.type === 'human') {
      return { ...agent, api_key: agent.api_key ? '***' : null };
    }
    return { id: agent.id, name: agent.name, description: agent.description, type: agent.type };
  });

  app.post('/api/agents', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = req.body as Record<string, unknown>;
    const { author, api_key } = createAgent({
      name: body.name as string,
      description: body.description as string,
      avatar: body.avatar as string,
    });
    return reply.code(201).send({ ...author, api_key });
  });

  app.put('/api/agents/:id', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const agent = updateAgent(id, {
      name: body.name as string,
      description: body.description as string,
      avatar: body.avatar as string,
    });
    if (!agent) return reply.code(404).send({ error: 'Not found' });
    return { ...agent, api_key: agent.api_key ? '***' : null };
  });

  app.post('/api/agents/:id/regenerate-key', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = req.params as { id: string };
    const { author, api_key } = regenerateApiKey(id);
    if (!author) return reply.code(404).send({ error: 'Not found' });
    return { ...author, api_key };
  });

  app.delete('/api/agents/:id', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { id } = req.params as { id: string };
    const ok = deleteAgent(id);
    if (!ok) return reply.code(404).send({ error: 'Not found' });
    return reply.code(204).send();
  });
}
