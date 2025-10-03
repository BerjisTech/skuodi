export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Space {
  id: string;
  name: string;
  owner: User;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceMember {
  id: string;
  role: string;
  user: User;
  createdAt: string;
}

export interface SpaceInvite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  spaceId: string;
  createdBy: User;
  createdAt: string;
  updatedAt: string;
}

export interface DocSnapshot {
  id: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

export interface Asset {
  id: string;
  spaceId: string;
  owner: User;
  kind: string;
  title: string;
  description?: string | null;
  priceCents: number;
  license: string;
  storageKey: string;
  previewUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  projectId: string;
  author: User;
  body: string;
  anchor?: Record<string, unknown> | null;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  author: User;
  assignee?: User | null;
  title: string;
  description?: string | null;
  status: 'todo' | 'in-progress' | 'done';
  dueAt?: string | null;
  anchor?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RtcTokenResponse {
  url: string;
  token: string;
  room: string;
}
