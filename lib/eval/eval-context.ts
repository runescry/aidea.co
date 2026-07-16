import { AsyncLocalStorage } from 'node:async_hooks';
import type { KnowledgeBase } from '@/types/knowledge-base';

export interface EvalHarnessContext {
  kbFixture?: Partial<KnowledgeBase> | Record<string, unknown>;
  skipQueueWrites: boolean;
  skipPersist: boolean;
}

const storage = new AsyncLocalStorage<EvalHarnessContext>();

export function getEvalHarnessContext(): EvalHarnessContext | undefined {
  return storage.getStore();
}

export function isEvalHarnessActive(): boolean {
  return storage.getStore() != null;
}

export async function runInEvalHarnessContext<T>(
  ctx: EvalHarnessContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(ctx, fn);
}
