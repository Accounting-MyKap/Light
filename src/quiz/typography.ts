const NARROW_NO_BREAK_SPACE = ' ';

/**
 * The banks write numbers the Spanish way, «120 000» and «19 %», with ordinary spaces that let a line break split
 * them. At render time those spaces become narrow no-break spaces, so a number never wraps across two lines.
 */
export function keepNumbersTogether(text: string): string {
  return text
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NARROW_NO_BREAK_SPACE}`)
    .replace(/(\d) %/g, `$1${NARROW_NO_BREAK_SPACE}%`);
}
