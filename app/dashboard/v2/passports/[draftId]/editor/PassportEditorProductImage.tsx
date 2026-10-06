'use client';

import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { getSampleDppPass } from '@/app/_data/sample-dpp.data';
import { VOLTSTRIDE_720_ID } from '@/app/fixtures/voltstride720PublicPassport';
import { cn } from 'cn';

type PassportEditorProductImageProps = {
  readonly passId: string;
  readonly productName: string;
  readonly className?: string;
};

export function PassportEditorProductImage({
  passId,
  productName,
  className,
}: PassportEditorProductImageProps) {
  const [imgError, setImgError] = useState(false);
  const sample = getSampleDppPass(passId);
  const imageUrl = sample?.imageUrl ?? (passId === VOLTSTRIDE_720_ID ? '/images/voltstride-720-hero.png' : null);
  const imageAlt = sample?.imageAlt ?? `Produktbild ${productName}`;
  const showImage = Boolean(imageUrl) && !imgError;

  return (
    <section
      aria-label="Produktbild"
      className={cn(
        'relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50 shadow-sm sm:h-24 sm:w-24',
        className,
      )}
    >
      {showImage ? (
        <Image
          src={imageUrl!}
          alt={imageAlt}
          fill
          className="object-contain object-center p-1.5"
          sizes="96px"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex flex-col items-center gap-1 px-2 text-center text-slate-400">
          <ImageIcon className="h-6 w-6" aria-hidden />
          <span className="text-[9px] font-medium leading-tight">Kein Bild</span>
        </div>
      )}
    </section>
  );
}
