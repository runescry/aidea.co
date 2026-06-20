import { hasApiKey } from '@/lib/ai/provider';
import { getSettingsStatus } from '@/lib/settings';
import { nangoConfigured } from '@/lib/nango/client';
import { listNangoConnectionsLite } from '@/lib/nango/connections';

export interface IntegrationItem {
  id: 'llm' | 'brave' | 'google';
  label: string;
  configured: boolean;
  detail?: string;
}

export interface IntegrationStatus {
  integrations: IntegrationItem[];
  missingCount: number;
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const settings = await getSettingsStatus();
  const llmConfigured = hasApiKey() || settings.anthropicApiKey.configured;

  let googleConfigured = false;
  let googleDetail: string | undefined;
  if (nangoConfigured()) {
    const connections = await listNangoConnectionsLite();
    const google = connections.filter(c =>
      c.integrationId.startsWith('google'),
    );
    googleConfigured = google.length > 0;
    if (googleConfigured) {
      googleDetail = google.map(c => c.email ?? c.integrationId).join(', ');
    }
  }

  const integrations: IntegrationItem[] = [
    {
      id: 'llm',
      label: 'Anthropic',
      configured: llmConfigured,
    },
    {
      id: 'google',
      label: 'Google',
      configured: googleConfigured,
      detail: googleDetail,
    },
    {
      id: 'brave',
      label: 'Brave Search',
      configured: settings.braveSearchApiKey.configured,
    },
  ];

  const missingCount = integrations.filter(i => !i.configured).length;
  return { integrations, missingCount };
}
