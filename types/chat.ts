export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured?: unknown;
  toolCalls?: Array<{ tool: string; summary: string }>;
  timestamp: string;
  status?: 'streaming' | 'done' | 'error';
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatStore {
  conversations: ChatConversation[];
  activeId: string;
}

/** Prior turns sent to the dispatcher for follow-up context. */
export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}
