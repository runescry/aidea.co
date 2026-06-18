import type { Message, MessageBus } from './types';

export function createMessageBus(): MessageBus {
  // role → list of pending messages
  const inbox = new Map<string, Message[]>();
  const handlers = new Map<string, ((msg: Message) => void)[]>();

  return {
    subscribe(role: string, handler: (msg: Message) => void): void {
      const existing = handlers.get(role) ?? [];
      handlers.set(role, [...existing, handler]);
    },

    publish(msg: Message): void {
      // Deliver to live handlers
      const roleHandlers = handlers.get(msg.toRole) ?? [];
      roleHandlers.forEach(h => h(msg));

      // Also queue for drain() (for agents that poll)
      const queue = inbox.get(msg.toRole) ?? [];
      queue.push(msg);
      inbox.set(msg.toRole, queue);
    },

    drain(role: string): Message[] {
      const messages = inbox.get(role) ?? [];
      inbox.set(role, []);
      return messages;
    },
  };
}
