'use client';

import { useRouter } from 'next/navigation';
import { OnboardingStepper } from '@/app/dashboard/v2/components/OnboardingStepper';
import { V2BrandLogo } from '@/app/dashboard/v2/components/V2BrandLogo';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { createGlobalCatalogSeedDraft } from '@/app/dashboard/v2/mock/ingest/createGlobalCatalogSeedDraft';
import { AiSyncMergeStep } from './AiSyncMergeStep';
import { BulkMagicLinkDialog } from './BulkMagicLinkDialog';
import { ComplianceInboxStep } from './ComplianceInboxStep';
import { GlobalCatalogStep } from './GlobalCatalogStep';
import { inboxEmailForDomain } from './globalCatalogMock';
import { CompanyMasterDataStep } from './CompanyMasterDataStep';
import { toIntegrationsPatch } from './companyMasterData';
import { IntegrationsStep } from './IntegrationsStep';
import { useGlobalOnboardingFlow } from './useGlobalOnboardingFlow';

export function DataIngestOnboarding() {
  const router = useRouter();
  const { session, updateSession } = useSession();
  const flow = useGlobalOnboardingFlow({
    companyDomain: session?.companyDomain ?? 'yourcompany',
    integrations: session?.integrations,
  });

  const inboxEmail = inboxEmailForDomain(session?.companyDomain ?? 'yourcompany');

  function finishToDashboard() {
    const tenantId = session?.tenantId ?? 'tenant_demo';
    const draft = createGlobalCatalogSeedDraft(tenantId);
    updateSession({
      onboarding: {
        completedAt: new Date().toISOString(),
        folderIngested: true,
        pimConfigured: true,
        sapConnected: Boolean(flow.connected.xentral || flow.connected.akeneo),
      },
      integrations: {
        onboardingDraftId: draft.id,
        ...toIntegrationsPatch(flow.companyMasterData),
      },
    });
    router.push('/dashboard/v2');
  }

  return (
    <div className="min-h-screen bg-[#eef1f6] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <V2BrandLogo href="/dashboard/v2/onboarding" onDarkBackground priority />
          <p className="text-center text-sm text-slate-600 sm:text-right">
            Global Data Onboarding &amp; PIM Integration · Demo
          </p>
        </div>

        <OnboardingStepper currentStep={flow.step} />

        {flow.step === 0 && (
          <CompanyMasterDataStep
            companyDomain={session?.companyDomain ?? 'yourcompany'}
            data={flow.companyMasterData}
            onChange={flow.setCompanyMasterData}
            onNext={() => {
              updateSession({ integrations: toIntegrationsPatch(flow.companyMasterData) });
              flow.goNext();
            }}
          />
        )}

        {flow.step === 1 && (
          <IntegrationsStep
            connected={flow.connected}
            onConnect={flow.connectIntegration}
            onBack={flow.goBack}
            onNext={flow.goNext}
          />
        )}

        {flow.step === 2 && (
          <ComplianceInboxStep
            inboxEmail={inboxEmail}
            files={flow.inboxFiles}
            onFiles={flow.setInboxFiles}
            onBack={flow.goBack}
            onStartSync={flow.startGlobalSync}
          />
        )}

        {flow.step === 3 && <AiSyncMergeStep progress={flow.syncProgress} />}

        {flow.step === 4 && (
          <GlobalCatalogStep
            bulkRequestSent={flow.bulkRequestSent}
            onTriggerMagicLinks={flow.openBulkMagic}
            onGoToDashboard={finishToDashboard}
          />
        )}

        <BulkMagicLinkDialog
          open={flow.bulkMagicOpen}
          onClose={flow.closeBulkMagic}
          onSend={flow.sendBulkMagic}
        />
      </div>
    </div>
  );
}
