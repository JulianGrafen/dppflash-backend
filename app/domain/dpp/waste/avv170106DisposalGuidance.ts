export type Avv170106DisposalSection = {
  readonly title: string;
  readonly body: string;
};

export const AVV_170106_DISPOSAL_SECTIONS: readonly Avv170106DisposalSection[] = [
  {
    title: 'Abfallerzeugnis',
    body:
      'Gemische aus oder getrennte Fraktionen von Beton, Ziegeln, Fliesen und Keramik, die gefährliche Stoffe enthalten (Einstufung: Gefährlicher Abfall).',
  },
  {
    title: 'Rückbau & Baustellen-Handling',
    body:
      'Staubentwicklung beim Stemmen oder Fräsen zwingend minimieren (Absaugung/Wassernebel nutzen). Material ist beim Rückbau vom übrigen, unbelasteten Bauschutt strikt getrennt zu erfassen, um Vermischungsverbote einzuhalten.',
  },
  {
    title: 'Verwertbarkeit & Deponierung',
    body:
      'Aufgrund der gefahrstoffrelevanten Bindemittelanteile (Portlandzement/Kaminstaub) ist eine direkte Wiederverwertung als RC-Baustoff (Recycling-Schotter) ohne vorherige Prüfung ausgeschlossen. Zuweisung zu einer lizenzierten Deponie der Klasse I oder II erforderlich.',
  },
  {
    title: 'Logistischer Hinweis für Entsorger',
    body:
      'Transport und Überwachung unterliegen der elektronischen Nachweisverordnung (eANV). Übernahmeschein- und Begleitscheinpflicht.',
  },
] as const;

export const AVV_170106_DETAIL_CARD_TITLE =
  'Spezifische Entsorgungs- und Rückbaurichtlinien (AVV 170106)';

/** **Digit-only** comparison so `170106`, `17 01 06` and `17 01 06*` all match. */
export function isAvvCode170106(code: string | undefined): boolean {
  if (!code?.trim()) {
    return false;
  }

  const digits = code.replace(/\D/g, '');
  return digits === '170106';
}

export function shouldShowAvv170106DisposalDetail(
  wasteCode: string | undefined,
  ewcCode: string | undefined,
): boolean {
  return isAvvCode170106(wasteCode) || isAvvCode170106(ewcCode);
}
