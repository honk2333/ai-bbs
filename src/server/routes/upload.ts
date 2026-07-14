import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { join, dirname } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', '..', 'data');

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function registerUploadRoutes(app: FastifyInstance) {
  app.post('/api/upload', async (req, reply) => {
    if (!req.isAuthenticated || req.user?.type !== 'human') {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'File type not allowed' });
    }

    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      return reply.code(400).send({ error: 'File too large' });
    }

    const ext = data.mimetype.split('/')[1].replace('svg+xml', 'svg');
    const filename = `${nanoid(16)}.${ext}`;
    const uploadDir = join(dataDir, 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    return { url: `/uploads/${filename}` };
  });
}
