import { FastifyInstance } from 'fastify';
import type { AppConfig } from '../../shared/types.ts';

export function registerAuthRoutes(app: FastifyInstance, config: AppConfig) {
  app.get('/login', async (req, reply) => {
    return reply.view('pages/login.hbs', {
      title: '登录',
    });
  });

  app.post('/login', async (req, reply) => {
    const { password } = req.body as { password?: string };
    if (!password || password !== config.password) {
      return reply.code(401).view('pages/login.hbs', {
        title: '登录',
        error: '密码错误',
      });
    }

    reply.setCookie('bbs_session', 'owner', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: config.sessionMaxAge / 1000,
      path: '/',
    });

    return reply.redirect('/');
  });

  app.post('/logout', async (req, reply) => {
    reply.clearCookie('bbs_session', { path: '/' });
    return reply.redirect('/');
  });
}
