  import { getProductById } from '../../lib/mock-data';

import { notFound } from 'next/navigation';
import { ShieldCheck, Factory, Calendar, Info, MapPin, Zap, Shirt } from 'lucide-react'; // Nutze Lucide für klare Icons

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) return notFound();

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header mit Branding & Status */}
      <header className="bg-white border-b px-4 py-6 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={14} /> EU-Konform Verifiziert
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Digitaler Produktpass</h1>
        <p className="text-gray-500 text-sm mt-1">ID: {product.id}</p>
      </header>

      <main className="max-w-lg mx-auto px-4 mt-6 space-y-4">
        
        {/* Sektion 1: Stammdaten (BaseDPP) */}
        <Card title="Allgemeine Informationen" icon={<Info size={18} />}>
          <DataRow icon={<Factory size={16} />} label="Hersteller" value={product.hersteller} />
          <DataRow icon={<Info size={16} />} label="Modell" value={product.modellname} />
          <DataRow icon={<Calendar size={16} />} label="Ausgestellt am" value={product.createdAt.toLocaleDateString('de-DE')} />
        </Card>

        {/* Sektion 2: Spezifische Daten (Futureproof Weiche) */}
        <Card 
          title={`Spezifikationen: ${product.type === 'BATTERY' ? 'Batterie' : 'Textil'}`} 
          icon={product.type === 'BATTERY' ? <Zap size={18} /> : <Shirt size={18} />}
          highlight
        >
          {product.type === 'BATTERY' && (
            <>
              <DataRow label="Nennkapazität" value={`${product.kapazitaetKWh} kWh`} />
              <DataRow label="Chemie" value={product.chemischesSystem} />
            </>
          )}

          {product.type === 'TEXTILE' && (
            <>
              <DataRow icon={<Info size={16} />} label="Zusammensetzung" value={product.materialZusammensetzung} />
              <DataRow icon={<MapPin size={16} />} label="Herkunftsland" value={product.herkunftsland} />
            </>
          )}
        </Card>

        {/* Sektion 3: Circular Economy (Dummy für Futureproof-Prinzip) */}
        <div className="p-4 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 text-sm">
          Recycling- & Entsorgungshinweise folgen (ESPR 2027)
        </div>

      </main>
      
      <footer className="mt-10 text-center text-gray-400 text-xs px-6">
        Garantierte Datenverfügbarkeit bis {product.createdAt.getFullYear() + 15} gemäß EU-Verordnung.
      </footer>
    </div>
  );
}

/* --- Hilfskomponenten für Clean Code & Lesbarkeit --- */

function Card({ title, children, icon, highlight = false }: any) {
  return (
    <section className={`bg-white rounded-2xl shadow-sm border ${highlight ? 'border-blue-100' : 'border-gray-100'} overflow-hidden`}>
      <div className={`px-4 py-3 border-b flex items-center gap-2 font-bold text-sm ${highlight ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'}`}>
        {icon} {title}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </section>
  );
}

function DataRow({ label, value, icon }: any) {
  return (
    <div className="flex items-start gap-3">
      {icon && <div className="mt-1 text-gray-400">{icon}</div>}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wide">{label}</span>
        <span className="text-gray-900 font-medium">{value}</span>
      </div>
    </div>
  );
}