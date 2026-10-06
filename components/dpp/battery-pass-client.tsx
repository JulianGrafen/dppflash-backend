'use client';

import Link from 'next/link';

import { PassHero } from '@/components/dpp/pass-hero';
import { PassInteractiveBody } from '@/components/dpp/pass-interactive-body';
import { PassIssuerFooter } from '@/components/dpp/pass-issuer-footer';
import { usePassLocale } from '@/components/dpp/pass-locale-context';
import { passTokens } from '@/components/dpp/pass-tokens';
import { cn } from 'cn';

export function BatteryPassClient() {
  const { pass, ui } = usePassLocale();

  return (
    <div className={cn('dpp-pass min-h-dvh', passTokens.page)}>
      <div className={cn('min-h-dvh', passTokens.surface)}>
        <PassHero
          title={pass.title}
          category={pass.category}
          passUuid={pass.passUuid}
          imageUrl={pass.imageUrl}
          imageAlt={pass.imageAlt}
          capacity={pass.capacity}
          batteryStatusPercent={pass.batteryStatusPercent}
          batteryStatusNote={pass.batteryStatusNote}
        />
        <PassInteractiveBody pass={pass} />
      </div>

      <footer className={cn(passTokens.px, 'py-5 text-center text-[0.75rem] leading-relaxed', passTokens.textMuted)}>
        <p className={cn('text-[0.72rem] font-semibold uppercase tracking-wide', passTokens.textAccent)}>
          {ui.footerEuTitle}
        </p>
        <PassIssuerFooter dataAsOf={pass.dataAsOf} regulationNote={ui.issuerNote} dataAsOfPrefix={ui.dataAsOfPrefix} />
        <p className="mt-3">
          {ui.footerHosted}{' '}
          <Link href="/" className={cn('font-bold no-underline hover:underline', passTokens.textLink)}>
            DPP-Flash
          </Link>
          {' · '}
          <Link
            href="/experience.html"
            className={cn('font-bold no-underline hover:underline', passTokens.textLink)}
          >
            {ui.footerSandbox}
          </Link>
        </p>
      </footer>
    </div>
  );
}
