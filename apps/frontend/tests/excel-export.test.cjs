const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');

const sourceRoot = path.resolve(__dirname, '../src');
function loadTypeScript(relative, stubs = {}) {
  const filename = path.join(sourceRoot, relative);
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(stubs, name) ? stubs[name] : normalRequire(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText, filename);
  return loaded.exports;
}
const core = loadTypeScript('core/utils/excel-workbook.ts');
const exporter = loadTypeScript('core/utils/excel-export.ts', {
  '../api/tenant.api': { tenantApi: { getProfile: async () => ({ name: 'Trường kiểm thử', branding: { logoUrl: 'https://school.example/logo.png' } }) } },
  '../i18n/language': { t: text => text },
  './excel-workbook': core,
});
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=';
const fixture = {
  title: 'Danh sách học sinh', school: { name: 'Trường Mẫu Giáo Hướng Dương', address: 'Địa chỉ kiểm thử', phone: '02839301888' },
  logo: { base64: png, width: 100, height: 50 }, createdAt: new Date('2026-11-16T03:00:00Z'),
  sheets: [{ name: 'Học sinh', rows: [
    ['Mã học sinh', 'Họ và tên (*)', 'Ngày sinh (*)', 'Cân nặng (kg)', 'SĐT phụ huynh', 'Ghi chú'],
    ['000123', 'Nguyễn "An", Bình', '2021-04-12', '18.25', '0901234567', '=SUM(A1:A3)'],
    ['HS02', 'Trần Linh', '2021-02-30', 0, '001234', 'Có ghi chú\nDòng thứ hai'],
  ] }],
};

test('serializes a real XLSX with school branding, embedded logo and usable table formatting', async () => {
  const workbook = await core.buildExcelWorkbook(fixture);
  const buffer = await workbook.xlsx.writeBuffer();
  assert.equal(Buffer.from(buffer).subarray(0, 2).toString(), 'PK');
  const saved = new ExcelJS.Workbook();
  await saved.xlsx.load(buffer);
  const sheet = saved.worksheets[0];
  assert.equal(sheet.getCell('C2').value, fixture.school.name);
  assert.equal(sheet.getCell('A6').value, fixture.title);
  assert.equal(sheet.getCell('A9').value, 'Mã học sinh');
  assert.equal(sheet.getCell('A9').font.color.argb, 'FFFFFFFF');
  assert.equal(sheet.views[0].ySplit, 9);
  assert.equal(sheet.views[0].showGridLines, false);
  assert.equal(sheet.getImages().length, 1);
  assert.equal(sheet.getImages()[0].range.ext.width, 80);
  assert.equal(sheet.getImages()[0].range.ext.height, 40);
  assert.equal(sheet.pageSetup.fitToWidth, 1);
  assert.equal(sheet.getCell('D10').value, 18.25);
  assert.equal(sheet.getCell('D11').value, 0);
  assert.equal(sheet.getCell('A10').value, '000123');
  assert.equal(sheet.getCell('E10').value, '0901234567');
  assert.equal(sheet.getCell('B10').value, 'Nguyễn "An", Bình');
  assert.equal(sheet.getCell('F10').value, '=SUM(A1:A3)');
  assert.ok(sheet.getCell('C10').value instanceof Date);
  assert.equal(sheet.getCell('C11').value, '2021-02-30');
  assert.equal(sheet.getCell('C10').numFmt, 'dd/mm/yyyy');
  assert.notEqual(sheet.getCell('A11').fill.fgColor.argb, sheet.getCell('A9').fill.fgColor.argb);
});

