const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/features/children/api/children.api.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function apiFor(data) {
  const value = { exports: {} };
  new Function('require', 'module', 'exports', source)(() => ({ apiClient: { get: async () => ({ data }) } }), value, value.exports);
  return value.exports.childrenApi;
}
const students = [{ id: '4', fullName: 'Student 4', classId: '2' }, { id: '5', fullName: 'Student 5', classId: '2' }];

test('normalizes a flattened teacher response into a visible student list', async () => {
  const response = await apiFor(students).getChildren();
  assert.equal(response.items.length, 2);
  assert.equal(response.total, 2);
});

test('preserves the real total and page items in a paginated response', async () => {
  const response = await apiFor({ items: students, total: 30, page: 2, limit: 25 }).getChildren();
  assert.equal(response.items.length, 2);
  assert.equal(response.total, 30);
});

test('supports an empty scoped list without inventing student data', async () => {
  const response = await apiFor({ items: [], total: 0 }).getChildren();
  assert.deepEqual(response.items, []);
  assert.equal(response.total, 0);
});

test('reports an unexpected response instead of silently showing zero students', async () => {
  await assert.rejects(apiFor({ unexpected: true }).getChildren(), /Không đọc được danh sách/);
});
