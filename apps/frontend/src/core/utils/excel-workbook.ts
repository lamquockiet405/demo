import type { Workbook, CellValue } from 'exceljs';

export interface ExcelColumn {
  header: string;
  width?: number;
  type?: 'text' | 'number' | 'date';
  format?: string;
}
export interface ExcelSheet {
  name?: string;
  title?: string;
  rows: unknown[][];
  columns?: ExcelColumn[];
  translateHeaders?: boolean;
}
export interface ExcelReport {
  title: string;
  subtitle?: string;
  sheets: ExcelSheet[];
  school: { name: string; address?: string; phone?: string; email?: string; color?: string };
  logo?: { base64: string; width: number; height: number };
  createdAt?: Date;
}

export function studentHeaderRow(rows: unknown[][]) {
  return rows.findIndex(row => row.some(value => /họ\s*(và\s*)?tên|full.?name/i.test(String(value))) && row.some(value => /ngày sinh|birth|\bdob\b/i.test(String(value))));
}

export function excelFilename(filename: string) {
  return filename.replace(/\.(csv|json|pdf|xls|xlsx)$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') + '.xlsx';
}

export function uniqueSheetName(value: string, existing: Set<string>) {
  const clean = value.replace(/[\\/?*\[\]:]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Báo cáo';
  let name = clean.slice(0, 31), index = 2;
  while (existing.has(name.toLowerCase())) {
    const suffix = ` (${index++})`;
    name = clean.slice(0, 31 - suffix.length) + suffix;
  }
  existing.add(name.toLowerCase());
  return name;
}

function cellValue(value: unknown, column: ExcelColumn): CellValue {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = Array.isArray(value) ? value.join('\n') : String(value);
  if (column.type === 'text') return text;
  if ((column.type === 'date' || /ngày|date/i.test(column.header)) && /^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(text + 'T00:00:00Z');
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text) return date;
  }
  // Codes, phone numbers and identifiers must retain their leading zeroes.
  if (!/mã|code|phone|thoại|sđt|\bid\b/i.test(column.header) &&
      (column.type === 'number' || /số|suất|tuổi|tháng|kg|\(g\)|cm|kcal|protein|lipid|carb|waz|haz|baz|bmi|nhiệt độ|rating|stt|%|tiền/i.test(column.header)) &&
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) && Number.isSafeInteger(Number(text.split('.')[0]))) return Number(text);
  // Assign plain strings, never formula objects, even when a value begins with '='.
  return text.slice(0, 32767);
}

