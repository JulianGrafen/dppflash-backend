'use client';

/**
 * Komponente: ProductHeader
 * Zeigt die Kopfzeile des Produktpasses mit Identifikation und Typ
 */

import { ShieldCheck } from 'lucide-react';

interface ProductHeaderProps {
  productId: string;
  productType: string;
  productTypeIcon: React.ReactNode;
  productTypeName: string;
}

export default function ProductHeader({
  productId,
  productType,
  productTypeIcon,
  productTypeName,
}: ProductHeaderProps) {
  return (
    <header className="bg-white border-b px-4 py-6 text-center shadow-sm">
      <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
        <ShieldCheck size={14} /> EU-Konform Verifiziert
      </div>
      
      <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
        Digitaler Produktpass
      </h1>
      
      <p className="text-gray-500 text-sm mt-1">
        ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{productId}</code>
      </p>
      
      <div className="mt-4 flex items-center justify-center gap-2 text-lg font-bold text-blue-600">
        {productTypeIcon}
        <span>{productTypeName}</span>
      </div>
    </header>
  );
}
