/** `asOf` is `YYYY-MM`; the label is the month and year in the player's language, or null if it is not a valid month. */
export function asOfLabel(asOf: string, lang: 'es' | 'en'): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(asOf);
  if (!match) return null;
  const first = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  if (Number.isNaN(first.getTime())) return null;
  return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
}
