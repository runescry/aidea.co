import { existsSync, readFileSync } from 'fs';
import path from 'path';

/** Load .env.local / .env for AI_GATEWAY_API_KEY and other vars. */
export function loadEnvLocal(): void {
  for (const name of ['.env.local', '.env']) {
    loadEnvFile(path.join(process.cwd(), name));
  }
}

function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
