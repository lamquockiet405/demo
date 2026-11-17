const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(filename, stubs = {}) {
  const loaded = new Module(filename, module);
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = loaded.require.bind(loaded);
  loaded.require = name => Object.hasOwn(stubs, name) ? stubs[name] : normalRequire(name);
  loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, experimentalDecorators: true, emitDecoratorMetadata: true },
  }).outputText, filename);
  return loaded.exports;
}

const backend = path.resolve(__dirname, '../../backend');
const backendRequire = Module.createRequire(path.join(backend, 'package.json'));
backendRequire('reflect-metadata');
const { plainToInstance } = backendRequire('class-transformer');
const { validateSync } = backendRequire('class-validator');
const { CreateMenuDto } = loadTypeScript(path.join(backend, 'src/modules/menus/dto/create-menu.dto.ts'));
const { UpdateMenuDto } = loadTypeScript(path.join(backend, 'src/modules/menus/dto/update-menu.dto.ts'));
const apiFile = path.resolve(__dirname, '../src/features/menus/api/weekly-menus.api.ts');
const form = { title: 'Thực đơn tuần 47', startDate: '2026-11-16', endDate: '2026-11-20', targetAgeGroup: 'MAU_GIAO', menuCycleType: 'WEEKLY', cycleWeekNumber: 47 };

function client(method, dto, inspect) {
  return loadTypeScript(apiFile, {
    '../../../core/api/axios': { apiClient: { [method]: async (url, body) => {
      // Match the backend's real ValidationPipe contract, including whitelist stripping.
      const validated = plainToInstance(dto, body);
      const errors = validateSync(validated, { whitelist: true });
      assert.deepEqual(errors.map(error => ({ property: error.property, constraints: error.constraints })), []);
      inspect(url, body, validated);
      return { data: { id: '42', title: body.title || form.title } };
    } } },
    '../../../core/utils/excel-export': {},
    './published-menus.api': {},
  }).weeklyMenusApi;
}

test('creates a menu from drawer fields without missing weekStartDate/weekEndDate', async () => {
  const api = client('post', CreateMenuDto, (url, body, validated) => {
    assert.equal(url, '/menus');
    assert.equal(validated.weekStartDate, '2026-11-16');
    assert.equal(validated.weekEndDate, '2026-11-20');
    assert.equal(validated.ageGroup, 'MAU_GIAO');
    assert.equal(body.title, form.title);
    assert.equal(Object.hasOwn(body, 'startDate'), false);
    assert.equal(Object.hasOwn(body, 'endDate'), false);
    assert.equal(Object.hasOwn(body, 'targetAgeGroup'), false);
  });
  const result = await api.createMenu(form);
  assert.equal(result.id, '42');
  assert.deepEqual(form.startDate, '2026-11-16');
});

test('maps preschool age labels to the backend age group', async () => {
  for (const group of ['MAU_GIAO', 'KINDERGARTEN_3_4Y', 'KINDERGARTEN_4_5Y', 'KINDERGARTEN_5_6Y', 'ALL_AGES']) {
    const api = client('post', CreateMenuDto, (_url, _body, validated) => assert.equal(validated.ageGroup, 'MAU_GIAO'));
    await api.createMenu({ ...form, targetAgeGroup: group });
  }
});

test('updates the same date fields accepted by the backend', async () => {
  const api = client('put', UpdateMenuDto, (url, _body, validated) => {
    assert.equal(url, '/menus/42');
    assert.equal(validated.weekStartDate, '2026-11-23');
    assert.equal(validated.weekEndDate, '2026-11-27');
    assert.equal(validated.ageGroup, 'MAU_GIAO');
  });
  await api.updateMenu('42', { ...form, startDate: '2026-11-23', endDate: '2026-11-27' });
});

test('a title-only update leaves date and age group fields untouched', async () => {
  const api = client('put', UpdateMenuDto, (_url, body) => {
    assert.deepEqual(body, { title: 'Thực đơn đã đổi tên' });
  });
  await api.updateMenu('42', { title: 'Thực đơn đã đổi tên' });
});
