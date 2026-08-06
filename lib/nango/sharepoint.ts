import { getNango, microsoftIntegrationId } from './client';
import { resolveMicrosoftConnections } from './connections';
import { extractTextFromBuffer } from '@/lib/documents/extract-text';

export interface SharePointNewsItem {
  title: string;
  publishedAt: string;
  url: string;
  summary?: string;
}

export interface SharePointDocumentItem {
  name: string;
  url: string;
  excerpt?: string;
  child?: string;
}

async function graphGet<T>(
  connectionId: string,
  endpoint: string,
): Promise<T> {
  const nango = getNango();
  const integrationId = microsoftIntegrationId();
  const res = await nango.get<T>({
    providerConfigKey: integrationId,
    connectionId,
    endpoint,
    baseUrlOverride: 'https://graph.microsoft.com',
  });
  return res.data;
}

export async function listSiteNewsItems(input: {
  siteId: string;
  listId: string;
  connectionId?: string;
  limit?: number;
}): Promise<SharePointNewsItem[]> {
  const [conn] = await resolveMicrosoftConnections(input.connectionId);
  const limit = input.limit ?? 10;
  const data = await graphGet<{
    value?: Array<{ webUrl?: string; fields?: Record<string, unknown> }>;
  }>(
    conn.connectionId,
    `/v1.0/sites/${encodeURIComponent(input.siteId)}/lists/${encodeURIComponent(input.listId)}/items?expand=fields&$top=${limit}`,
  );

  return (data.value ?? []).map(item => {
    const fields = item.fields ?? {};
    const title = String(fields.Title ?? fields.LinkTitle ?? 'News item');
    const published = String(fields.PublishDate ?? fields.Created ?? fields.Modified ?? '');
    return {
      title,
      publishedAt: published,
      url: String(item.webUrl ?? fields.FileRef ?? ''),
      summary: fields.Description ? String(fields.Description).slice(0, 240) : undefined,
    };
  }).filter(item => item.title);
}

export async function listDriveDocuments(input: {
  siteId: string;
  folderPath: string;
  connectionId?: string;
  child?: string;
  limit?: number;
}): Promise<SharePointDocumentItem[]> {
  const [conn] = await resolveMicrosoftConnections(input.connectionId);
  const limit = input.limit ?? 10;
  const path = input.folderPath.replace(/^\/+/, '');
  const endpoint = path
    ? `/v1.0/sites/${encodeURIComponent(input.siteId)}/drive/root:/${path.split('/').map(encodeURIComponent).join('/')}:/children?$top=${limit}`
    : `/v1.0/sites/${encodeURIComponent(input.siteId)}/drive/root/children?$top=${limit}`;

  const data = await graphGet<{
    value?: Array<{ id?: string; name?: string; webUrl?: string; file?: { mimeType?: string }; lastModifiedDateTime?: string }>;
  }>(conn.connectionId, endpoint);

  const items: SharePointDocumentItem[] = [];
  for (const entry of data.value ?? []) {
    if (!entry.name || !entry.webUrl) continue;
    let excerpt: string | undefined;
    if (entry.file?.mimeType === 'application/pdf' && entry.id) {
      try {
        const bytes = await downloadDriveFileBytes(input.siteId, entry.id, conn.connectionId);
        const extracted = await extractTextFromBuffer(bytes, entry.file.mimeType, entry.name);
        excerpt = extracted.text.slice(0, 500);
      } catch {
        excerpt = undefined;
      }
    }
    items.push({
      name: entry.name,
      url: entry.webUrl,
      excerpt,
      child: input.child,
    });
  }
  return items;
}

export async function downloadDriveFileBytes(
  siteId: string,
  itemId: string,
  connectionId: string,
): Promise<Buffer> {
  const nango = getNango();
  const res = await nango.get<ArrayBuffer>({
    providerConfigKey: microsoftIntegrationId(),
    connectionId,
    endpoint: `/v1.0/sites/${encodeURIComponent(siteId)}/drive/items/${encodeURIComponent(itemId)}/content`,
    baseUrlOverride: 'https://graph.microsoft.com',
    responseType: 'arraybuffer',
  });
  return Buffer.from(res.data as ArrayBuffer);
}

export interface SharePointSite {
  id: string;
  name: string;
  webUrl?: string;
}

export interface SharePointList {
  id: string;
  name: string;
  webUrl?: string;
  /** Graph list template — 'news'/'webPageLibrary' are the usual school announcement lists. */
  template?: string;
}

export async function searchSharePointSites(query: string, connectionId?: string): Promise<SharePointSite[]> {
  const [conn] = await resolveMicrosoftConnections(connectionId);
  // Graph rejects an empty search term; '*' is its documented "everything" wildcard.
  const term = query.trim() || '*';
  const data = await graphGet<{
    value?: Array<{ id?: string; displayName?: string; name?: string; webUrl?: string }>;
  }>(conn.connectionId, `/v1.0/sites?search=${encodeURIComponent(term)}`);
  return (data.value ?? []).map(site => ({
    id: site.id ?? '',
    name: site.displayName ?? site.name ?? 'Site',
    webUrl: site.webUrl,
  })).filter(s => s.id);
}

/**
 * Lists a site's document/announcement lists so the news list can be picked by name
 * instead of hand-pasting a GUID. Hidden system lists are filtered out.
 */
export async function listSiteLists(siteId: string, connectionId?: string): Promise<SharePointList[]> {
  const [conn] = await resolveMicrosoftConnections(connectionId);
  const data = await graphGet<{
    value?: Array<{
      id?: string;
      displayName?: string;
      name?: string;
      webUrl?: string;
      list?: { template?: string; hidden?: boolean };
    }>;
  }>(conn.connectionId, `/v1.0/sites/${encodeURIComponent(siteId)}/lists?$top=100`);

  return (data.value ?? [])
    .filter(list => list.id && !list.list?.hidden)
    .map(list => ({
      id: list.id!,
      name: list.displayName ?? list.name ?? 'List',
      webUrl: list.webUrl,
      template: list.list?.template,
    }));
}
