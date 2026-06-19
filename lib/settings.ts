import {
  readStoredSettings,
  writeStoredSettings,
  isProductionDeploy,
} from '@/lib/storage';

export interface AppSettings {
  anthropicApiKey?: string;
  braveSearchApiKey?: string;
}

export interface SettingStatus {
  configured: boolean;
  preview?: string;
  source?: 'settings' | 'env';
}

export type SettingsStatus = Record<keyof AppSettings, SettingStatus>;

const ENV_MAP: Record<keyof AppSettings, string | undefined> = {
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  braveSearchApiKey: 'BRAVE_SEARCH_API_KEY',
};

function maskValue(value: string): string {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export async function readSettings(): Promise<AppSettings> {
  return readStoredSettings();
}

export async function writeSettings(updates: Partial<AppSettings>): Promise<void> {
  await writeStoredSettings(updates);
}

export function getSetting(key: keyof AppSettings): string | undefined {
  const envKey = ENV_MAP[key];
  if (envKey) {
    const fromEnv = process.env[envKey];
    if (fromEnv) return fromEnv;
  }
  if (isProductionDeploy()) return undefined;
  try {
    const fs = require('@/lib/storage/filesystem') as typeof import('@/lib/storage/filesystem');
    const fromFile = fs.readSettings()[key];
    if (fromFile) return fromFile;
  } catch { /* postgres-only local */ }
  return undefined;
}

export async function getSettingsStatus(): Promise<SettingsStatus> {
  const stored = await readStoredSettings();
  const status = {} as SettingsStatus;

  for (const key of Object.keys(ENV_MAP) as Array<keyof AppSettings>) {
    const envKey = ENV_MAP[key];
    const fromFile = stored[key];
    const fromEnv = envKey ? process.env[envKey] : undefined;
    const value = fromEnv || fromFile;
    status[key] = {
      configured: Boolean(value),
      preview: value ? maskValue(value) : undefined,
      source: fromEnv ? 'env' : fromFile ? 'settings' : undefined,
    };
  }

  return status;
}

export function isSettingsReadOnly(): boolean {
  return isProductionDeploy();
}
