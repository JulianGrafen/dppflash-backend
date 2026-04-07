import { getProductById } from '../../lib/mock-data';
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import ProductHeader from '../components/ProductHeader';
import ProductFieldGroup from '../components/ProductFieldGroup';
import ProductWarnings from '../components/ProductWarnings';
import {
  formatValue,
  formatFieldName,
  getProductTypeInfo,
  groupFieldsByCategory,
  PRODUCT_TYPE_CONFIG,
} from '../components/ProductDisplay';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;

  console.log(`🔍 Suche Produkt mit ID: ${id}`);

  const product = getProductById(id) as any;

  if (!product) {
    console.error(`❌ Produkt nicht gefunden: ${id}`);
    return notFound();
  }

  console.log(`✅ Produkt gefunden: ${id}`);

  // Gruppiere Felder automatisch
  const grouped = groupFieldsByCategory(product);
  
  // Hol Produkttyp-Info
  const typeInfo = getProductTypeInfo(product.type);
  const IconComponent = typeInfo.icon;

  // Check für fehlende ESPR-Anforderungen
  const hasMissingESPR = grouped['ESPR-Anforderungen'].length === 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b px-4 py-6 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={14} /> EU-Konform Verifiziert
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Digitaler Produktpass</h1>
        <p className="text-gray-500 text-sm mt-1">ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{product.id}</code></p>
        <div className="mt-3 inline-flex items-center gap-2 text-lg font-bold text-blue-600">
          <IconComponent size={20} />
          {typeInfo.name}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {/* Warnungen */}
        {hasMissingESPR && (
          <ProductWarnings
            warnings={[
              {
                type: 'warning',
                message: 'Einige ESPR-Anforderungen sind nicht im PDF enthalten.',
              },
            ]}
          />
        )}

        {/* Dynamische Feldgruppen */}
        {Object.entries(grouped)
          .filter(([_, fields]) => fields.length > 0)
          .map(([sectionTitle, fields]) => (
            <ProductFieldGroup
              key={sectionTitle}
              title={sectionTitle}
              fields={fields}
              icon={<IconComponent size={18} />}
              isEmpty={fields.length === 0}
            />
          ))}
      </main>

      {/* Footer */}
      <footer className="mt-10 text-center text-gray-400 text-xs px-6">
        Garantierte Datenverfügbarkeit bis {new Date(product.createdAt).getFullYear() + 15} gemäß EU-Verordnung.
        <br />
        <span className="text-[10px] mt-2 block">Alle Daten 100% lokal verarbeitet (DSGVO-konform)</span>
      </footer>
    </div>
  );
}
