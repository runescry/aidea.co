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

export function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error('DATABASE_URL not configured');
    }
    _sql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return _sql;
}
