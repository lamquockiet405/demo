// Tests only the isolated local Docker database; removes exactly its own menu fixtures.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client } = backendRequire('pg');
const ts = backendRequire('typescript');
const context = { exports: {} };
const helper = fs.readFileSync(path.join(root, 'apps/frontend/src/features/menus/utils/substitute-candidates.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, context);
const { buildSubstituteCandidates } = context.exports;
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.docker-test/test.env'), 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
if (!database.startsWith('kidmeal_test')) throw new Error('Only the local kidmeal_test database is supported');
const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', database, password: env.TEST_POSTGRES_PASSWORD });
const fixture = `substitution-qa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const created = [];
async function request(route, token, method = 'GET', body, expected = 200) {
  const response = await fetch(`http://127.0.0.1:3001/api/v1/${route}`, {
    method, headers: { 'Content-Type': 'application/json', 'x-tenant-id': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(result)}`);
  return result.data ?? result;
}
async function main() {
  await client.connect();
  try {
    const token = (await request('auth/quick-login', null, 'POST', { roleCode: 'NUTRITIONIST' })).accessToken;
    const catalog = await request('menus/available-dishes', token);
    const original = catalog.find(dish => dish.name === 'Thịt bò xào khóm' && dish.nutritionAvailable && dish.isActive);
    assert.ok(original, 'Expected a real beef dish in the current catalog');
    const missing = Number((await client.query('SELECT max(id) AS id FROM dishes')).rows[0].id) + 100000;
    let priorSlot;
    for (const group of ['ALLERGIES', 'OBESE', 'STUNTED', 'COMMON']) {
      const title = `${fixture}-${group}`;
      const menu = await request('menus', token, 'POST', { title, weekStartDate: '2026-11-09', weekEndDate: '2026-11-13', ageGroup: 'MAU_GIAO' }, 201);
      created.push({ id: menu.id, title });
      const added = await request(`menus/${menu.id}/adjust-dish`, token, 'POST', { dayOfWeek: 1, mealTime: 'LUNCH', dishId: Number(original.id), portionSizeG: 65 }, 201);
      const detail = await request(`menus/${menu.id}`, token);
      const slot = detail.menuDishes.find(item => item.id === added.menuDishId);
      assert.equal(slot.dayOfWeek, 1);
      assert.equal(slot.mealTime, 'LUNCH');
      assert.equal(slot.dish.name, original.name);
      const payload = { menuDishId: Number(slot.id), oldDishId: Number(original.id), dayOfWeek: 1, mealTime: 'LUNCH', newDishId: missing, keepOriginalDish: false, portionSizeG: 65 };
      await request(`menus/${menu.id}/adjust-dish`, token, 'POST', payload, 404);
      await request(`menus/${menu.id}/adjust-dish`, token, 'POST', { ...payload, newDishId: 0 }, 400);
      let unchanged = await request(`menus/${menu.id}`, token);
      assert.equal(unchanged.menuDishes.length, 1);
      assert.equal(unchanged.menuDishes[0].id, slot.id);
      const candidates = await request(`menus/${menu.id}/dishes/${slot.id}/substitute-candidates`, token);
      const selectable = buildSubstituteCandidates(candidates, slot, group);
      assert.ok(selectable.length, `No real same-category candidate for ${group}`);
      const selected = selectable[0];
      const actual = await client.query('SELECT name,status FROM dishes WHERE id=$1', [selected.id]);
      assert.equal(actual.rows[0].name, selected.name);
      assert.equal(actual.rows[0].status, 'ACTIVE');
      const base = { ...payload, newDishId: Number(selected.id) };
      await request(`menus/${menu.id}/adjust-dish`, token, 'POST', { ...base, oldDishId: missing }, 400);
      if (priorSlot) await request(`menus/${menu.id}/adjust-dish`, token, 'POST', { ...base, menuDishId: Number(priorSlot) }, 404);
      const note = `[${group}] Thay cho: ${original.name}`;
      await request(`menus/${menu.id}/adjust-dish`, token, 'POST', { ...base, keepOriginalDish: true, specialDietNotes: note }, 201);
      const separate = await request(`menus/${menu.id}`, token);
      assert.equal(separate.menuDishes.length, 2);
      assert.ok(separate.menuDishes.some(item => item.id === slot.id));
      const substitute = separate.menuDishes.find(item => item.dishId === selected.id);
      assert.equal(substitute.dish.name, selected.name);
      assert.equal(substitute.specialDietNotes, note);
      await request(`menus/${menu.id}/adjust-dish`, token, 'POST', { ...base, keepOriginalDish: false, specialDietNotes: null }, 201);
      const replaced = await request(`menus/${menu.id}`, token);
      assert.equal(replaced.menuDishes.length, 1);
      assert.equal(replaced.menuDishes[0].dishId, selected.id);
      assert.equal(replaced.menuDishes[0].dayOfWeek, 1);
      assert.equal(replaced.menuDishes[0].mealTime, 'LUNCH');
      assert.equal(replaced.menuDishes[0].specialDietNotes, null);
      priorSlot = replaced.menuDishes[0].id;
      console.log(`PASS ${group}: real catalog ID, invalid/stale rejection, separate portion and full replacement`);
    }
    const orphans = await client.query('SELECT count(*)::int AS count FROM menu_dishes md LEFT JOIN dishes d ON d.id=md.dish_id WHERE d.id IS NULL');
    assert.equal(orphans.rows[0].count, 0);
    console.log('PASS: no orphan dish references');
  } finally {
    try {
      for (const item of created) await client.query('DELETE FROM menus WHERE id=$1 AND title=$2', [item.id, item.title]);
      // Also covers a fixture whose POST succeeded but response processing failed.
      await client.query('DELETE FROM menus WHERE title LIKE $1', [`${fixture}-%`]);
      console.log('Menu fixture cleanup complete');
    } finally { await client.end(); }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
