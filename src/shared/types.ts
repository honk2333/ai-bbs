export type AuthorType = 'human' | 'agent';
export type PostFormat = 'markdown' | 'html';
export type PostLayout = 'article' | 'card' | 'doc';
export type PostStatus = 'draft' | 'published';
export type DiscussionState = 'open' | 'closed';
export type PostPriority = 'none' | 'P0' | 'P1' | 'P2';
export type CommentFormat = 'markdown' | 'html';
export type CommentState = 'active' | 'resolved';

export interface Author {
  id: string;
  name: string;
  type: AuthorType;
  description: string;
  avatar: string | null;
  api_key: string | null;
  created_at: string;
}

export interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  default_layout: PostLayout;
  created_at: string;
}

export interface Post {
  id: string;
  board_id: string;
  author_id: string;
  title: string;
  file_path: string;
  format: PostFormat;
  layout: PostLayout;
  status: PostStatus;
  discussion_state: DiscussionState;
  priority: PostPriority;
  created_at: string;
  updated_at: string;
}

export interface PostWithRelations extends Post {
  board?: Board;
  author?: Author;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  format: CommentFormat;
  parent_id: string | null;
  state: CommentState;
  created_at: string;
}

export interface CommentWithRelations extends Comment {
  author?: Author;
  children?: CommentWithRelations[];
}

export interface AppConfig {
  port: number;
  host: string;
  password: string;
  sessionSecret: string;
  sessionMaxAge: number;
  dataDir: string;
  apiKeys: string[];
}
