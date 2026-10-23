// Converts the trainer's Excel plan into the JSON a plan is made of, ready to hand to the
// MCP `create_plan` tool (after adding the demonstrations with `find_exercise_media`).
// Usage: pnpm import-plan <path to the .xlsx file> <output .json>
//
// Expected layout (one sheet): each day starts with a row holding the title in column B,
// followed by the weeks row and the headers row; then one exercise per row
// up to the first empty row. Week 1 in D-H, weeks 2-7 in blocks of 5 columns from K.

import { writeFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import type { Day, Exercise, Plan, Prescription } from '../src/index.ts';

const WEEK_BLOCKS = ['D', 'K', 'Q', 'W', 'AC', 'AI', 'AO'];
const FIELDS: (keyof Prescription)[] = ['load', 'setsReps', 'rest', 'tut', 'rir'];

const [path, target] = process.argv.slice(2);
if (!path || !target) {
  console.error('Usage: pnpm import-plan <file.xlsx> <output.json>');
  process.exit(1);
}

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(path);
const sheet = workbook.worksheets[0];

const column = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);

function text(row: number, col: string | number): string | undefined {
  const value = sheet.getCell(row, typeof col === 'string' ? column(col) : col).value;
  if (value === null || value === undefined) return undefined;
  const s = String(
    typeof value === 'object' && 'richText' in value ? value.richText.map((r) => r.text).join('') : value,
  ).trim();
  return s || undefined;
}

// In the sheet a rest written as a number (2, 1) is in minutes.
function rest(row: number, col: number): string | undefined {
  const value = sheet.getCell(row, col).value;
  return typeof value === 'number' ? `${value}'` : text(row, col);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function readDay(titleRow: number): Day | undefined {
  const title = text(titleRow, 'B')!;
  const exercises: Exercise[] = [];
  for (let r = titleRow + 3; text(r, 'C'); r++) {
    const name = text(r, 'C')!;
    const weeks = WEEK_BLOCKS.map((start) => {
      const entry: Prescription = {};
      FIELDS.forEach((field, i) => {
        const col = column(start) + i;
        const value = field === 'rest' ? rest(r, col) : text(r, col);
        if (value) entry[field] = value;
      });
      return entry;
    });
    exercises.push({
      id: slug(name),
      name,
      ...(text(r, 'A') && { videoToSend: text(r, 'A') }),
      ...(text(r, 'B') && { notes: text(r, 'B') }),
      ...(text(r, 'I') && { compensation: text(r, 'I') }),
      weeks,
    });
  }
  if (exercises.length === 0) return undefined;
  const letter = /^GIORNO\s+([A-Z])\b/i.exec(title)?.[1];
  return { id: letter ?? slug(title), title, exercises };
}

const days: Day[] = [];
for (let r = 1; r <= sheet.rowCount; r++) {
  if (text(r, 'B') && text(r + 1, 'A')?.startsWith('SETTIMANA')) {
    const day = readDay(r);
    if (day) days.push(day);
  }
}

// The sheet name is the start date, formatted d-m-yy.
const [d, m, y] = sheet.name.split('-').map(Number);
const plan: Plan = {
  title: `Scheda del ${sheet.name}`,
  startDate: `20${String(y).padStart(2, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  weekCount: WEEK_BLOCKS.length,
  days,
};

writeFileSync(target, JSON.stringify(plan, null, 2) + '\n');
console.log(`${days.length} days, ${days.reduce((n, day) => n + day.exercises.length, 0)} exercises → ${target}`);
