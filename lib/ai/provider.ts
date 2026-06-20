import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from '@ai-sdk/provider';

const GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1';

/** Internal ids (filesystem-friendly) → AI Gateway ids (provider/model). */
const GATEWAY_MODEL_IDS: Record<string, string> = {
  'claude-sonnet-4-6': 'anthropic/claude-sonnet-4.6',
  'claude-opus-4-6': 'anthropic/claude-opus-4.6',
  'claude-haiku-4-5': 'anthropic/claude-haiku-4.5',
  'claude-haiku-4-5-20251001': 'anthropic/claude-haiku-4.5',
};

type ProviderMode = 'gateway-key' | 'gateway-oidc' | 'anthropic-direct';

function normalizeBareModelId(modelId: string): string {
  return modelId.replace(/^anthropic\//, '').replace(/-\d{8}$/, '');
}

function isPlaceholderAnthropicKey(key: string): boolean {
  return key.includes('YOUR_KEY') || key.length < 30;
}

function hasDirectAnthropicKey(): boolean {
  const anthropic = process.env.ANTHROPIC_API_KEY ?? '';
  return anthropic.length > 0 && !isPlaceholderAnthropicKey(anthropic);
}

function hasGatewayKey(): boolean {
  const gateway = process.env.AI_GATEWAY_API_KEY ?? '';
  return gateway.length > 10;
}

function hasOidcGateway(): boolean {
  const oidc = process.env.VERCEL_OIDC_TOKEN ?? '';
  return process.env.VERCEL === '1' && oidc.length > 10;
}

function resolveProviderMode(): ProviderMode {
  if (hasGatewayKey()) return 'gateway-key';
  if (hasDirectAnthropicKey()) return 'anthropic-direct';
  if (hasOidcGateway()) return 'gateway-oidc';
  throw new Error(
    'LLM not configured — set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY in Vercel env (OIDC-only gateway often returns Forbidden without AI Gateway enabled)',
  );
}

let _provider: ReturnType<typeof createAnthropic> | null = null;
let _providerMode: ProviderMode | null = null;

function getProvider() {
  const mode = resolveProviderMode();
  if (_provider && _providerMode === mode) return _provider;

  _providerMode = mode;
  if (mode === 'gateway-key') {
    _provider = createAnthropic({
      apiKey: process.env.AI_GATEWAY_API_KEY!,
      baseURL: process.env.AI_GATEWAY_BASE_URL ?? GATEWAY_BASE_URL,
    });
  } else if (mode === 'gateway-oidc') {
    _provider = createAnthropic({
      apiKey: process.env.VERCEL_OIDC_TOKEN!,
      baseURL: process.env.AI_GATEWAY_BASE_URL ?? GATEWAY_BASE_URL,
    });
  } else {
    _provider = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _provider;
}

/** Gateway uses provider/model ids; direct Anthropic uses bare ids. */
function resolveModelId(modelId: string, mode: ProviderMode): string {
  const bare = normalizeBareModelId(modelId);
  if (mode === 'anthropic-direct') {
    return bare;
  }
  const mapped = GATEWAY_MODEL_IDS[bare] ?? GATEWAY_MODEL_IDS[modelId] ?? bare;
  if (mapped.includes('/')) return mapped;
  return `anthropic/${mapped.replace(/-(\d)-(\d)$/, '-$1.$2')}`;
}

export function useAiGateway(): boolean {
  return resolveProviderMode() !== 'anthropic-direct';
}

export function getModel(modelId?: string): LanguageModelV1 {
  const mode = resolveProviderMode();
  const id = modelId ?? 'claude-sonnet-4-6';
  return getProvider()(resolveModelId(id, mode));
}

export function hasApiKey(): boolean {
  try {
    resolveProviderMode();
    return true;
  } catch {
    return false;
  }
}

export function formatLlmError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/forbidden/i.test(message)) {
    return 'AI API returned Forbidden — add AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy';
  }
  if (/401|unauthorized/i.test(message)) {
    return 'AI API unauthorized — check your API key in Vercel environment variables';
  }
  return message;
}
