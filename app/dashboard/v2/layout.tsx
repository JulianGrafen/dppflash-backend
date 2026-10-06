import { AuthGuard } from '@/app/dashboard/v2/components/AuthGuard';
import { V2Shell } from '@/app/dashboard/v2/components/V2Shell';
import { SessionProvider } from '@/app/dashboard/v2/context/SessionProvider';

export default function DashboardV2Layout({ children }: { readonly children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthGuard>
        <V2Shell>{children}</V2Shell>
      </AuthGuard>
    </SessionProvider>
  );
}
