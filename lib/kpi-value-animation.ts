export type ParsedKpiValue = {
  prefix: string;
  suffix: string;
  target: number;
  numTemplate: string;
};

export function parseKpiValue(value: string): ParsedKpiValue | null {
  const match = value.match(/^(.*?)([\d][\d.,]*)(.*)$/);
  if (!match) return null;

  const [, prefix, numTemplate, suffix] = match;
  const normalized = numTemplate.replace(/\./g, '').replace(',', '.');
  const target = Number.parseFloat(normalized);
  if (Number.isNaN(target)) return null;

  return { prefix, suffix, target, numTemplate };
}

function usesGermanGrouping(numTemplate: string, target: number) {
  return /^\d{1,3}(\.\d{3})+$/.test(numTemplate) || (target >= 1000 && numTemplate.includes('.'));
}

function decimalPlaces(numTemplate: string) {
  const fraction = numTemplate.split(',')[1];
  return fraction ? fraction.length : 0;
}

export function formatKpiAnimatedValue(parsed: ParsedKpiValue, current: number) {
  const { prefix, suffix, target, numTemplate } = parsed;
  const decimals = decimalPlaces(numTemplate);

  let num: string;
  if (decimals > 0) {
    num = current.toLocaleString('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } else if (usesGermanGrouping(numTemplate, target)) {
    num = Math.round(current).toLocaleString('de-DE');
  } else {
    num = String(Math.round(current));
  }

  return `${prefix}${num}${suffix}`;
}
