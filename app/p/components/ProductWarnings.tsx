'use client';

/**
 * Komponente: ProductWarnings
 * Zeigt Warnungen und Hinweise zum Produkt
 */

import { AlertCircle, Info, CheckCircle } from 'lucide-react';

interface Warning {
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
}

interface ProductWarningsProps {
  warnings: Warning[];
}

export default function ProductWarnings({ warnings }: ProductWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning, idx) => {
        const styles = {
          warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
          error: 'bg-red-50 border-red-200 text-red-700',
          info: 'bg-blue-50 border-blue-200 text-blue-700',
          success: 'bg-green-50 border-green-200 text-green-700',
        };

        const icons = {
          warning: <AlertCircle size={16} />,
          error: <AlertCircle size={16} />,
          info: <Info size={16} />,
          success: <CheckCircle size={16} />,
        };

        return (
          <div
            key={idx}
            className={`p-4 border-2 rounded-xl flex items-start gap-3 ${styles[warning.type]}`}
          >
            <span className="flex-shrink-0 mt-0.5">{icons[warning.type]}</span>
            <p className="text-sm">{warning.message}</p>
          </div>
        );
      })}
    </div>
  );
}
