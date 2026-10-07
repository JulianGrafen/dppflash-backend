import Link from 'next/link';
import {
  DPPFLASH_MARKETING_ORIGIN,
  dppflashLegalLabels,
  dppflashLegalUrls,
  type DppflashLegalSlug,
} from '@/app/dashboard/v2/lib/dppflashLegal';
import { cn } from 'cn';

const ORDER: DppflashLegalSlug[] = ['impressum', 'datenschutz', 'agb'];

const linkClass =
  'underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm';

type DppflashLegalLinksProps = {
  readonly className?: string;
  readonly showMarketingHome?: boolean;
};

export function DppflashLegalLinks({
  className,
  showMarketingHome = false,
}: DppflashLegalLinksProps) {
  return (
    <p className={cn('text-muted-foreground', className)}>
      {showMarketingHome ? (
        <>
          <Link
            href={DPPFLASH_MARKETING_ORIGIN}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            dppflash.de
          </Link>
          {' · '}
        </>
      ) : null}
      {ORDER.map((slug, index) => (
        <span key={slug}>
          {index > 0 ? ' · ' : null}
          <Link href={dppflashLegalUrls[slug]} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {dppflashLegalLabels[slug]}
          </Link>
        </span>
      ))}
    </p>
  );
}
