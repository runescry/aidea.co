import { readSchoolFeed } from '@/lib/harness/school-feed-read';
import HarnessDashboard from '@/components/harness/HarnessDashboard';

/** Dynamic server segment — streams school feed into the client dashboard (PPR Suspense hole). */
export default async function HarnessDashboardWithFeed() {
  const initialSchoolFeed = await readSchoolFeed();
  return <HarnessDashboard initialSchoolFeed={initialSchoolFeed} />;
}
