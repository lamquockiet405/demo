// Integration check for the isolated local Docker test stack. Removes its own fixtures.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const { Client } = createRequire(path.join(root, 'apps/backend/package.json'))('pg');
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.docker-test/test.env'), 'utf8').trim().split(/\r?\n/).map(line => line.split(/=(.*)/s).slice(0, 2)));
const database = env.TEST_POSTGRES_DB || 'kidmeal_test';
if (!database.startsWith('kidmeal_test')) throw new Error('Only the local kidmeal_test database is supported');
const client = new Client({ host: '127.0.0.1', port: 55432, user: 'kidmeal_test', database, password: env.TEST_POSTGRES_PASSWORD });
const fixture = `allergy-qa-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
const email = `${fixture}@example.invalid`;
let childId;
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
    const staff = (await request('auth/quick-login', null, 'POST', { roleCode: 'SCHOOL_MANAGER' })).accessToken;
    const password = crypto.randomBytes(24).toString('base64url');
    const parent = await request('users/parents', staff, 'POST', { email, password, fullName: 'Allergy API Fixture' }, 201);
    const child = await request('children', staff, 'POST', { studentCode: fixture, fullName: 'Allergy API Fixture', dateOfBirth: '2022-01-01', gender: 'MALE' }, 201);
    childId = child.id;
    await client.query("INSERT INTO student_parents(student_id,parent_id,relationship) VALUES($1,$2,'GUARDIAN')", [childId, parent.id]);
    const auth = await request('auth/login', null, 'POST', { email, password });
    const token = auth.accessToken;
    const children = await request('children?limit=200', token);
    assert.deepEqual(children.items.map(row => row.id), [String(childId)]);
    const unlinked = await client.query('SELECT id FROM students WHERE id<>$1 ORDER BY id LIMIT 1', [childId]);
    if (unlinked.rows.length) {
      await request(`children/${unlinked.rows[0].id}`, token, 'GET', undefined, 403);
      await request(`children/${unlinked.rows[0].id}/allergies`, token, 'POST', { customAllergenName: 'Kiwi', severity: 'MILD' }, 403);
    }
    const created = await request(`children/${childId}/allergies`, token, 'POST', { customAllergenName: 'thịt bò', severity: 'SEVERE', allergyType: 'ALLERGY', note: 'Fixture' }, 201);
    assert.equal(created.severity, 'SEVERE');
    assert.equal(created.customAllergenName, 'thịt bò');
    await request(`children/${childId}/allergies`, token, 'POST', { customAllergenName: ' THỊT BÒ ', severity: 'MILD' }, 409);
    const catalogs = await request('children/allergen-catalogs', token);
    assert.ok(catalogs.length);
    let edited = await request(`children/allergies/${created.id}`, token, 'PUT', { allergenId: catalogs[0].id, customAllergenName: '', severity: 'ANAPHYLACTIC' });
    assert.equal(edited.allergenId, catalogs[0].id);
    assert.equal(edited.severity, 'ANAPHYLACTIC');
    edited = await request(`children/allergies/${created.id}`, token, 'PUT', { allergenId: null, customAllergenName: 'Kiwi' });
    assert.equal(edited.customAllergenName, 'Kiwi');
    assert.ok(!edited.allergenId);
    await request(`children/allergies/${created.id}`, token, 'DELETE');
    const inactive = await request(`children/${childId}`, token);
    assert.equal(inactive.allergies.find(row => row.id === created.id).isActive, false);
    const reactivated = await request(`children/allergies/${created.id}`, token, 'PUT', { isActive: true });
    assert.equal(reactivated.isActive, true);
    console.log('PASS: parent scope, custom declaration, severity, duplicate rejection, catalog/custom edits, deactivate/reactivate');

    // Check existing disclosures against real menus without changing those records.
    const beef = await client.query("SELECT sa.id,sa.student_id,sa.severity FROM student_allergies sa WHERE sa.is_active=TRUE AND lower(btrim(sa.custom_allergen_name))=$1 ORDER BY sa.id", ['thịt bò']);
    const menus = await request('menus?limit=100', staff);
    const list = Array.isArray(menus) ? menus : menus.items || menus.data || [];
    let beefMenus = 0;
    let beefConflicts = 0;
    for (const menu of list) {
      const detail = await request(`menus/${menu.id}`, staff);
      const beefDishes = (detail.menuDishes || []).filter(md => /(?:^|[^\p{L}])bò(?=$|[^\p{L}])/iu.test(md.dish?.name || '') && !/sữa bò/iu.test(md.dish?.name || ''));
      if (!beefDishes.length || !beef.rows.length) continue;
      const advisory = await request(`menus/${menu.id}/advisory`, staff);
      for (const declaration of beef.rows) {
        const matches = advisory.allergyConflicts.filter(row => row.childId === String(declaration.student_id) && row.allergenDetected === 'thịt bò');
        for (const dish of beefDishes) assert.ok(matches.some(row => row.menuDishId === dish.id), `Missing beef conflict for menu ${menu.id}, dish ${dish.id}`);
        beefConflicts += matches.length;
      }
      beefMenus++;
    }
    if (beef.rows.length) assert.ok(beefMenus > 0, 'No existing beef menu verified');
    console.log(JSON.stringify({ existingBeefDeclarations: beef.rows.length, beefMenusVerified: beefMenus, beefConflictsVerified: beefConflicts }));
  } finally {
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM students WHERE student_code=$1 AND ($2::bigint IS NULL OR id=$2)', [fixture, childId || null]);
      await client.query('DELETE FROM users WHERE email=$1', [email]);
      await client.query('COMMIT');
      console.log('Fixture cleanup complete');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    await client.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
