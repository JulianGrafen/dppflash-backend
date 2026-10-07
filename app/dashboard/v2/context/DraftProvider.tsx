'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createEmptyDraft, applyExtractionToDraft } from '@/app/dashboard/v2/mock/batteryWizardFixture';
import { computeCompleteness } from '@/app/dashboard/v2/mock/completeness';
import { computePassportCompleteness } from '@/app/dashboard/v2/mock/passportCompleteness';
import { PASSPORT_FIELD_DEFINITIONS } from '@/app/domain/battery/passportFieldCatalog';
import {
  fieldSupportsLocalization,
  passportFieldHasValue,
} from '@/app/dashboard/v2/mock/passportFieldLocalization';
import {
  ensurePassportFieldsOnDraft,
  resolveDraftPublishPassId,
} from '@/app/dashboard/v2/mock/passportFields';
import { resolvePassportFieldSource } from '@/app/dashboard/v2/mock/passportFieldSource';
import { loadDraft, upsertDraft } from '@/app/dashboard/v2/mock/storage';
import type { DraftField, DraftPassport, PassportFieldValueState } from '@/app/dashboard/v2/mock/types';

type DraftContextValue = {
  draft: DraftPassport | null;
  summary: ReturnType<typeof computeCompleteness>;
  passportSummary: ReturnType<typeof computePassportCompleteness>;
  load: (id: string) => void;
  replace: (draft: DraftPassport) => void;
  updateField: (path: string, patch: Partial<DraftField>) => void;
  updatePassportField: (key: string, value: string, locale?: 'de' | 'en') => void;
  confirmPassportField: (key: string) => void;
  confirmField: (path: string) => void;
  markSupplierPending: (path: string) => void;
  publish: () => Promise<{ publicUrl: string } | null>;
  syncPreview: () => Promise<string | null>;
};

const DraftContext = createContext<DraftContextValue | null>(null);

function persist(draft: DraftPassport): DraftPassport {
  const passportFields = ensurePassportFieldsOnDraft(draft);
  const updated = {
    ...draft,
    passportFields,
    updatedAt: new Date().toISOString(),
  };
  upsertDraft(updated);
  return updated;
}

export function DraftProvider({
  draftId,
  children,
}: {
  readonly draftId: string;
  readonly children: ReactNode;
}) {
  const [draft, setDraft] = useState<DraftPassport | null>(null);

  const load = useCallback((id: string) => {
    const existing = loadDraft(id);
    if (existing) {
      setDraft(persist(existing));
      return;
    }
    const created = persist(createEmptyDraft(id, 'upload'));
    setDraft(created);
  }, []);

  useEffect(() => {
    load(draftId);
  }, [draftId, load]);

  const replace = useCallback((next: DraftPassport) => {
    setDraft(persist(next));
  }, []);

  const updateField = useCallback((path: string, patch: Partial<DraftField>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const fields = current.fields.map((f) =>
        f.path === path ? { ...f, ...patch, provenance: patch.provenance ?? f.provenance } : f,
      );
      return persist({ ...current, fields });
    });
  }, []);

  const updatePassportField = useCallback((key: string, value: string, locale?: 'de' | 'en') => {
    setDraft((current) => {
      if (!current) {
        return current;
      }
      const passportFields = { ...ensurePassportFieldsOnDraft(current) };
      const prev = passportFields[key];
      if (!prev) {
        return current;
      }
      const def = PASSPORT_FIELD_DEFINITIONS.find((d) => d.key === key);
      let nextState = { ...prev };
      if (locale === 'de') {
        nextState = { ...nextState, valueDe: value, value };
      } else if (locale === 'en') {
        nextState = { ...nextState, valueEn: value };
      } else {
        nextState = { ...nextState, value };
      }

      const hasValue =
        def && fieldSupportsLocalization(def)
          ? passportFieldHasValue(nextState, def)
          : Boolean(value.trim());

      const provenance = hasValue ? 'ai' : 'empty';
      nextState = {
        ...nextState,
        provenance: provenance as typeof prev.provenance,
        confidence: hasValue ? 0.75 : 0,
      };
      passportFields[key] = {
        ...nextState,
        source: resolvePassportFieldSource(key, nextState),
      };
      return persist({ ...current, passportFields });
    });
  }, []);

  const confirmPassportField = useCallback((key: string) => {
    setDraft((current) => {
      if (!current?.passportFields?.[key]) {
        return current;
      }
      const passportFields = { ...current.passportFields };
      passportFields[key] = {
        ...passportFields[key],
        provenance: 'confirmed',
        confidence: 1,
      };
      return persist({ ...current, passportFields });
    });
  }, []);

  const confirmField = useCallback((path: string) => {
    updateField(path, { provenance: 'confirmed', confidence: 1 });
  }, [updateField]);

  const markSupplierPending = useCallback((path: string) => {
    updateField(path, {
      provenance: 'pending_supplier',
      supplierSentAt: new Date().toISOString(),
    });
  }, [updateField]);

  const pushPassportToServer = useCallback(async (): Promise<{ publicUrl: string; passId: string } | null> => {
    if (!draft?.passportFields) {
      return null;
    }
    const passId = resolveDraftPublishPassId(draft);
    const res = await fetch('/api/dashboard/v2/passport-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passportFields: draft.passportFields,
        productName: draft.productName,
        passId,
      }),
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { publicUrl?: string; passId?: string };
    const publishedId = data.passId ?? passId;
    const publicUrl =
      data.publicUrl ??
      (typeof window !== 'undefined' ? `${window.location.origin}/p/${publishedId}` : `/p/${publishedId}`);
    return { publicUrl, passId: publishedId };
  }, [draft]);

  const syncPreview = useCallback(async (): Promise<string | null> => {
    const result = await pushPassportToServer();
    return result?.publicUrl ?? null;
  }, [pushPassportToServer]);

  const publish = useCallback(async () => {
    const result = await pushPassportToServer();
    if (!result) {
      return null;
    }
    setDraft((current) => {
      if (!current) {
        return current;
      }
      return persist({
        ...current,
        status: 'published',
        publishedPassId: result.passId,
        publishedUrl: result.publicUrl,
        visitedSteps: [...new Set([...current.visitedSteps, 'publish'])],
      });
    });
    return { publicUrl: result.publicUrl };
  }, [pushPassportToServer]);

  const summary = computeCompleteness(draft?.fields ?? []);
  const passportSummary = computePassportCompleteness(draft?.passportFields ?? {});

  const value = useMemo(
    () => ({
      draft,
      summary,
      passportSummary,
      load,
      replace,
      updateField,
      updatePassportField,
      confirmPassportField,
      confirmField,
      markSupplierPending,
      publish,
      syncPreview,
    }),
    [
      draft,
      summary,
      passportSummary,
      load,
      replace,
      updateField,
      updatePassportField,
      confirmPassportField,
      confirmField,
      markSupplierPending,
      publish,
      syncPreview,
    ],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftContextValue {
  const ctx = useContext(DraftContext);
  if (!ctx) {
    throw new Error('useDraft must be used within DraftProvider');
  }
  return ctx;
}

export function createDraftId(): string {
  return `draft_${Date.now().toString(36)}`;
}

export function seedDraftForMethod(
  id: string,
  method: DraftPassport['creationMethod'],
): DraftPassport {
  let draft = createEmptyDraft(id, method);
  if (method === 'import' || method === 'manual' || method === 'existing') {
    draft = applyExtractionToDraft(draft);
  }
  upsertDraft(persist(draft));
  return draft;
}
