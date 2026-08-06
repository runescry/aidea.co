'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChildProfile } from '@/types/knowledge-base';
import { Label, TextField } from '../forms';

interface SiteOption { id: string; name: string; webUrl?: string }
interface ListOption { id: string; name: string; template?: string }

type Patch = Partial<ChildProfile>;

/**
 * Search-and-pick setup for a child's SharePoint mapping. Replaces hand-pasting raw
 * Graph GUIDs — those IDs are long composite strings a parent has no way to obtain.
 */
export default function SharePointPicker({
  child,
  onChange,
}: {
  child: ChildProfile;
  onChange: (patch: Patch) => void;
}) {
  const [query, setQuery] = useState('');
  const [sites, setSites] = useState<SiteOption[] | null>(null);
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [busy, setBusy] = useState<'sites' | 'lists' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const siteId = child.microsoftSiteId ?? '';
  const siteLabel = child.microsoftSiteName || siteId;

  const request = useCallback(async (params: string): Promise<Record<string, unknown> | null> => {
    setError(null);
    try {
      const res = await fetch(`/api/school-feed/sharepoint?${params}`);
      const body = await res.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Request failed (${res.status})`);
        return null;
      }
      return body;
    } catch {
      setError('Could not reach SharePoint — check the Microsoft connection in Settings.');
      return null;
    }
  }, []);

  const searchSites = useCallback(async () => {
    setBusy('sites');
    const body = await request(`sites=${encodeURIComponent(query)}`);
    setSites((body?.sites as SiteOption[]) ?? []);
    setBusy(null);
  }, [query, request]);

  // Load the site's lists whenever a site is chosen, so the news list can be picked by name.
  useEffect(() => {
    if (!siteId) {
      setLists(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setBusy('lists');
      const body = await request(`siteId=${encodeURIComponent(siteId)}`);
      if (!cancelled) {
        setLists((body?.lists as ListOption[]) ?? []);
        setBusy(null);
      }
    })();
    return () => { cancelled = true; };
  }, [siteId, request]);

  const pickSite = (site: SiteOption) => {
    onChange({
      microsoftSiteId: site.id,
      microsoftSiteName: site.name,
      // The previous site's list no longer exists under the new site.
      microsoftNewsListId: undefined,
      microsoftNewsListName: undefined,
    });
    setSites(null);
    setQuery('');
  };

  const clearSite = () => {
    onChange({
      microsoftSiteId: undefined,
      microsoftSiteName: undefined,
      microsoftNewsListId: undefined,
      microsoftNewsListName: undefined,
      microsoftDocsPath: undefined,
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface-muted/40 p-2.5 space-y-2">
      <Label hint="Optional — connects this child's school SharePoint for news posts and timetable documents">
        SharePoint (optional)
      </Label>

      {!siteId ? (
        <>
          <div className="flex gap-2">
            <TextField value={query} onChange={setQuery} placeholder="Search your school's SharePoint sites" />
            <button
              type="button"
              onClick={searchSites}
              disabled={busy === 'sites'}
              className="btn-secondary shrink-0 text-xs px-3 py-1.5"
            >
              {busy === 'sites' ? 'Searching…' : 'Search'}
            </button>
          </div>
          {sites?.length === 0 && (
            <p className="text-[11px] text-foreground-subtle">
              No sites matched. Leave the search blank to list everything you have access to.
            </p>
          )}
          {sites && sites.length > 0 && (
            <ul className="space-y-1">
              {sites.map(site => (
                <li key={site.id}>
                  <button
                    type="button"
                    onClick={() => pickSite(site)}
                    className="w-full text-left rounded-md border border-border bg-surface px-2.5 py-1.5 hover:border-accent"
                  >
                    <span className="block text-xs font-medium text-foreground">{site.name}</span>
                    {site.webUrl && (
                      <span className="block text-[10px] text-foreground-subtle truncate">{site.webUrl}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground truncate">
              Site: <span className="font-medium">{siteLabel}</span>
            </span>
            <button type="button" onClick={clearSite} className="shrink-0 text-[11px] text-foreground-subtle hover:text-danger">
              Change
            </button>
          </div>

          <div>
            <Label>News list</Label>
            <select
              className="input-field-sm"
              value={child.microsoftNewsListId ?? ''}
              disabled={busy === 'lists'}
              onChange={e => {
                const picked = lists?.find(l => l.id === e.target.value);
                onChange({
                  microsoftNewsListId: picked?.id,
                  microsoftNewsListName: picked?.name,
                });
              }}
            >
              <option value="">{busy === 'lists' ? 'Loading lists…' : 'None — skip news'}</option>
              {lists?.map(list => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label hint="Folder inside the site's document library — leave blank to skip documents">
              Documents folder
            </Label>
            <TextField
              value={child.microsoftDocsPath ?? ''}
              onChange={v => onChange({ microsoftDocsPath: v })}
              placeholder="Shared Documents/Timetables"
            />
          </div>
        </>
      )}

      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
