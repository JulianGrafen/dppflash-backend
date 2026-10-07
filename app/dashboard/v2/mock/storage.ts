import { tenantIdFromDomain } from '@/app/dashboard/v2/lib/tenantId';
import { createDemoReady100Draft, DEMO_READY_100_DRAFT_ID } from './demoReady100Passport';
import type { DraftField, DraftPassport } from './types';

const DRAFTS_KEY = 'dppflash_v2_drafts';
const SESSION_KEY = 'dppflash_v2_session';

export type V2OnboardingState = {
  completedAt?: string;
  sapConnected?: boolean;
  pimConfigured?: boolean;
  folderIngested?: boolean;
};

export type V2IntegrationsState = {
  sapHost?: string;
  pimWebhookSecret?: string;
  companyName?: string;
  industry?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  vatId?: string;
  onboardingDraftId?: string;
};

export type V2Session = {
  email: string;
  companyDomain: string;
  tenantId: string;
  createdAt: string;
  onboarding: V2OnboardingState;
  integrations: V2IntegrationsState;
};

function defaultOnboarding(): V2OnboardingState {
  return {};
}

function defaultIntegrations(): V2IntegrationsState {
  return {};
}

export function normalizeSession(raw: Partial<V2Session> & Pick<V2Session, 'email' | 'companyDomain'>): V2Session {
  const domain = raw.companyDomain;
  return {
    email: raw.email,
    companyDomain: domain,
    tenantId: raw.tenantId ?? tenantIdFromDomain(domain),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    onboarding: { ...defaultOnboarding(), ...raw.onboarding },
    integrations: { ...defaultIntegrations(), ...raw.integrations },
  };
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadSession(): V2Session | null {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<V2Session> & { email: string; companyDomain: string };
    if (!parsed.email || !parsed.companyDomain) {
      return null;
    }
    return normalizeSession(parsed);
  } catch {
    return null;
  }
}

export function saveSession(session: V2Session): void {
  if (!canUseStorage()) {
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (!canUseStorage()) {
    return;
  }
  localStorage.removeItem(SESSION_KEY);
}

function ensureBuiltinDemoDrafts(drafts: DraftPassport[]): DraftPassport[] {
  if (drafts.some((d) => d.id === DEMO_READY_100_DRAFT_ID)) {
    return drafts;
  }
  const demo = createDemoReady100Draft();
  const next = [demo, ...drafts];
  saveAllDrafts(next);
  return next;
}

export function loadAllDrafts(): DraftPassport[] {
  if (!canUseStorage()) {
    return [];
  }
  let drafts: DraftPassport[] = [];
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DraftPassport[];
      drafts = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    drafts = [];
  }
  return ensureBuiltinDemoDrafts(drafts);
}

export function saveAllDrafts(drafts: DraftPassport[]): void {
  if (!canUseStorage()) {
    return;
  }
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function loadDraft(id: string): DraftPassport | null {
  return loadAllDrafts().find((d) => d.id === id) ?? null;
}

export function upsertDraft(draft: DraftPassport): void {
  const drafts = loadAllDrafts().filter((d) => d.id !== draft.id);
  drafts.unshift(draft);
  saveAllDrafts(drafts);
}

/** Legt den 100 %-Demo-Entwurf in `dppflash_v2_drafts` ab (Browser). */
export function seedDemoReady100Draft(): DraftPassport {
  const draft = createDemoReady100Draft();
  upsertDraft(draft);
  return draft;
}

export function deleteDraft(id: string): void {
  saveAllDrafts(loadAllDrafts().filter((d) => d.id !== id));
}

export function patchDraftField(
  draftId: string,
  fieldPath: string,
  patch: Partial<DraftField>,
): DraftPassport | null {
  const draft = loadDraft(draftId);
  if (!draft) {
    return null;
  }
  const fields = draft.fields.map((f) => (f.path === fieldPath ? { ...f, ...patch } : f));
  const updated: DraftPassport = {
    ...draft,
    fields,
    updatedAt: new Date().toISOString(),
  };
  upsertDraft(updated);
  return updated;
}
