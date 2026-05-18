import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import {
  titleFromFileName,
  type ComplianceSourceDocument,
} from '@/app/domain/rag/sourceDocuments';
import { supabase, STORAGE_BUCKETS } from '@/app/lib/supabase';

const BUCKET = STORAGE_BUCKETS.COMPLIANCE_DOCUMENTS;

function sanitizeStorageFileName(fileName: string): string {
  const base = basename(fileName).slice(0, 200) || 'document.pdf';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export type UploadComplianceDocumentInput = {
  readonly productId: string;
  readonly fileName: string;
  readonly pdf: Buffer;
  readonly titleHint?: string;
  readonly documentType: string;
};

export type UploadComplianceDocumentResult = {
  readonly ok: true;
  readonly document: ComplianceSourceDocument;
  readonly storagePath: string;
} | {
  readonly ok: false;
  readonly error: string;
};

/**
 * Lädt ein Compliance-PDF in Supabase Storage (öffentlicher Bucket).
 * Fehler werden geloggt; Aufrufer kann Ingestion trotzdem fortsetzen.
 */
export async function uploadComplianceDocumentToStorage(
  input: UploadComplianceDocumentInput,
): Promise<UploadComplianceDocumentResult> {
  if (!supabase) {
    const msg = 'Supabase nicht konfiguriert — Storage-Upload übersprungen';
    console.warn('[DPP] compliance_storage_skip', msg);
    return { ok: false, error: msg };
  }

  const safeName = sanitizeStorageFileName(input.fileName);
  const storagePath = `${input.productId}/${randomUUID()}-${safeName}`;

  try {
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.pdf, {
      contentType: 'application/pdf',
      upsert: false,
    });

    if (uploadError) {
      console.error('[DPP] compliance_storage_upload_failed', {
        productId: input.productId,
        storagePath,
        message: uploadError.message,
      });
      return { ok: false, error: uploadError.message };
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl?.trim();
    if (!publicUrl) {
      const msg = 'getPublicUrl lieferte keine URL';
      console.error('[DPP] compliance_storage_public_url_missing', { storagePath });
      return { ok: false, error: msg };
    }

    const title = input.titleHint?.trim() || titleFromFileName(safeName);
    const document: ComplianceSourceDocument = {
      title,
      url: publicUrl,
      type: input.documentType,
    };

    console.info('[DPP] compliance_storage_upload_ok', {
      productId: input.productId,
      storagePath,
      type: document.type,
    });

    return { ok: true, document, storagePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[DPP] compliance_storage_upload_exception', {
      productId: input.productId,
      message,
    });
    return { ok: false, error: message };
  }
}
