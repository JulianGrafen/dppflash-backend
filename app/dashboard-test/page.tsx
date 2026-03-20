'use client';

import { useState } from 'react';

export default function DashboardTest() {
  const [counter, setCounter] = useState(0);
  const [text, setText] = useState('Hallo');
  const [showResult, setShowResult] = useState(false);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">🧪 Dashboard Test</h1>

      {/* Test 1: Simple Button */}
      <div className="bg-white p-6 rounded-lg border mb-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">Test 1: Einfacher Button</h2>
        <button
          type="button"
          onClick={() => setCounter(counter + 1)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium cursor-pointer"
        >
          Klick mich (gezählt: {counter})
        </button>
      </div>

      {/* Test 2: Input Feld */}
      <div className="bg-white p-6 rounded-lg border mb-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">Test 2: Input-Feld</h2>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3"
          placeholder="Tippe hier..."
        />
        <p className="text-gray-600">Du hast getippt: <strong>{text}</strong></p>
      </div>

      {/* Test 3: Conditional Rendering */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-xl font-bold mb-4">Test 3: Toggle</h2>
        <button
          type="button"
          onClick={() => setShowResult(!showResult)}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium cursor-pointer"
        >
          {showResult ? 'Verstecken' : 'Anzeigen'}
        </button>
        {showResult && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <p>✅ Conditional Rendering funktioniert!</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-700">
          ℹ️ Wenn alle Tests funktionieren, ist React/JavaScript okay.
          <br />
          Dann ist das Problem wahrscheinlich in der komplexeren Dashboard-Komponente.
        </p>
      </div>
    </div>
  );
}
