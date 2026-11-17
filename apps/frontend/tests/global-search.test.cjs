const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(filename) {
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText, filename);
  return loaded.exports;
}
const frontend = load(path.resolve(__dirname, '../src/core/utils/search.ts'));
const backend = load(path.resolve(__dirname, '../../backend/src/common/utils/search.ts'));
const kitchen = load(path.resolve(__dirname, '../src/features/kitchen/utils/kds-data.ts'));
for (const [query, value] of [
  ['bui khanh vy', 'Bùi Khánh Vy'], ['DANG', 'Đặng Minh Đức'], ['  lop   mam\t1 ', 'Lớp Mầm 1'],
  ['thuc don tuan', 'Thực đơn tuần 47'], ['thit bo', 'Thịt bò'], ['dau phong', 'Đậu phộng'],
  ['sua', 'Sữa'], ['tran thi', 'Trần Thị Mai'], ['hs-001', 'HS-001'], ['090123', '0901234567'],
  ['phu huynh', 'Phụ huynh'], ['kiem thuc', 'Kiểm thực'], ['bui khanh vy', 'Bùi Khánh Vy'.normalize('NFD')],
]) test(`search matches ${query}`, () => {
  assert.equal(frontend.matchesSearch(query, value), true);
  assert.equal(frontend.normalizeSearch(value), backend.normalizeSearch(value));
  assert.equal(frontend.normalizeSearch(value), kitchen.normalizeSearch(value));
});
test('handles empty values and literal punctuation without changing identifiers', () => {
  assert.equal(frontend.matchesSearch(' \t ', undefined), true);
  assert.equal(frontend.matchesSearch('vy', null, undefined), false);
  assert.equal(frontend.matchesSearch('0901', '901'), false);
  assert.equal(frontend.matchesSearch('%', 'Tên bất kỳ'), false);
  assert.equal(frontend.matchesSearch('_', 'HS_001'), true);
  assert.equal(frontend.matchesSearch("O'", "O'Neil"), true);
});
