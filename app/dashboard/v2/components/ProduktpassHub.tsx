'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PassportDraftList } from '@/app/dashboard/v2/components/PassportDraftList';
import { ProdukteDraftPanel } from '@/app/dashboard/v2/components/ProdukteDraftPanel';
import { ReadinessDraftPanel } from '@/app/dashboard/v2/components/ReadinessDraftPanel';
import { LieferantenInboxPanel } from '@/app/dashboard/v2/components/LieferantenInboxPanel';
import type { ProduktpassHubTab } from '@/app/dashboard/v2/lib/v2Breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_VALUES: ProduktpassHubTab[] = ['paesse', 'produkte', 'readiness', 'lieferanten'];

function parseTab(raw: string | null): ProduktpassHubTab {
  if (raw && TAB_VALUES.includes(raw as ProduktpassHubTab)) {
    return raw as ProduktpassHubTab;
  }
  return 'paesse';
}

export function ProduktpassHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  function onTabChange(value: string) {
    const next = parseTab(value);
    const href = next === 'paesse' ? '/dashboard/v2/produktpaesse' : `/dashboard/v2/produktpaesse?tab=${next}`;
    router.replace(href, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onTabChange} className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
        <TabsTrigger value="paesse" className="cursor-pointer">Produktpässe</TabsTrigger>
        <TabsTrigger value="produkte" className="cursor-pointer">Produkte</TabsTrigger>
        <TabsTrigger value="readiness" className="cursor-pointer">Vollständigkeit</TabsTrigger>
        <TabsTrigger value="lieferanten" className="cursor-pointer">Lieferanten</TabsTrigger>
      </TabsList>
      <TabsContent value="paesse" className="mt-0">
        <PassportDraftList showPublished newPassCta />
      </TabsContent>
      <TabsContent value="produkte" className="mt-0">
        <ProdukteDraftPanel />
      </TabsContent>
      <TabsContent value="readiness" className="mt-0">
        <ReadinessDraftPanel />
      </TabsContent>
      <TabsContent value="lieferanten" className="mt-0">
        <LieferantenInboxPanel />
      </TabsContent>
    </Tabs>
  );
}
