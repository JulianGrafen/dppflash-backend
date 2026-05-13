export function tokenizeForRetrieval(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .filter((t) => t.length > 1);
}
