import { getProductById } from '../../lib/mock-data';
import { notFound } from 'next/navigation';
import { ShieldCheck, Zap, Shirt, Settings, Package, Droplet } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

// Formatierungs-Hilfsfunktionen
function formatValue(value: any): string {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
  if (value instanceof Date) return value.toLocaleDateString('de-DE');
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return value.toFixed(2);
    }
    return value.toString();
  }
  return String(value);
}

function getProductTypeName(type: string): string {
  const types: Record<string, string> = {
    BATTERY: '🔋 Batterie',
    TEXTILE: '👕 Textil',
    ELECTRONICS: '🖥️  Elektronik',
    FURNITURE: '🪑 Möbel',
    CHEMICAL: '⚗️  Chemikalien',
    OTHER: '📦 Produkt',
  };
  return types[type] || type;
}

function getIcon(type: string) {
  const icons: Record<string, any> = {
    BATTERY: <Zap size={18} />,
    TEXTILE: <Shirt size={18} />,
    ELECTRONICS: <Settings size={18} />,
    FURNITURE: <Package size={18} />,
    CHEMICAL: <Droplet size={18} />,
    OTHER: <Package size={18} />,
  };
  return icons[type] || <Package size={18} />;
}

function formatFieldName(key: string): string {
  // Konvertiere camelCase zu lesbarem Text
  const formatted = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
  
  // Spezielle Mappings
  const mappings: Record<string, string> = {
    'hersteller': 'Hersteller',
    'modellname': 'Modellname',
    'kapazitaetKWh': 'Kapazität (kWh)',
    'chemischesSystem': 'Chemisches System',
    'batterietyp': 'Batterietyp',
    'produktionsdatum': 'Produktionsdatum',
    'co2FussabdruckKgProKwh': 'CO₂-Fußabdruck (kg CO₂e/kWh)',
    'erwarteteLebensdauerLadezyklen': 'Erwartete Lebensdauer (Ladezyklen)',
    'reparierbarkeitsIndex': 'Reparierbarkeits-Index',
    'ersatzteileVerfuegbarkeitJahre': 'Ersatzteile-Verfügbarkeit (Jahre)',
    'recyclinganteilKobalt': 'Recyclinganteil Kobalt (%)',
    'recyclinganteilLithium': 'Recyclinganteil Lithium (%)',
    'recyclinganteilNickel': 'Recyclinganteil Nickel (%)',
    'recyclingAnweisungen': 'Recycling-Anweisungen',
    'materialZusammensetzung': 'Material-Zusammensetzung',
    'herkunftsland': 'Herkunftsland',
    'stromverbrauch': 'Stromverbrauch (Watt)',
    'energieeffizienzklasse': 'Energieeffizienzklasse',
  };
  
  return mappings[key] || formatted;
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

  // Filtere Felder, die angezeigt werden sollen
  const fieldsToShow = Object.entries(product)
    .filter(([key, value]) => {
      if (['__proto__', '_id', '_type'].includes(key)) return false;
      if (value === null || value === undefined || value === '') return false;
      return true;
    })
    .sort(([keyA], [keyB]) => {
      const priority = ['hersteller', 'modellname', 'type', 'createdAt'];
      const aIdx = priority.indexOf(keyA);
      const bIdx = priority.indexOf(keyB);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return keyA.localeCompare(keyB);
    });

  // Gruppiere Felder
  const baseFields = ['hersteller', 'modellname', 'createdAt', 'type'];
  const esprFields = ['co2', 'recycling', 'lebensdauer', 'reparierbarkeit', 'ersatzteile', 'entsorgung', 'hazard', 'gefahrstoff'];
  
  const grouped: Record<string, any[]> = {
    'Allgemeine Informationen': [],
    'Spezifikationen': [],
    'ESPR-Anforderungen': [],
    'Weitere Daten': [],
  };

  for (const [key, value] of fieldsToShow) {
    if (baseFields.includes(key)) {
      grouped['Allgemeine Informationen'].push([key, value]);
    } else if (esprFields.some(f => key.toLowerCase().includes(f))) {
      grouped['ESPR-Anforderungen'].push([key, value]);
    } else if (key === 'type') {
      // Skip, handled in header
    } else {
      grouped['Spezifikationen'].push([key, value]);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white border-b px-4 py-6 text-center shadow-sm">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
          <ShieldCheck size={14} /> EU-Konform Verifiziert
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Digitaler Produktpass</h1>
        <p className="text-gray-500 text-sm mt-1">ID: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{product.id}</code></p>
        <div className="mt-3 text-lg font-bold text-blue-600">{getProductTypeName(product.type)}</div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        
        {/* Dynamische Sektionen */}
        {Object.entries(grouped)
          .filter(([_, fields]) => fields.length > 0)
          .map(([sectionTitle, fields]) => (
            <div key={sectionTitle} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-blue-25 flex items-center gap-2 font-bold text-sm text-blue-700 border-blue-100">
                {getIcon(product.type)} {sectionTitle}
              </div>
              <div className="p-4 space-y-3">
                {fields.map(([fieldKey, fieldValue]) => (
                  <div key={fieldKey} className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                    <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wide flex-1">{formatFieldName(fieldKey)}</span>
                    <span className="text-gray-900 font-medium text-right flex-1 break-words ml-4">{formatValue(fieldValue)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {/* Warnung */}
        {grouped['ESPR-Anforderungen'].length === 0 && (
          <div className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-yellow-700 text-sm">
            <p className="font-bold">⚠️ Hinweis:</p>
            <p>Einige ESPR-Anforderungen sind nicht im PDF enthalten.</p>
          </div>
        )}

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
