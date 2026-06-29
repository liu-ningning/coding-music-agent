// 内存存储（sidecar 使用内存，前端使用 localStorage）
// 这里用内存，因为 sidecar 是 Node.js 环境

class MemoryStore {
  private data: Map<string, any> = new Map();

  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.data.has(key) ? this.data.get(key) : defaultValue;
  }

  set(key: string, value: any): void {
    this.data.set(key, value);
  }

  delete(key: string): void {
    this.data.delete(key);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  clear(): void {
    this.data.clear();
  }
}

// 全局存储实例
export const store = new MemoryStore();

// Session 存储
export interface StoredSession {
  id: string;
  title: string;
  projectName?: string;
  projectPath?: string;
  taskType: string;
  mood: string;
  status: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
}

export interface StoredMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  eventType?: string;
  createdAt: string;
}

export interface StoredFeedback {
  id: string;
  sessionId: string;
  recommendationId: string;
  action: string;
  createdAt: string;
}

export interface StoredRecommendation {
  id: string;
  sessionId: string;
  mode: string;
  title: string;
  reason: string;
  tracks: any[];
  atmosphere: any;
  createdAt: string;
}

// Session 操作
export const sessionStore = {
  getAll: (): StoredSession[] => store.get<StoredSession[]>('sessions', []) || [],
  getById: (id: string): StoredSession | undefined => {
    return sessionStore.getAll().find(s => s.id === id);
  },
  create: (session: StoredSession): void => {
    const sessions = sessionStore.getAll();
    sessions.unshift(session);
    store.set('sessions', sessions);
  },
  update: (id: string, patch: Partial<StoredSession>): void => {
    const sessions = sessionStore.getAll();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...patch, updatedAt: new Date().toISOString() };
      store.set('sessions', sessions);
    }
  },
  delete: (id: string): void => {
    const sessions = sessionStore.getAll().filter(s => s.id !== id);
    store.set('sessions', sessions);
  },
};

// 消息操作
export const messageStore = {
  getBySession: (sessionId: string): StoredMessage[] => {
    const all = store.get<StoredMessage[]>('messages', []) || [];
    return all.filter(m => m.sessionId === sessionId);
  },
  add: (message: StoredMessage): void => {
    const all = store.get<StoredMessage[]>('messages', []) || [];
    all.push(message);
    store.set('messages', all);
  },
};

// 反馈操作
export const feedbackStore = {
  getAll: (): StoredFeedback[] => store.get<StoredFeedback[]>('feedback', []) || [],
  add: (feedback: StoredFeedback): void => {
    const all = feedbackStore.getAll();
    all.push(feedback);
    store.set('feedback', all);
  },
};

// 推荐操作
export const recommendationStore = {
  getAll: (): StoredRecommendation[] => store.get<StoredRecommendation[]>('recommendations', []) || [],
  add: (rec: StoredRecommendation): void => {
    const all = recommendationStore.getAll();
    all.push(rec);
    store.set('recommendations', all);
  },
};

// 权限操作
export const permissionStore = {
  get: (key: string): string => store.get<string>(`perm_${key}`, 'disabled') || 'disabled',
  set: (key: string, value: string): void => store.set(`perm_${key}`, value),
  getAll: (): Record<string, string> => {
    const keys = ['weather', 'projectContext', 'commandExecution', 'fileOperations'];
    const result: Record<string, string> = {};
    keys.forEach(k => result[k] = permissionStore.get(k));
    return result;
  },
};

// 偏好学习操作
export const preferenceStore = {
  get: (key: string): string | undefined => store.get<string>(`pref_${key}`),
  set: (key: string, value: string): void => store.set(`pref_${key}`, value),
  delete: (key: string): void => store.delete(`pref_${key}`),
};
