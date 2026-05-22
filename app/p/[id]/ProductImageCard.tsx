'use client';

import Image from 'next/image';
import { Package } from 'lucide-react';
import { useState } from 'react';

type ProductImageCardProps = {
  readonly imageUrl: string | null;
  readonly productName: string;
};

export function ProductImageCard({ imageUrl, productName }: ProductImageCardProps) {
  const [imgError, setImgError] = useState(false);
  const canShowImage = Boolean(imageUrl) && !imgError;

  return (
    <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white p-2 shadow-sm md:h-40 md:w-40">
      {canShowImage ? (
        <Image
          src={imageUrl!}
          alt={`Produktbild ${productName}`}
          width={160}
          height={160}
          className="h-full w-full object-contain"
          sizes="(min-width: 768px) 160px, 128px"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-slate-50 px-3 text-center text-slate-500">
          <Package className="h-8 w-8 text-slate-300" strokeWidth={1.6} aria-hidden />
          <p className="mt-2 text-[10px] font-medium leading-snug">
            Kein Bild hinterlegt
            <span className="block text-[9px] text-slate-400">(PIM-Abgleich ausstehend)</span>
          </p>
        </div>
      )}
    </div>
  );
}
