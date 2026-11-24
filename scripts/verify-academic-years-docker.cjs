const assert = require('node:assert/strict');
const base = new URL(process.argv[2] || 'http://127.0.0.1:5174').origin;

async function api(path, token, body, expected = 200) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': '1', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(result.message)}`);
  return result.data ?? result;
}

async function main() {
  const principal = await api('/auth/quick-login', null, { roleCode: 'SCHOOL_MANAGER' });
  const years = await api('/academic-years', principal.accessToken);
  const current = years.find(y => y.status === 'ACTIVE');
  assert.ok(current, 'Expected the existing active school year');
  const detail = await api(`/academic-years/${current.id}`, principal.accessToken);
  const classes = await api('/classes', principal.accessToken);
  assert.equal(classes.length, detail.classes.length);
  assert.ok(classes.every(c => String(c.academicYearId) === current.id));
  await api(`/academic-years/${current.id}/available-students`, principal.accessToken);
  await api('/users/staff?roleCode=TEACHER&status=ACTIVE&limit=200', principal.accessToken);
  const teacher = await api('/auth/quick-login', null, { roleCode: 'TEACHER' });
  await api('/academic-years', teacher.accessToken, undefined, 403);
  const html = await (await fetch(`${base}/academic-years`)).text();
  const jsPath = html.match(/src="([^"]+\.js)"/)[1];
  const js = await (await fetch(base + jsPath)).text();
  assert.ok(js.includes('Quản lý năm học') && js.includes('/academic-years'));
  console.log(JSON.stringify({ url: `${base}/academic-years`, activeYear: current.name,
    classes: detail.classes.length, students: detail.enrollments.filter(e => e.status === 'ENROLLED').length,
    principalAccess: 'OK', teacherDenied: 'OK', frontendMenu: 'OK' }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
