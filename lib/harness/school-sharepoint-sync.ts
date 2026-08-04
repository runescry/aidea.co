import { readAllKB, writeKB } from '@/lib/harness/knowledge-base';
import { loadSchoolProfiles } from '@/lib/harness/school-config';
import type { KnowledgeBase, SchoolFeed } from '@/types/knowledge-base';
import { listDriveDocuments, listSiteNewsItems } from '@/lib/nango/sharepoint';

export interface SchoolSharePointSyncResult {
  ok: boolean;
  newsCount: number;
  documentCount: number;
  error?: string;
}

export async function syncSchoolSharePoint(): Promise<SchoolSharePointSyncResult> {
  const kb = await readAllKB() as KnowledgeBase;
  const profiles = loadSchoolProfiles(kb).filter(
    p => p.microsoftSiteId && (p.microsoftNewsListId || p.microsoftDocsPath),
  );

  if (profiles.length === 0) {
    return { ok: true, newsCount: 0, documentCount: 0, error: 'No SharePoint mapping configured on children' };
  }

  try {
    const allNews: NonNullable<SchoolFeed['sharepoint']>['news'] = [];
    const allDocs: NonNullable<SchoolFeed['sharepoint']>['documents'] = [];

    for (const profile of profiles) {
      if (profile.microsoftSiteId && profile.microsoftNewsListId) {
        const news = await listSiteNewsItems({
          siteId: profile.microsoftSiteId,
          listId: profile.microsoftNewsListId,
        });
        allNews.push(...news);
      }
      if (profile.microsoftSiteId && profile.microsoftDocsPath) {
        const docs = await listDriveDocuments({
          siteId: profile.microsoftSiteId,
          folderPath: profile.microsoftDocsPath,
          child: profile.child,
        });
        allDocs.push(...docs);
      }
    }

    const existing = kb.family?.schoolFeed;
    const feed: SchoolFeed = {
      updatedAt: new Date().toISOString(),
      gmail: existing?.gmail ?? { roundups: [], actionRequired: [], fyi: [] },
      sharepoint: { news: allNews, documents: allDocs },
    };

    await writeKB('family.schoolFeed', feed);

    return { ok: true, newsCount: allNews.length, documentCount: allDocs.length };
  } catch (err) {
    return {
      ok: false,
      newsCount: 0,
      documentCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
