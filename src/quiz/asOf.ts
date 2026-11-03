/** `asOf` is `YYYY-MM`; the label is the month and year in the player's language, or null if it is not a valid month. */
export function asOfLabel(asOf: string, lang: 'es' | 'en'): string | null {
  // The same rule as the bank validator: month 01–12 only (Date.UTC would turn «2026-13» into January 2027).
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(asOf);
  if (!match) return null;
  const first = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
}
