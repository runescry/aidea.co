import { syncSchoolInbox, type SchoolInboxSyncResult } from '@/lib/harness/school-inbox-sync';
import { syncSchoolCalendar, type SchoolCalendarSyncResult } from '@/lib/harness/school-calendar-sync';

export interface SchoolFeedSyncResult {
  inbox: SchoolInboxSyncResult;
  calendar: SchoolCalendarSyncResult;
}

/** Run Gmail then calendar sequentially so KB writes do not clobber each other. */
export async function syncSchoolFeed(): Promise<SchoolFeedSyncResult> {
  const inbox = await syncSchoolInbox();
  const calendar = await syncSchoolCalendar();
  return { inbox, calendar };
}
