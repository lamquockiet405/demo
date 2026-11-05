const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const moduleValue = { exports: {} };
new Function(
  'module',
  'exports',
  ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, '../src/features/menus/utils/published-menus.ts'),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText,
)(moduleValue, moduleValue.exports);
const {
  isPublishedMenu,
  publishedMenusForDate,
  publishedMenuDay,
  publishedMenuDates,
  publishedDayNutrition,
  publishedMenuOrder,
  normalizeMenuAgeGroup,
} = moduleValue.exports;
const menu = {
  id: '1',
  title: 'Tuần đã công bố',
  status: 'PUBLISHED',
  startDate: '2026-11-02',
  endDate: '2026-11-06',
  ageGroup: 'MAU_GIAO',
  publishedAt: '2026-11-01T07:00:00Z',
  days: [
    {
      date: '2026-11-04',
      meals: [
        {
          mealType: 'LUNCH',
          dishes: [
            {
              dishId: '1',
              dishName: 'Canh thịt bò',
              portionSizeG: 120,
              energyKcal: 100,
              proteinG: 20,
              fatG: 2,
              carbG: 3,
              fiberG: 1,
              calciumMg: 20,
              nutritionAvailable: true,
            },
          ],
        },
        {
          mealType: 'AFTERNOON_SNACK',
          dishes: [
            {
              dishId: '2',
              dishName: 'Sữa chua',
              energyKcal: 60,
              proteinG: 3,
              fatG: 1,
              carbG: 4,
              fiberG: 0,
              calciumMg: 30,
              nutritionAvailable: true,
            },
          ],
        },
      ],
    },
    {
      date: '2026-11-05',
      meals: [
        {
          mealType: 'LUNCH',
          dishes: [
            {
              dishId: '3',
              dishName: 'Món ngày mai',
              nutritionAvailable: false,
              energyKcal: 0,
            },
          ],
        },
      ],
    },
  ],
};
test('approved isPublished flags do not expose menus before principal publication', () => {
  for (const status of [
    'DRAFT',
    'APPROVED',
    'PENDING',
    'SUBMITTED_FOR_REVIEW',
    'REJECTED',
  ])
    assert.equal(
      isPublishedMenu({
        ...menu,
        status,
        isPublished: true,
        publishedAt: menu.publishedAt,
      }),
      false,
    );
  for (const status of ['PUBLISHED', 'ACTIVE'])
    assert.equal(isPublishedMenu({ ...menu, status }), true);
  assert.equal(isPublishedMenu({ ...menu, deletedAt: '2026-11-04' }), false);
});
test('retains previously published archived weeks, but excludes never-published archives', () => {
  assert.equal(isPublishedMenu({ ...menu, status: 'ARCHIVED' }), true);
  assert.equal(
    isPublishedMenu({ ...menu, status: 'ARCHIVED', publishedAt: null }),
    false,
  );
  assert.deepEqual(
    [menu, { ...menu, id: '2', publishedAt: '2026-11-03T07:00:00Z' }]
      .sort(publishedMenuOrder)
      .map((m) => m.id),
    ['2', '1'],
  );
});
test('daily view chooses latest published menu per age group and exact serving date', () => {
  const newer = { ...menu, id: '2', publishedAt: '2026-11-03T07:00:00Z' };
  const nursery = { ...menu, id: '3', ageGroup: 'NHA_TRE' };
  assert.deepEqual(
    publishedMenusForDate([menu, newer, nursery], '2026-11-04').map(
      (m) => m.id,
    ),
    ['2', '3'],
  );
  assert.deepEqual(
    publishedMenusForDate(
      [menu, newer, nursery],
      '2026-11-04',
      'Mẫu giáo (4–5T)',
    ).map((m) => m.id),
    ['2'],
  );
  assert.deepEqual(publishedMenusForDate([menu], '2026-12-01'), []);
  assert.equal(normalizeMenuAgeGroup('Nhà trẻ'), 'NHA_TRE');
});
test('exact menu days never borrow dishes from another date or draft', () => {
  assert.deepEqual(
    publishedMenuDay(menu, '2026-11-04').map((m) => m.dishes[0].name),
    ['Canh thịt bò', 'Sữa chua'],
  );
  assert.deepEqual(publishedMenuDay(menu, '2026-11-03'), []);
  assert.deepEqual(
    publishedMenuDay({ ...menu, status: 'DRAFT' }, '2026-11-04'),
    [],
  );
  assert.deepEqual(publishedMenuDates(menu), ['2026-11-04', '2026-11-05']);
  assert.throws(() =>
    publishedMenuDay({ ...menu, days: undefined }, '2026-11-04'),
  );
});
test('nutrition follows the selected published dishes and missing values stay unknown', () => {
  assert.deepEqual(
    publishedDayNutrition(publishedMenuDay(menu, '2026-11-04')),
    {
      calories: 160,
      proteinG: 23,
      fatG: 3,
      carbG: 7,
      fiberG: 1,
      calciumMg: 50,
    },
  );
  assert.equal(
    publishedDayNutrition(publishedMenuDay(menu, '2026-11-05')).calories,
    null,
  );
  assert.equal(publishedDayNutrition([]).calories, null);
});
