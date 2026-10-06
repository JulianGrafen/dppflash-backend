export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
