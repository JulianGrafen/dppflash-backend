import Image from 'next/image';
import Link from 'next/link';

import { PassLangChips } from '@/components/dpp/pass-lang-chips';
import { PassHeroStatusRow } from '@/components/dpp/pass-hero-status';
import { cn } from 'cn';

const heroPill =
  'inline-flex items-center rounded-full border border-white/20 bg-slate-900/40 px-2.5 py-1 shadow-sm backdrop-blur-md';

export function PassHero({
  title,
  category,
  passUuid,
  imageUrl,
  imageAlt,
  capacity,
  batteryStatusPercent,
  batteryStatusNote,
}: {
  title: string;
  category: string;
  passUuid: string;
  imageUrl: string;
  imageAlt: string;
  capacity: string;
  batteryStatusPercent: number;
  batteryStatusNote?: string;
}) {
  return (
    <div className="relative aspect-[4/3] w-full bg-slate-100 sm:aspect-[16/10]">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        className="object-contain object-center p-4 sm:p-6"
        sizes="100vw"
        priority
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/25 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 p-4" role="group" aria-label="Pass-Kennung">
        <div
          className={cn(
            heroPill,
            'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5',
          )}
        >
          <Link
            href="/"
            className="shrink-0 transition-opacity hover:opacity-90"
            aria-label="DPP-Flash"
          >
            <Image
              src="/assets/logo-dpp-flash.png"
              alt=""
              width={120}
              height={36}
              className="h-6 w-auto max-w-[6.5rem] object-contain sm:h-7 sm:max-w-[7.5rem]"
              priority
            />
          </Link>
          <span className="h-5 w-px shrink-0 bg-white/25" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-[0.6rem] font-bold uppercase tracking-wide text-white/75">
              ID
            </span>
            <span className="truncate font-mono text-[0.65rem] leading-none text-white/95 sm:text-xs">
              {passUuid}
            </span>
          </div>
          <PassLangChips />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-2 p-5 text-white">
        <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-md">{title}</h1>
        <PassHeroStatusRow
          category={category}
          capacity={capacity}
          percent={batteryStatusPercent}
          note={batteryStatusNote}
        />
      </div>
    </div>
  );
}
