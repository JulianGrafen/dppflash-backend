"use client";

import { useState } from 'react';
import { DPPFactory } from '../../services/dppFormService';
import { ProductPassport } from '../../types/dpp-types';

export default function DppCreator() {
  const [step, setStep] = useState<'select' | 'form' | 'result'>('select');
  const [dpp, setDpp] = useState<ProductPassport | null>(null);

  const startCreation = (type: ProductPassport['type']) => {
    setDpp(DPPFactory.createEmptyPassport(type));
    setStep('form');
  };

  const handleSave = async () => {
    if (dpp && DPPFactory.isValid(dpp)) {
      // Hier erfolgt der API-Call zum Speichern
      setStep('result');
    }
  };

  if (step === 'select') {
    return (
      <div className="flex gap-4">
        <button onClick={() => startCreation('BATTERY')} className="p-4 border rounded hover:bg-blue-50">
          🔋 Batterie-Pass (2026)
        </button>
        <button onClick={() => startCreation('TEXTILE')} className="p-4 border rounded hover:bg-blue-50">
          👕 Textil-Pass (2027)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Daten für {dpp?.type} erfassen</h2>
      {/* Dynamische Input-Felder basierend auf dpp.type */}
      <input 
        placeholder="Hersteller" 
        value={dpp?.hersteller} 
        onChange={e => setDpp(prev => prev ? {...prev, hersteller: e.target.value} : null)}
        className="w-full p-2 border rounded"
      />
      {/* Weitere Felder hier... */}
      <button 
        onClick={handleSave}
        className="bg-green-600 text-white px-4 py-2 rounded"
      >
        DPP finalisieren & QR-Code generieren
      </button>
    </div>
  );
}