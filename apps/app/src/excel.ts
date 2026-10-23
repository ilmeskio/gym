// Turns the first sheet of an Excel file into a grid to draw:
// only the area holding text, with widths, fill colours and horizontally merged cells.

import { read, utils, type WorkSheet } from 'xlsx';

export type Cell = { text: string; fill?: string; width: number };

export type Grid = { name: string; rows: Cell[][] };

const PIXELS_PER_CHAR = 7;
const DEFAULT_WIDTH = 64;

export function readExcel(data: ArrayBuffer): Grid {
  const book = read(data, { cellStyles: true });
  const name = book.SheetNames[0];
  return { name, rows: grid(book.Sheets[name]) };
}

function grid(sheet: WorkSheet): Cell[][] {
  // The useful area is the one with text: the sheet declares rows and columns far beyond it.
  let lastRow = 0;
  let lastColumn = 0;
  let firstRow = Infinity;
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!') || sheet[address].w === undefined || String(sheet[address].v).trim() === '') continue;
    const { r, c } = utils.decode_cell(address);
    lastRow = Math.max(lastRow, r);
    lastColumn = Math.max(lastColumn, c);
    firstRow = Math.min(firstRow, r);
  }
  if (firstRow === Infinity) return [];

  const widths = Array.from({ length: lastColumn + 1 }, (_, c) => {
    const wch = sheet['!cols']?.[c]?.wch;
    return wch ? Math.round(wch * PIXELS_PER_CHAR) : DEFAULT_WIDTH;
  });

  // Horizontally merged cells: the first takes the width of all of them, the others disappear.
  const merged = new Map<string, number>();
  const covered = new Set<string>();
  for (const m of sheet['!merges'] ?? []) {
    const end = Math.min(m.e.c, lastColumn);
    merged.set(`${m.s.r}:${m.s.c}`, end);
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= end; c++) if (c !== m.s.c) covered.add(`${r}:${c}`);
    }
  }

  const rows: Cell[][] = [];
  let emptyBefore = false;
  for (let r = firstRow; r <= lastRow; r++) {
    const row: Cell[] = [];
    let hasText = false;
    for (let c = 0; c <= lastColumn; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const cell = sheet[utils.encode_cell({ r, c })];
      const text = cell?.w?.trim() ?? '';
      if (text) hasText = true;
      const end = merged.get(`${r}:${c}`) ?? c;
      const width = widths.slice(c, end + 1).reduce((a, b) => a + b, 0);
      const colour = cell?.s?.fgColor?.rgb as string | undefined;
      row.push({ text, width, ...(colour && { fill: `#${colour.slice(-6)}` }) });
    }
    // Consecutive empty rows become one: in the sheet they separate the days.
    if (!hasText && emptyBefore) continue;
    emptyBefore = !hasText;
    rows.push(row);
  }
  return rows;
}
