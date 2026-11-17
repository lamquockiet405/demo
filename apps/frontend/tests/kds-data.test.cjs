const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = fs.readFileSync(
  path.join(__dirname, '../src/features/kitchen/utils/kds-data.ts'),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const adapter = { exports: {} };
new Function('module', 'exports', compiled)(adapter, adapter.exports);
const { normalizeKitchenData, normalizeSearch, isToddler, getSchoolDate } =
  adapter.exports;

test('reads the existing API response without dropping portions, delivery status or allergy instructions', () => {
  const result = normalizeKitchenData({
    totalActual: 24,
    todayMenu: [
      {
        id: 'dish',
        name: 'Canh thịt bò',
        type: 'Món canh',
        portionSize: '120g',
        calories: '31.59 Kcal',
      },
    ],
    classes: [
      {
        classId: '1',
        className: 'Lớp Mầm 1',
        ageGroup: '3-4',
        actualPortions: 24,
        plannedPortions: 25,
        status: 'READY_DELIVERY',
        allergies: ['1 suất không sữa (Bé An)'],
      },
    ],
  });
  assert.equal(result.summary.lunch, 24);
  assert.equal(result.summary.total, 1);
  assert.equal(result.classes[0].lunchCount, 24);
  assert.equal(result.classes[0].kitchenStatus, 'READY_DELIVERY');
  assert.equal(result.classes[0].isLocked, null);
  assert.equal(result.summary.locked, null);
  assert.equal(result.summary.snack, null);
  assert.equal(result.summary.absent, null);
  assert.equal(result.summary.special, null);
  assert.equal(result.alerts[0].allergen, '1 suất không sữa (Bé An)');
  assert.equal(result.menu[0].type, 'Món canh');
});

test('keeps explicit zeroes and summary values and omits resolved alerts', () => {
  const result = normalizeKitchenData({
    summary: {
      totalLunchPortions: 0,
      totalSnackPortions: 0,
      specialTraysCount: 0,
      lockedClasses: 0,
      totalClasses: 1,
    },
    classes: [
      {
        classId: '2',
        gradeLevel: 'TODDLER',
        lunchCount: 0,
        snackCount: 0,
        absentCount: 0,
        specialCount: 0,
        isLocked: false,
        kitchenStatus: 'PREPARING',
      },
    ],
    allergyAlerts: [
      { id: 'a', isResolved: true },
      {
        id: 'b',
        childName: 'Bé Bình',
        badgeColor: 'RED',
        allergen: 'Trứng',
        replacementMeal: 'Thịt gà',
      },
    ],
  });
  assert.equal(result.summary.lunch, 0);
  assert.equal(result.summary.snack, 0);
  assert.equal(result.summary.locked, 0);
  assert.equal(result.classes[0].lunchCount, 0);
  assert.equal(result.classes[0].isLocked, false);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0].replacementMeal, 'Thịt gà');
});

test('uses class-level attendance totals instead of legacy planned or duplicated portions', () => {
  const result = normalizeKitchenData(
    {
      totalActual: 60,
      classes: [
        { classId: '1', actualPortions: 30, ageGroup: '3-4' },
        { classId: '2', actualPortions: 30, ageGroup: '24-36' },
      ],
    },
    {
      overview: {
        lunchPortions: 10,
        snackPortions: 8,
        absentToday: 2,
        classesLockedCount: 1,
      },
      classes: [
        {
          id: '1',
          lunchCount: 10,
          snackCount: 8,
          absentToday: 0,
          homeroomTeacher: 'Đỗ Thị Hà',
          isKitchenLocked: true,
        },
        {
          id: '2',
          lunchCount: 0,
          snackCount: 0,
          absentToday: 2,
          isKitchenLocked: false,
        },
      ],
    },
  );
  assert.equal(result.summary.lunch, 10);
  assert.equal(result.summary.snack, 8);
  assert.equal(result.summary.absent, 2);
  assert.equal(result.summary.locked, 1);
  assert.equal(result.summary.kindergarten, 10);
  assert.equal(result.summary.toddler, 0);
  assert.equal(result.classes[0].teacherName, 'Đỗ Thị Hà');
  assert.equal(result.classes[0].isLocked, true);
  assert.equal(result.classes[1].lunchCount, 0);
  assert.equal(result.classes[1].isLocked, false);
  assert.equal(result.summary.special, null);
});

test('does not manufacture counts from incomplete or invalid class data', () => {
  const result = normalizeKitchenData({
    classes: [
      { classId: '1', lunchCount: 10, absentCount: -1 },
      {
        classId: '2',
        lunchCount: 'invalid',
        snackCount: false,
        kitchenStatus: 'unknown',
      },
    ],
  });
  assert.equal(result.summary.lunch, null);
  assert.equal(result.summary.absent, null);
  assert.equal(result.summary.snack, null);
  assert.equal(result.classes[1].kitchenStatus, 'WAITING');
  assert.equal(result.classes[1].teacherName, '');
});

test('handles an empty day and rejects malformed API responses', () => {
  const result = normalizeKitchenData({ classes: [], todayMenu: [] });
  assert.equal(result.summary.lunch, 0);
  assert.equal(result.classes.length, 0);
  assert.equal(result.menu.length, 0);
  for (const payload of [null, undefined, {}, { classes: 'invalid' }])
    assert.throws(() => normalizeKitchenData(payload));
});

test('search supports Vietnamese without accents and classifies nursery ages', () => {
  assert.equal(
    normalizeSearch('  Lớp Chồi · Đỗ Thị Hà  '),
    'lop choi · do thi ha',
  );
  assert.equal(isToddler('NHA_TRE'), true);
  assert.equal(isToddler('24-36 tháng'), true);
  assert.equal(isToddler('3-4 tuổi'), false);
  assert.equal(isToddler('KINDERGARTEN'), false);
});

test('school date follows Vietnam midnight rather than the UTC calendar day', () => {
  const RealDate = Date;
  try {
    for (const [instant, expected] of [
      ['2026-11-03T18:05:00Z', '2026-11-04'],
      ['2026-11-04T16:59:59Z', '2026-11-04'],
      ['2026-11-04T17:00:00Z', '2026-11-05'],
    ]) {
      global.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [instant]));
        }
      };
      assert.equal(getSchoolDate(), expected);
    }
  } finally {
    global.Date = RealDate;
  }
});
