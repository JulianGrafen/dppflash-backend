'use client';

/**
 * Komponente: ProductFieldGroup
 * Zeigt eine Gruppe von Produktfeldern in organisierter Form
 */

interface FieldRowProps {
  label: string;
  value: string;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex items-start justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase font-bold text-gray-500 tracking-wide flex-1 max-w-xs">
        {label}
      </span>
      <span className="text-gray-900 font-medium text-right flex-1 break-words ml-4">
        {value}
      </span>
    </div>
  );
}

interface ProductFieldGroupProps {
  title: string;
  fields: Array<[string, string]>;
  icon?: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export default function ProductFieldGroup({
  title,
  fields,
  icon,
  isEmpty = false,
  emptyMessage = 'Keine Daten verfügbar',
}: ProductFieldGroupProps) {
  if (isEmpty && fields.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-blue-25 flex items-center gap-2 font-bold text-sm text-blue-700 border-blue-100">
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{title}</span>
      </div>

      <div className="p-4">
        {fields.length > 0 ? (
          <div className="space-y-3">
            {fields.map(([label, value]) => (
              <FieldRow key={label} label={label} value={value} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}
