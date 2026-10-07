import { V2SectionShell } from '@/app/dashboard/v2/components/V2SectionShell';
import { AnalyticsMockDashboard } from './AnalyticsMockDashboard';

export default function AnalyticsPage() {
  return (
    <V2SectionShell title="Analytics">
      <AnalyticsMockDashboard />
    </V2SectionShell>
  );
}
