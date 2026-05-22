import { describe, expect, it } from 'vitest';
import { calculateBezierPath, calculateFlowRibbonPath } from '@/app/domain/dpp/traceability/calculateBezierPath';
import { computeTraceabilityTieredLayout } from '@/app/domain/dpp/traceability/computeTraceabilityTieredLayout';
import {
  buildTraceabilityTieredFlowModel,
  resolveProcessingNodeId,
  TRACEABILITY_PROCESSING_ASIA,
  TRACEABILITY_PROCESSING_EU,
} from '@/app/domain/dpp/traceability/traceabilityTieredFlowModel';

const HENKEL_LIKE_MATERIALS = [
  { material: 'Quarz (SiO2), <1% einatembar', percentage: 50 },
  { material: 'Zement, Portland-, Chemikalien', percentage: 30 },
  { material: 'Kalkhaltiges Sedimentgestein mit freiem Siliciumdioxid', percentage: 7.5 },
  { material: 'Kaminstaub, Portlandzement', percentage: 3 },
  { material: 'Nicht deklarationspflichtige Stoffe', percentage: 9.5 },
];

describe('calculateBezierPath', () => {
  it('returns a cubic bezier SVG path command', () => {
    const path = calculateBezierPath(10, 20, 300, 120);
    expect(path.startsWith('M 10 20 C')).toBe(true);
    expect(path.endsWith('300 120')).toBe(true);
  });
});

describe('calculateFlowRibbonPath', () => {
  it('returns a closed ribbon path', () => {
    const path = calculateFlowRibbonPath(10, 20, 40, 300, 80, 110);
    expect(path.startsWith('M 10 20')).toBe(true);
    expect(path.trim().endsWith('Z')).toBe(true);
  });
});

describe('resolveProcessingNodeId', () => {
  it('routes quartz and filler to Asia and cement-like materials to EU', () => {
    expect(resolveProcessingNodeId('Quarz (SiO2)')).toBe(TRACEABILITY_PROCESSING_ASIA.id);
    expect(resolveProcessingNodeId('Nicht deklarationspflichtige Stoffe')).toBe(
      TRACEABILITY_PROCESSING_ASIA.id,
    );
    expect(resolveProcessingNodeId('Zement, Portland')).toBe(TRACEABILITY_PROCESSING_EU.id);
    expect(resolveProcessingNodeId('Kaminstaub, Portlandzement')).toBe(TRACEABILITY_PROCESSING_EU.id);
  });
});

describe('buildTraceabilityTieredFlowModel', () => {
  it('builds 3-tier nodes and links for five ingredients', () => {
    const model = buildTraceabilityTieredFlowModel({
      materials: HENKEL_LIKE_MATERIALS,
      productLabel: 'Cimsec Fliesen Kleber S1 Flex',
    });
    expect(model).not.toBeNull();
    expect(model!.nodes.filter((n) => n.tier === 1)).toHaveLength(5);
    expect(model!.nodes.filter((n) => n.tier === 2)).toHaveLength(2);
    expect(model!.nodes.some((n) => n.label === 'Cimsec Fliesen Kleber S1 Flex')).toBe(true);

    const totalLinks = model!.links.reduce((sum, link) => sum + link.value, 0);
    expect(totalLinks).toBeCloseTo(200, 5);
  });
});

describe('computeTraceabilityTieredLayout', () => {
  it('preserves mass balance height across tiers', () => {
    const model = buildTraceabilityTieredFlowModel({
      materials: HENKEL_LIKE_MATERIALS,
      productLabel: 'Cimsec Fliesen Kleber S1 Flex',
    });
    expect(model).not.toBeNull();

    const layout = computeTraceabilityTieredLayout(model!);
    const stackGap = (count: number) => Math.max(0, count - 1) * 8;
    const tier1Nodes = layout.nodes.filter((n) => n.tier === 1);
    const tier2Nodes = layout.nodes.filter((n) => n.tier === 2);
    const tier1Stack = tier1Nodes.reduce((sum, n) => sum + n.rect.height, 0) + stackGap(tier1Nodes.length);
    const tier2Stack = tier2Nodes.reduce((sum, n) => sum + n.rect.height, 0) + stackGap(tier2Nodes.length);
    const productHeight = layout.nodes.find((n) => n.tier === 3)?.rect.height ?? 0;

    expect(Math.max(tier1Stack, tier2Stack)).toBeCloseTo(layout.stackHeight, 0);
    expect(productHeight).toBeCloseTo(layout.stackHeight, 0);
    expect(layout.flows.length).toBe(model!.links.length);
    expect(layout.nodes.every((node) => node.rect.height >= 32)).toBe(true);
  });
});
