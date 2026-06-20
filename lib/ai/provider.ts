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

function normalizeBareModelId(modelId: string): string {
  return modelId.replace(/^anthropic\//, '').replace(/-\d{8}$/, '');
}

let _provider: ReturnType<typeof createAnthropic> | null = null;

function isPlaceholderAnthropicKey(key: string): boolean {
  return key.includes('YOUR_KEY') || key.length < 30;
}

export function useAiGateway(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY
    ?? (process.env.VERCEL === '1' && process.env.VERCEL_OIDC_TOKEN)
  );
}

function gatewayApiKey(): string | undefined {
  return process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
}

function getProvider() {
  if (!_provider) {
    if (useAiGateway()) {
      const apiKey = gatewayApiKey();
      if (!apiKey) {
        throw new Error('AI Gateway not configured — set AI_GATEWAY_API_KEY');
      }
      _provider = createAnthropic({
        apiKey,
        baseURL: process.env.AI_GATEWAY_BASE_URL ?? GATEWAY_BASE_URL,
      });
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey || isPlaceholderAnthropicKey(apiKey)) {
        throw new Error('Set AI_GATEWAY_API_KEY or a valid ANTHROPIC_API_KEY');
      }
      _provider = createAnthropic({ apiKey });
    }
  }
  return _provider;
}

/** Gateway uses provider/model ids; direct Anthropic uses bare ids. */
function resolveModelId(modelId: string): string {
  const bare = normalizeBareModelId(modelId);
  if (useAiGateway()) {
    const mapped = GATEWAY_MODEL_IDS[bare] ?? GATEWAY_MODEL_IDS[modelId] ?? bare;
    if (mapped.includes('/')) return mapped;
    return `anthropic/${mapped.replace(/-(\d)-(\d)$/, '-$1.$2')}`;
  }
  return bare;
}

export function getModel(modelId?: string): LanguageModelV1 {
  const id = modelId ?? 'claude-sonnet-4-6';
  return getProvider()(resolveModelId(id));
}

export function hasApiKey(): boolean {
  const gateway = process.env.AI_GATEWAY_API_KEY ?? '';
  if (gateway.length > 10) return true;
  const oidc = process.env.VERCEL_OIDC_TOKEN ?? '';
  if (oidc.length > 10) return true;
  const anthropic = process.env.ANTHROPIC_API_KEY ?? '';
  return anthropic.length > 0 && !isPlaceholderAnthropicKey(anthropic);
}
