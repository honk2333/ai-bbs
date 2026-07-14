import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import view from '@fastify/view';
import Handlebars from 'handlebars';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

import type { AppConfig } from '../shared/types.ts';
import { initDb } from './db/connection.ts';
import { createAuthMiddleware } from './middleware/auth.ts';
import './services/renderService.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerBoardRoutes } from './routes/boards.ts';
import { registerPostRoutes } from './routes/posts.ts';
import { registerCommentRoutes } from './routes/comments.ts';
import { registerUploadRoutes } from './routes/upload.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');

async function main() {
  const configPath = join(rootDir, 'config', 'app.json');
  const rawConfig = readFileSync(configPath, 'utf-8');
  const config: AppConfig = JSON.parse(rawConfig);

  const dataDir = join(rootDir, config.dataDir);
  mkdirSync(join(dataDir, 'posts'), { recursive: true });
  mkdirSync(join(dataDir, 'uploads'), { recursive: true });
  mkdirSync(join(dataDir, '..', 'dist'), { recursive: true });

  const dbPath = join(dataDir, 'bbs.db');
  initDb(dbPath);

  const app = Fastify({ logger: true });

  await app.register(cookie, {});
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  const viewsDir = join(__dirname, 'web', 'views');
  const partialsDir = join(viewsDir, 'partials');
  const layoutsDir = join(viewsDir, 'layouts');

  const partials: Record<string, string> = {};
  try {
    for (const file of readdirSync(partialsDir)) {
      if (file.endsWith('.hbs')) {
        const name = file.replace('.hbs', '');
        partials[name] = readFileSync(join(partialsDir, file), 'utf-8');
      }
    }
  } catch { /* partials dir may not exist yet */ }

  await app.register(view, {
    engine: { handlebars: Handlebars },
    root: join(viewsDir, 'pages'),
    options: {
      partials,
    },
  });

  await app.register(staticPlugin, {
    root: join(__dirname, 'web', 'public'),
    prefix: '/static/',
  });

  await app.register(staticPlugin, {
    root: join(dataDir, 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  app.addHook('preHandler', createAuthMiddleware(config));

  registerAuthRoutes(app, config);
  registerBoardRoutes(app);
  registerPostRoutes(app);
  registerCommentRoutes(app);
  registerUploadRoutes(app);

  app.setErrorHandler(async (error, req, reply) => {
    app.log.error(error);
    if (req.headers.accept?.includes('text/html')) {
      return reply.code(500).view('error.hbs', {
        title: '错误',
        message: error.message,
      });
    }
    return reply.code(error.statusCode ?? 500).send({ error: error.message });
  });

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n  BBS running at http://localhost:${config.port}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
