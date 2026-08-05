import postgres, { type JSONValue } from 'postgres';

let _sql: ReturnType<typeof postgres> | null = null;

/** Standard Postgres URL — works with Neon, Supabase, RDS, local, etc. */
export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL
    ?? process.env.POSTGRES_PRISMA_URL
  );
}

export function hasDatabase(): boolean {
  return Boolean(getDatabaseUrl());
}

export function toJson(value: unknown): JSONValue {
  return JSON.parse(JSON.stringify(value)) as JSONValue;
}

export function databasePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (!raw) return 3;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(Math.max(parsed, 1), 10);
}

export function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error('DATABASE_URL not configured');
    }
    _sql = postgres(url, {
      max: databasePoolMax(),
      idle_timeout: 20,
      connect_timeout: 15,
      onnotice: notice => {
        // Expected from CREATE TABLE/INDEX IF NOT EXISTS on every fresh connection in dev.
        if (notice.code === '42P07') return;
        console.warn('[postgres]', notice);
      },
    });
  }
  return _sql;
}
