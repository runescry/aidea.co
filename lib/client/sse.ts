export async function consumeHarnessSSE<T>(
  response: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          onEvent(JSON.parse(line.slice(6)) as T);
        } catch { /* skip malformed */ }
      }
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    throw err;
  }
}
