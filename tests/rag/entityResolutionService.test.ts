import { describe, expect, it } from 'vitest';
import { EntityResolutionService } from '@/app/application/services/rag/EntityResolutionService';

describe('EntityResolutionService', () => {
  const svc = new EntityResolutionService();

  it('returns confidence 0 on explicit different manufacturer (hard KO)', () => {
    const anchor = { name: 'Cimsec S1 Flex', manufacturer: 'ACME Chemie GmbH' };
    const chunk = {
      text: 'Sicherheitsdatenblatt\nHersteller: Global Hazard AG\nProdukt: Cimsec S1 Flex',
      metadata: { semanticScore: 0.95 },
    };

    const r = svc.scoreCandidate(anchor, chunk);
    expect(r.confidence).toBe(0);
    expect(r.isMatch).toBe(false);
    expect(r.requiresReview).toBe(false);
    expect(r.matchReason).toContain('Hard-K.O.');
  });

  it('does not KO when explicit manufacturer matches anchor', () => {
    const anchor = { name: 'Cimsec S1 Flex', manufacturer: 'ACME Chemie GmbH' };
    const chunk = {
      text: 'Hersteller: ACME Chemie GmbH\nProduktbezeichnung: Cimsec S1 Flex Schnell',
      metadata: { semanticScore: 0.9 },
    };

    const r = svc.scoreCandidate(anchor, chunk);
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.isMatch).toBe(true);
  });

  it('marks borderline band for review (<= 0.95) and clears above', () => {
    const anchor = { name: 'AlphaBeta Gamma', manufacturer: '' };
    const borderlineChunk = {
      text: 'AlphaBeta Gamma technische Daten',
      metadata: { semanticScore: 0.55 },
    };
    const strongChunk = {
      text: 'AlphaBeta Gamma technische Daten gleicher Text',
      metadata: { semanticScore: 1 },
    };

    const borderline = svc.scoreCandidate(anchor, borderlineChunk);
    const strong = svc.scoreCandidate(anchor, strongChunk);

    expect(borderline.isMatch).toBe(true);
    expect(borderline.requiresReview).toBe(true);
    expect(borderline.confidence).toBeLessThanOrEqual(0.95);
    expect(strong.requiresReview).toBe(false);
    expect(strong.confidence).toBeGreaterThan(0.95);
  });

  it('skips manufacturer KO when manufacturer unknown', () => {
    const anchor = { name: 'X', manufacturer: '   ' };
    const chunk = {
      text: 'Hersteller: Andere GmbH',
      metadata: { semanticScore: 0.2 },
    };

    const r = svc.scoreCandidate(anchor, chunk);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
  });
});
