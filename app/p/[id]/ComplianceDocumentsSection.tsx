import { FileText, Download } from 'lucide-react';
import {
  parseComplianceSourceDocuments,
  type ComplianceSourceDocument,
} from '@/app/domain/rag/sourceDocuments';

function documentTypeLabel(type: string): string {
  switch (type) {
    case 'safety_data_sheet':
      return 'Sicherheitsdatenblatt';
    case 'technical_brief':
      return 'Technisches Merkblatt';
    case 'compliance_pdf':
      return 'Compliance-Dokument';
    default:
      return type;
  }
}

export function ComplianceDocumentsSection({ attachments }: { readonly attachments: unknown }) {
  const fromAttachments = parseComplianceSourceDocuments(attachments);
  const docs: ComplianceSourceDocument[] = fromAttachments;

  if (docs.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_28px_-6px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04]">
      <div className="flex items-center gap-3 bg-[#0c1929] px-5 py-4 text-white">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <FileText className="h-5 w-5 text-sky-300" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight">Zugehörige Compliance-Dokumente</h2>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            SDB · Merkblätter · PDF
          </p>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {docs.map((doc) => (
          <li key={doc.url}>
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-4 text-[13px] font-semibold text-[#0c1929] transition hover:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-red-100">
                <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{doc.title}</span>
                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                  {documentTypeLabel(doc.type)}
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
