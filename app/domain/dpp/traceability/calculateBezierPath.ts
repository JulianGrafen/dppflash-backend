export type BezierPathOptions = {
  readonly bendRatio?: number;
};

/**
 * **Wiederverwendbare Kubik-Bezier-Hilfsfunktion** für horizontale Materialfluss-Pfade.
 */
export function calculateBezierPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options?: BezierPathOptions,
): string {
  const bendRatio = options?.bendRatio ?? 0.45;
  const bend = (endX - startX) * bendRatio;
  const controlStartX = startX + bend;
  const controlEndX = endX - bend;
  return `M ${startX} ${startY} C ${controlStartX} ${startY}, ${controlEndX} ${endY}, ${endX} ${endY}`;
}

/**
 * Geschlossenes Band zwischen zwei parallelen Bezier-Kurven (Sankey-ähnliche Flussbreite).
 */
export function calculateFlowRibbonPath(
  startX: number,
  startY0: number,
  startY1: number,
  endX: number,
  endY0: number,
  endY1: number,
  options?: BezierPathOptions,
): string {
  const bendRatio = options?.bendRatio ?? 0.45;
  const bend = (endX - startX) * bendRatio;
  const controlStartX = startX + bend;
  const controlEndX = endX - bend;

  return [
    `M ${startX} ${startY0}`,
    `C ${controlStartX} ${startY0}, ${controlEndX} ${endY0}, ${endX} ${endY0}`,
    `L ${endX} ${endY1}`,
    `C ${controlEndX} ${endY1}, ${controlStartX} ${startY1}, ${startX} ${startY1}`,
    'Z',
  ].join(' ');
}