test('branded student template round-trips through the existing SheetJS importer', async () => {
  const workbook = await core.buildExcelWorkbook(fixture);
  const saved = XLSX.read(await workbook.xlsx.writeBuffer(), { type: 'buffer' });
  const sheet = saved.Sheets[saved.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: '' });
  const index = core.studentHeaderRow(rows);
  assert.equal(index, 8);
  const imported = XLSX.utils.sheet_to_json(sheet, { range: index, raw: false, defval: '' });
  assert.equal(imported.length, 2);
  assert.equal(imported[0]['Mã học sinh'], '000123');
  assert.equal(imported[0]['Họ và tên (*)'], 'Nguyễn "An", Bình');
  assert.equal(imported[0]['Ngày sinh (*)'], '12/04/2021');
  assert.equal(core.studentHeaderRow([fixture.sheets[0].rows[0]]), 0);
});

test('keeps all data from structured reports, including heterogeneous and nested records', () => {
  const sheets = exporter.reportSheets({ total: 0, items: [{ name: 'An', class: { name: 'Lá 1' }, allergens: ['Trứng', 'Sữa'] }, { name: 'Bình', note: 'Cần lưu ý' }], empty: [] });
  assert.equal(sheets.length, 3);
  const rows = sheets.find(sheet => sheet.name === 'Chi tiết').rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[1][rows[0].indexOf('Lớp / Tên')], 'Lá 1');
  assert.equal(rows[2][rows[0].indexOf('Ghi chú')], 'Cần lưu ý');
  assert.equal(sheets[0].rows[1][1], 0);
});

test('normalizes filenames and produces unique valid worksheet names', async () => {
  assert.equal(core.excelFilename('nhat-ky.csv'), 'nhat-ky.xlsx');
  assert.equal(core.excelFilename('bao-cao.json'), 'bao-cao.xlsx');
  const name = 'Báo cáo / [lớp học] rất dài '.repeat(4);
  const workbook = await core.buildExcelWorkbook({ ...fixture, sheets: [name, name, ''].map(name => ({ name, rows: [['Thông tin', 'Giá trị']] })) });
  const names = workbook.worksheets.map(sheet => sheet.name);
  assert.equal(new Set(names).size, 3);
  assert.ok(names.every(name => name.length <= 31 && !/[\\/?*\[\]:]/.test(name)));
});

test('browser download embeds fetched school logo and never reports a failed export as successful', async () => {
  const old = Object.fromEntries(['localStorage', 'fetch', 'Image', 'document', 'alert', 'setTimeout'].map(key => [key, global[key]]));
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
  const blobs = [], links = [], alerts = [];
  try {
    global.localStorage = { getItem: () => null };
    global.fetch = async () => ({ ok: true, blob: async () => new Blob(['logo']) });
    global.Image = class { naturalWidth = 100; naturalHeight = 50; async decode() {} };
    global.document = { body: { appendChild() {} }, createElement: tag => tag === 'canvas'
      ? { getContext: () => ({ drawImage() {} }), toDataURL: () => png }
      : { click() { links.push(this); }, remove() {} } };
    global.alert = text => alerts.push(text);
    global.setTimeout = callback => { callback(); return 0; };
    URL.createObjectURL = blob => { blobs.push(blob); return 'blob:fixture'; };
    URL.revokeObjectURL = () => {};
    assert.equal(await exporter.downloadExcel('Danh_sach.csv', fixture.sheets[0].rows, 'Danh sách'), true);
    assert.equal(links[0].download, 'Danh_sach.xlsx');
    assert.equal(blobs.at(-1).type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const saved = new ExcelJS.Workbook();
    await saved.xlsx.load(await blobs.at(-1).arrayBuffer());
    assert.equal(saved.worksheets[0].getCell('C2').value, 'Trường kiểm thử');
    assert.equal(saved.worksheets[0].getImages().length, 1);
    global.fetch = async () => ({ ok: false });
    assert.equal(await exporter.downloadExcel('Danh_sach.xlsx', []), false);
    assert.equal(links.length, 1);
    assert.equal(alerts.length, 1);
  } finally {
    for (const [key, value] of Object.entries(old)) global[key] = value;
    URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  }
});
