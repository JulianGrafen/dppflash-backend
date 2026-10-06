'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IntegrationId } from './globalCatalogMock';

export type GlobalOnboardingStep = 0 | 1 | 2 | 3;

const SYNC_DURATION_MS = 4500;
const SYNC_STAGGER_MS = 400;

type SyncProgress = { pim: number; llm: number; merge: number };

export function useGlobalOnboardingFlow() {
  const [step, setStep] = useState<GlobalOnboardingStep>(0);
  const [connected, setConnected] = useState<Partial<Record<IntegrationId, boolean>>>({});
  const [inboxFiles, setInboxFiles] = useState<File[]>([]);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ pim: 0, llm: 0, merge: 0 });
  const [syncRunning, setSyncRunning] = useState(false);
  const [bulkMagicOpen, setBulkMagicOpen] = useState(false);
  const [bulkRequestSent, setBulkRequestSent] = useState(false);

  const hasConnection = Object.values(connected).some(Boolean);

  const connectIntegration = useCallback((id: IntegrationId) => {
    setConnected((prev) => ({ ...prev, [id]: true }));
  }, []);

  const startGlobalSync = useCallback(() => {
    setStep(2);
    setSyncRunning(true);
    setSyncProgress({ pim: 0, llm: 0, merge: 0 });
  }, []);

  useEffect(() => {
    if (step !== 2 || !syncRunning) {
      return;
    }

    const start = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - start;
      setSyncProgress({
        pim: Math.min(100, Math.round((elapsed / SYNC_DURATION_MS) * 100)),
        llm: Math.min(100, Math.round(((elapsed - SYNC_STAGGER_MS) / SYNC_DURATION_MS) * 100)),
        merge: Math.min(100, Math.round(((elapsed - SYNC_STAGGER_MS * 2) / SYNC_DURATION_MS) * 100)),
      });

      if (elapsed >= SYNC_DURATION_MS + SYNC_STAGGER_MS * 2) {
        window.clearInterval(tick);
        setSyncProgress({ pim: 100, llm: 100, merge: 100 });
        setSyncRunning(false);
        setStep(3);
      }
    }, 80);

    return () => window.clearInterval(tick);
  }, [step, syncRunning]);

  const openBulkMagic = useCallback(() => setBulkMagicOpen(true), []);
  const closeBulkMagic = useCallback(() => setBulkMagicOpen(false), []);
  const sendBulkMagic = useCallback(() => {
    setBulkRequestSent(true);
    setBulkMagicOpen(false);
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => Math.min(3, s + 1) as GlobalOnboardingStep);
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1) as GlobalOnboardingStep);
  }, []);

  return {
    step,
    connected,
    hasConnection,
    inboxFiles,
    setInboxFiles,
    syncProgress,
    syncRunning,
    bulkMagicOpen,
    bulkRequestSent,
    connectIntegration,
    startGlobalSync,
    openBulkMagic,
    closeBulkMagic,
    sendBulkMagic,
    goNext,
    goBack,
  };
}
