// In-process store for request_human_input — maps requestId → resolver.
// Works in local dev (same Node.js process handles SSE + /api/respond).
// For serverless deploy, swap this for Upstash Redis pub/sub.

const pending = new Map<string, (answer: string) => void>();

export function awaitHumanInput(requestId: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('human_input_timeout'));
    }, timeoutMs);

    pending.set(requestId, (answer: string) => {
      clearTimeout(timer);
      pending.delete(requestId);
      resolve(answer);
    });
  });
}

export function resolveHumanInput(requestId: string, answer: string): boolean {
  const resolver = pending.get(requestId);
  if (!resolver) return false;
  resolver(answer);
  return true;
}

export function hasPendingInput(requestId: string): boolean {
  return pending.has(requestId);
}
