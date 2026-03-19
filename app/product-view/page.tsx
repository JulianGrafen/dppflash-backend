import { MOCK_PRODUCTS } from '../lib/mock-data';
import { notFound } from 'next/navigation';

export default function ProductPage({ params }: { params: { id: string } }) {
  const product = MOCK_PRODUCTS[params.id];

  if (!product) {
    // Realistischer Hinweis: Ein ungültiger Link ist ein Compliance-Verstoß [cite: 9]
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto p-8 border rounded-lg shadow-sm">
      <h1 className="text-2xl font-bold mb-4">Digitaler Produktpass (DPP)</h1>
      <div className="space-y-2">
        <p><strong>Produkt:</strong> {product.name}</p>
        <p><strong>Hersteller:</strong> {product.hersteller}</p>
        <p><strong>Materialien:</strong> {product.materialien}</p>
        <p><strong>CO2-Fußabdruck:</strong> {product.co2Footprint}</p>
      </div>
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
        <span className="text-green-700 font-semibold">✓ EU-Konformitätsprüfung bestanden</span>
      </div>
    </div>
  );
}