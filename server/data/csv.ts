// RFC 4180 CSV parsing that remembers byte offsets, so a writer can splice
// single fields back into the original text and leave everything else intact.

export interface CsvField {
  value: string;
  start: number; // offset of the raw field text (including quotes) in the source
  end: number;   // exclusive
  quoted: boolean;
}

export interface CsvRecord {
  fields: CsvField[];
  start: number;      // offset of the first field
  end: number;        // offset just past the last field (before the line terminator)
  eol: string;        // "\r\n", "\n", "\r" or "" (last line without terminator)
}

/** Parse CSV text. A leading BOM is skipped (offsets still index the original text). */
export function parseCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const n = text.length;
  while (i < n) {
    const recStart = i;
    const fields: CsvField[] = [];
    let eol = "";
    for (;;) {
      const fStart = i;
      let value = "";
      let quoted = false;
      if (text[i] === '"') {
        quoted = true;
        i++;
        for (;;) {
          if (i >= n) break; // unterminated quote: take the rest
          const c = text[i];
          if (c === '"') {
            if (text[i + 1] === '"') { value += '"'; i += 2; continue; }
            i++;
            break;
          }
          value += c;
          i++;
        }
        // Tolerate junk after a closing quote (e.g. `"a"b`) by appending it.
        while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") value += text[i++];
      } else {
        while (i < n && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") value += text[i++];
      }
      fields.push({ value, start: fStart, end: i, quoted });
      if (i < n && text[i] === ",") { i++; continue; }
      break;
    }
    const recEnd = i;
    if (text[i] === "\r" && text[i + 1] === "\n") { eol = "\r\n"; i += 2; }
    else if (text[i] === "\n" || text[i] === "\r") { eol = text[i]; i += 1; }
    // Skip fully blank lines.
    if (!(fields.length === 1 && fields[0].value === "" && !fields[0].quoted)) {
      records.push({ fields, start: recStart, end: recEnd, eol });
    }
  }
  return records;
}

/** Serialize one field, quoting only when RFC 4180 requires it. */
export function formatField(value: string): string {
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

export interface Splice { start: number; end: number; text: string }

/** Apply non-overlapping splices to text. */
export function applySplices(text: string, splices: Splice[]): string {
  const sorted = [...splices].sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of sorted) out = out.slice(0, s.start) + s.text + out.slice(s.end);
  return out;
}
