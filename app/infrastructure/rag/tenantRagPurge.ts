import { supabase, STORAGE_BUCKETS } from '@/app/lib/supabase';

const STORAGE_LIST_PAGE = 500;
const STORAGE_REMOVE_BATCH = 100;

export interface PurgeTenantRagAssetsOptions {
  readonly tenantId: string;
  /**
   * Hybrid-Index (`rag_chunks` bzw. In-Memory) für diesen Mandanten leeren.
   * @default true
   */
  readonly deleteRagChunks?: boolean;
  /**
   * Objekte unter `tenants/{tenantId}/` im Bucket `pdf-uploads` löschen.
   * @default false (bewusst opt-in, destruktiv)
   */
  readonly deletePdfUploadObjects?: boolean;
  /**
   * Wenn gesetzt: nur Storage-Objekte mit `created_at` **strictly before** diesem Zeitpunkt.
   * Ohne Datum: alle Dateien unter dem Tenant-Prefix.
   */
  readonly pdfUploadsCreatedBefore?: Date;
}

export interface PurgeTenantRagAssetsResult {
  readonly ragChunksDeleted: number;
  readonly pdfStorageObjectsDeleted: number;
}

function assertTenantPrefixSafe(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('tenantId is required.');
  }
  if (tenantId.includes('..') || tenantId.includes('/') || tenantId.includes('\\')) {
    throw new Error('Invalid tenantId for storage prefix.');
  }
}

/**
 * Löscht alle Objekte unter `pdf-uploads/tenants/{tenantId}/` (optional nur „älter als“).
 */
export async function deleteTenantPdfUploadsFromStorage(
  tenantId: string,
  createdBefore?: Date,
): Promise<number> {
  const id = tenantId.trim();
  assertTenantPrefixSafe(id);

  if (!supabase) {
    return 0;
  }

  const folder = `tenants/${id}`;
  const pathsToDelete: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.PDF_UPLOADS).list(folder, {
      limit: STORAGE_LIST_PAGE,
      offset,
      sortBy: { column: 'created_at', order: 'asc' },
    });

    if (error) {
      throw new Error(`Storage list failed (${folder}): ${error.message}`);
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      if (!row.name) {
        continue;
      }
      const fullPath = `${folder}/${row.name}`;
      if (createdBefore) {
        const created = row.created_at ? new Date(row.created_at) : null;
        if (!created || created >= createdBefore) {
          continue;
        }
      }
      pathsToDelete.push(fullPath);
    }

    if (rows.length < STORAGE_LIST_PAGE) {
      break;
    }
    offset += STORAGE_LIST_PAGE;
  }

  let deleted = 0;
  for (let i = 0; i < pathsToDelete.length; i += STORAGE_REMOVE_BATCH) {
    const batch = pathsToDelete.slice(i, i + STORAGE_REMOVE_BATCH);
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.PDF_UPLOADS).remove(batch);
    if (error) {
      throw new Error(`Storage remove failed: ${error.message}`);
    }
    deleted += batch.length;
  }

  return deleted;
}
