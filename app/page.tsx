import { Suspense } from 'react';
import HarnessDashboard from '@/components/harness/HarnessDashboard';
import HarnessDashboardWithFeed from '@/components/harness/HarnessDashboardWithFeed';

export default function Home() {
  return (
    <Suspense
      fallback={(
        <HarnessDashboard initialSchoolFeed={null} homeFeedPending />
      )}
    >
      <HarnessDashboardWithFeed />
    </Suspense>
  );
}
