const pendingLocal = new Map<string, (answer: string) => void>();

async function getKv() {
  if (!process.env.KV_REST_API_URL) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

export async function awaitHumanInput(requestId: string, timeoutMs: number): Promise<string> {
  const kv = await getKv();

  if (!kv) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingLocal.delete(requestId);
        reject(new Error('human_input_timeout'));
      }, timeoutMs);
      pendingLocal.set(requestId, (answer: string) => {
        clearTimeout(timer);
        pendingLocal.delete(requestId);
        resolve(answer);
      });
    });
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const answer = await kv.get<string>(`human:answer:${requestId}`);
    if (answer) {
      await kv.del(`human:answer:${requestId}`);
      await kv.del(`human:pending:${requestId}`);
      return answer;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  await kv.del(`human:pending:${requestId}`);
  throw new Error('human_input_timeout');
}

export async function resolveHumanInput(requestId: string, answer: string): Promise<boolean> {
  const kv = await getKv();

  if (!kv) {
    const resolver = pendingLocal.get(requestId);
    if (!resolver) return false;
    resolver(answer);
    return true;
  }

  await kv.set(`human:answer:${requestId}`, answer, { ex: 300 });
  return true;
}

export async function hasPendingInput(requestId: string): Promise<boolean> {
  const kv = await getKv();
  if (!kv) return pendingLocal.has(requestId);
  return Boolean(await kv.get(`human:pending:${requestId}`));
}

export async function markPendingInput(requestId: string): Promise<void> {
  const kv = await getKv();
  if (kv) await kv.set(`human:pending:${requestId}`, '1', { ex: 600 });
}
