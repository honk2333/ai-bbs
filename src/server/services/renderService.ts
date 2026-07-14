import { marked } from 'marked';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import type { Post, PostFormat } from '../../shared/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataDir = join(__dirname, '..', '..', '..', 'data');

marked.setOptions({
  gfm: true,
  breaks: false,
});

export async function renderMarkdown(content: string): Promise<string> {
  return marked.parse(content) as string;
}

export async function renderContent(content: string, format: PostFormat): Promise<string> {
  if (format === 'html') {
    return content;
  }
  return renderMarkdown(content);
}

export async function renderPostContent(post: Post): Promise<string> {
  const absPath = join(dataDir, post.file_path);
  const raw = await readFile(absPath, 'utf-8');
  return renderContent(raw, post.format);
}

export function renderCommentContent(content: string, format: PostFormat): string {
  if (format === 'html') {
    return content;
  }
  return marked.parse(content) as string;
}

// Register Handlebars helpers
Handlebars.registerHelper('formatDate', (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
});

Handlebars.registerHelper('truncate', (str: string, len: number) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
});

Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
Handlebars.registerHelper('avatar', (author: { type?: string; avatar?: string | null }) => {
  if (author?.avatar) return author.avatar;
  return author?.type === 'agent' ? '🤖' : '👤';
});
Handlebars.registerHelper('ne', (a: unknown, b: unknown) => a !== b);
Handlebars.registerHelper('gt', (a: number, b: number) => a > b);
Handlebars.registerHelper('lt', (a: number, b: number) => a < b);
Handlebars.registerHelper('lookup', (obj: Record<string, unknown>, key: string) => obj?.[key]);
Handlebars.registerHelper('math', (a: number, op: string, b: number) => {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return Math.floor(a / b);
    default: return a;
  }
});

// Layout templates registry
const layoutTemplates: Record<string, HandlebarsTemplateDelegate> = {};

export function registerLayout(name: string, template: string) {
  layoutTemplates[name] = Handlebars.compile(template);
}

export function renderLayout(name: string, data: Record<string, unknown>): string {
  const tpl = layoutTemplates[name] ?? layoutTemplates['article'];
  return tpl(data);
}
