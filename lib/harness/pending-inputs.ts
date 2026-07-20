import { getCurrentUserId } from '@/lib/auth/session';

const pendingLocal = new Map<string, (answer: string) => void>();

async function tenantKey(requestId: string): Promise<string> {
  return `${await getCurrentUserId()}:${requestId}`;
}

async function getKv() {
  if (!process.env.KV_REST_API_URL) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

export async function awaitHumanInput(requestId: string, timeoutMs: number): Promise<string> {
  const kv = await getKv();
  const key = await tenantKey(requestId);

  if (!kv) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingLocal.delete(key);
        reject(new Error('human_input_timeout'));
      }, timeoutMs);
      pendingLocal.set(key, (answer: string) => {
        clearTimeout(timer);
        pendingLocal.delete(key);
        resolve(answer);
      });
    });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const answer = await kv.get<string>(`human:answer:${key}`);
    if (answer) {
      await kv.del(`human:answer:${key}`);
      await kv.del(`human:pending:${key}`);
      return answer;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  await kv.del(`human:pending:${key}`);
  throw new Error('human_input_timeout');
}

export async function resolveHumanInput(requestId: string, answer: string): Promise<boolean> {
  const kv = await getKv();
  const key = await tenantKey(requestId);

  if (!kv) {
    const resolver = pendingLocal.get(key);
    if (!resolver) return false;
    resolver(answer);
    return true;
  }

  if (!await kv.get(`human:pending:${key}`)) return false;
  await kv.set(`human:answer:${key}`, answer, { ex: 300 });
  return true;
}

export async function hasPendingInput(requestId: string): Promise<boolean> {
  const kv = await getKv();
  const key = await tenantKey(requestId);
  if (!kv) return pendingLocal.has(key);
  return Boolean(await kv.get(`human:pending:${key}`));
}

export async function markPendingInput(requestId: string): Promise<void> {
  const kv = await getKv();
  const key = await tenantKey(requestId);
  if (kv) await kv.set(`human:pending:${key}`, '1', { ex: 600 });
}