export async function buildExcelWorkbook(report: ExcelReport): Promise<Workbook> {
  const ExcelJS = await import('exceljs');
  const workbook = new (ExcelJS.default?.Workbook || ExcelJS.Workbook)();
  const created = report.createdAt || new Date();
  workbook.creator = report.school.name;
  workbook.created = created;
  workbook.modified = created;
  workbook.title = report.title;
  const names = new Set<string>();
  const accent = 'FF' + (report.school.color || '0F766E').replace(/^#/, '').slice(-6);
  const imageId = report.logo ? workbook.addImage({ base64: report.logo.base64, extension: 'png' }) : undefined;

  for (const definition of report.sheets) {
    const headers: ExcelColumn[] =
      definition.columns ||
      (definition.rows[0] || []).map((header): ExcelColumn => ({
        header: String(header ?? ""),
      }));
    const rows = definition.columns ? definition.rows : definition.rows.slice(1);
    if (rows.length > 1048567) throw new Error('Báo cáo vượt quá số dòng tối đa của Excel. Hãy thu hẹp bộ lọc.');
    const lastColumn = Math.max(5, headers.length);
    const sheet = workbook.addWorksheet(uniqueSheetName(definition.name || definition.title || report.title, names), {
      properties: { defaultRowHeight: 22, tabColor: { argb: accent } },
      views: [{ showGridLines: false, state: 'frozen', ySplit: 9 }],
      pageSetup: { paperSize: 9, orientation: headers.length > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 }, printTitlesRow: '1:9' },
      headerFooter: { oddFooter: '&L' + report.school.name.replace(/&/g, '&&') + '&RTrang &P / &N' },
    });
    headers.forEach((column, index) => {
      const contents = rows.slice(0, 250).map(row => String(row[index] ?? '').split('\n').reduce((max, part) => Math.max(max, part.length), 0));
      sheet.getColumn(index + 1).width = column.width || Math.min(42, Math.max(14, column.header.length + 3, ...contents.map(n => Math.min(n + 2, 34))));
    });
    for (let column = headers.length + 1; column <= lastColumn; column++) sheet.getColumn(column).width = 14;
    const heading = (row: number, start: number, text: string, size: number, color: string, bold = false) => {
      sheet.mergeCells(row, start, row, lastColumn);
      const cell = sheet.getCell(row, start);
      cell.value = text;
      cell.font = { name: 'Arial', size, color: { argb: color.length === 6 ? 'FF' + color : color }, bold };
      cell.alignment = { vertical: 'middle', wrapText: true };
    };
    sheet.getRow(1).height = 8;
    heading(2, 3, report.school.name, 14, accent, true);
    heading(3, 3, report.school.address || '', 10, '475569');
    heading(4, 3, [report.school.phone, report.school.email].filter(Boolean).join(' · '), 10, '475569');
    sheet.getRow(2).height = 30;
    sheet.getRow(3).height = 28;
    sheet.getRow(4).height = 22;
    if (imageId !== undefined && report.logo) {
      const scale = Math.min(80 / report.logo.width, 80 / report.logo.height);
      sheet.addImage(imageId, { tl: { col: 0.1, row: 1.1 }, ext: { width: report.logo.width * scale, height: report.logo.height * scale } });
    }
    heading(6, 1, definition.title || report.title, 16, '0F172A', true);
    sheet.getRow(6).height = 36;
    heading(7, 1, [report.subtitle, 'Xuất ngày ' + created.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })].filter(Boolean).join(' · '), 10, '64748B');
    sheet.getRow(7).height = 28;
    for (let column = 1; column <= lastColumn; column++) sheet.getCell(8, column).border = { bottom: { style: 'thin', color: { argb: accent } } };
    headers.forEach((column, index) => {
      const cell = sheet.getCell(9, index + 1);
      cell.value = column.header;
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    sheet.getRow(9).height = Math.max(32, ...headers.map((c, i) => Math.ceil(c.header.length / (sheet.getColumn(i + 1).width - 2)) * 15 + 10));
    rows.forEach((values, index) => {
      const row = sheet.getRow(index + 10);
      let height = 24;
      headers.forEach((column, col) => {
        const cell = row.getCell(col + 1);
        cell.value = cellValue(values[col], column);
        const numeric = typeof cell.value === 'number';
        cell.font = { name: 'Arial', size: 11, color: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle', horizontal: numeric ? 'right' : 'left', wrapText: true, indent: 1 };
        if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7F6' } };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } };
        cell.numFmt = column.format || (cell.value instanceof Date ? 'dd/mm/yyyy' : numeric ? (Number.isInteger(cell.value) ? '#,##0' : '#,##0.00') : '@');
        const display = cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : String(cell.value ?? '');
        const lines = display.split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / Math.max(8, sheet.getColumn(col + 1).width - 3))), 0);
        height = Math.max(height, lines * 15 + 8);
      });
      row.height = Math.min(409, height);
    });
    if (headers.length) sheet.autoFilter = { from: { row: 9, column: 1 }, to: { row: Math.max(9, rows.length + 9), column: headers.length } };
    sheet.pageSetup.printArea = `A1:${sheet.getColumn(lastColumn).letter}${Math.max(10, rows.length + 9)}`;
  }
  return workbook;
}
