import Link from 'next/link';
import QRCodeDisplay from '@/app/components/QRCodeDisplay';
import { DEMO_BATTERY_PUBLIC_ID } from '@/app/fixtures/demoBatteryPublicPassport';

export default function ProductPortal() {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-lg bg-white p-6 shadow-md">
      <h1 className="mb-4 text-2xl font-bold">Produkt-Portal</h1>
      <p className="text-gray-600">
        Verwenden Sie einen QR-Code oder einen Link mit der Produkt-ID, um den digitalen Produktpass zu
        sehen.
      </p>
      <p className="mt-4 text-sm text-gray-500">Beispiel: /p/123</p>

      <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Batterie-Demo (öffentlich)</h2>
        <p className="mt-2 text-sm text-slate-600">
          Vollständiger Batterie-Pass im Showcase-Layout; Traceability nur ESPR Tier-1 (Rohstoffe).
        </p>
        <Link
          href={`/p/${DEMO_BATTERY_PUBLIC_ID}`}
          className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
        >
          Pass öffnen: /p/{DEMO_BATTERY_PUBLIC_ID}
        </Link>
        <div className="mt-4">
          <QRCodeDisplay
            productId={DEMO_BATTERY_PUBLIC_ID}
            productName="PowerCell Pro NMC 5.2 kWh Modul"
            gtin="4260123456789"
          />
        </div>
      </section>
    </div>
  );
}
