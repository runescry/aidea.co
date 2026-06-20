'use client';

import { useState, useEffect, useCallback } from 'react';

export function usePollingFetch<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setData(await fetcher());
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are caller-controlled refresh triggers
  }, [refresh, intervalMs, ...deps]);

  return { data, loading, refresh };
}
