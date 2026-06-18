import type { EventSystem } from './types';

type Handler = (entityId: string, payload: Record<string, unknown>) => void;

export function createEventSystem(): EventSystem {
  const listeners = new Map<string, Handler[]>(); // topic → handlers

  return {
    emit(topic: string, entityId: string, payload: Record<string, unknown>): void {
      const handlers = listeners.get(topic) ?? [];
      handlers.forEach(h => h(entityId, payload));
    },

    on(topic: string, handler: Handler): () => void {
      const existing = listeners.get(topic) ?? [];
      listeners.set(topic, [...existing, handler]);
      return () => {
        const current = listeners.get(topic) ?? [];
        listeners.set(topic, current.filter(h => h !== handler));
      };
    },
  };
}
