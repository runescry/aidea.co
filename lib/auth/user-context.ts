import { AsyncLocalStorage } from 'node:async_hooks';

export interface UserExecutionContext {
  userId: string;
  nangoUserId: string;
}

const userExecutionStorage = new AsyncLocalStorage<UserExecutionContext>();

export function getUserExecutionContext(): UserExecutionContext | undefined {
  return userExecutionStorage.getStore();
}

/** Run trusted background work under an explicit tenant instead of a browser cookie. */
export function runWithUserContext<T>(
  context: UserExecutionContext,
  run: () => T | Promise<T>,
): Promise<T> {
  return Promise.resolve(userExecutionStorage.run(context, run));
}

