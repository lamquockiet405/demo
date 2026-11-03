const intake = require('../../database/reference/preschool-intake-standards.json');
const quote = (v) => v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`;
const json = (v) => `${quote(JSON.stringify(v))}::jsonb`;
const labels = { SNACK_MORNING: 'Phụ sáng', RICE: 'Cơm', MAIN: 'Món chính', SOUP: 'Canh',
  DESSERT: 'Tráng miệng', DRINK: 'Thức uống / Sữa chua', SNACK_AFTERNOON: 'Xế + Phụ chiều' };

function configurationData(catalog) {
  if (!catalog.weeks.length) throw new Error('Cannot derive rules from an empty menu source');
  const documents = [...new Map(catalog.dishes.flatMap(d => d.sources)
    .map(s => [s.file, { file: s.file, sha256: s.sourceSha256 }])).values()];
  const frequency = [], spacing = [];
  for (const [code, label] of Object.entries(labels)) {
    const dishes = catalog.dishes.filter(d => d.categoryCode === code);
    const sources = dishes.flatMap(d => d.sources);
    const slots = [...new Set(sources.map(s => s.mealType))];
    if (!sources.length || slots.length !== 1) throw new Error(`Ambiguous meal slot for ${code}`);
    const weeklyCounts = catalog.weeks.map(w => ({ weekNumber: w.weekNumber,
      count: sources.filter(s => s.weekNumber === w.weekNumber && s.file === w.sourceFile).length }));
    const counts = weeklyCounts.map(w => w.count);
    frequency.push({ code, label, mealSlot: slots[0], min: Math.min(...counts), max: Math.max(...counts),
      source: { seedKey: `DOC_FREQUENCY_${code}_V1`, kind: 'SOURCE_MENU_OBSERVATION',
        status: 'OBSERVED_REFERENCE', documents, weeklyCounts, totalOccurrences: sources.length } });
    let minGap = Infinity, repeats = false, sameDay = false, sameWeek = false;
    const observations = [];
    for (const dish of dishes) {
      const dates = dish.sources.map(s => s.date).sort();
      if (new Set(dates).size < dates.length) sameDay = true;
      if (new Set(dish.sources.map(s => `${s.file}:${s.weekNumber}`)).size < dates.length) sameWeek = true;
      for (let i = 1; i < dates.length; i++) {
        const gap = (Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i-1]}T00:00:00Z`)) / 86400000;
        minGap = Math.min(minGap, gap); repeats = true;
      }
      if (dates.length > 1) observations.push({ dishKey: dish.key, dates });
    }
    // An observed gap is a draft planning suggestion, not a mandated nutritional rule.
    if (repeats) spacing.push({ code, label, mealSlot: slots[0], minGap,
      noRepeatInSameDay: !sameDay, noRepeatInSameWeek: !sameWeek,
      source: { seedKey: `DOC_SPACING_${code}_V1`, kind: 'SOURCE_MENU_OBSERVATION',
        status: 'DRAFT_OBSERVED_REFERENCE', dayUnit: 'CALENDAR_DAYS', documents, observations } });
  }
  return { frequency, spacing, intake };
}

function configurationSql(catalog) {
  const data = configurationData(catalog);
  const sql = ['CREATE TEMP TABLE config_import_changes(table_name TEXT, inserted_count INT) ON COMMIT DROP;'];
  const insert = (table, cols, values) => sql.push(`WITH added AS (
    INSERT INTO ${table} (${cols.join(',')}) VALUES (${values.join(',')}) ON CONFLICT DO NOTHING RETURNING id
    ) INSERT INTO config_import_changes SELECT ${quote(table)}, count(*)::int FROM added;`);
  for (const rule of data.frequency) {
    insert('dish_frequency_rules', ['school_id','rule_name','meal_slot','target_type','target_id','target_code',
      'target_name','age_group','period_type','min_occurrences','max_occurrences','is_required_in_meal','severity','is_active','note','source_metadata'],
    [1, quote(`Cơ cấu ${rule.label} theo DOC`), quote(rule.mealSlot), "'DISH_CATEGORY'",
      `(SELECT id FROM dish_categories WHERE code=${quote(rule.code)})`, quote(rule.code), quote(rule.label), "'ALL'", "'PER_WEEK'",
      rule.min, rule.max, false, "'INFO'", true,
      quote('Tần suất quan sát trong 10 tuần DOC, dùng tham khảo cơ cấu thực đơn; không phải định mức dinh dưỡng bắt buộc.'), json(rule.source)]);
  }
  for (const rule of data.spacing) {
    insert('dish_spacing_rules', ['school_id','rule_name','meal_slot','target_type','target_id','target_name','age_group',
      'min_spacing_days','no_repeat_in_same_week','no_repeat_in_same_day','priority_order','severity','is_active','note','source_metadata'],
    [1, quote(`Khoảng lặp ${rule.label} quan sát từ DOC`), quote(rule.mealSlot), "'DISH_CATEGORY'",
      `(SELECT id FROM dish_categories WHERE code=${quote(rule.code)})`, quote(rule.label), "'ALL'", rule.minGap,
      rule.noRepeatInSameWeek, rule.noRepeatInSameDay, 1, "'INFO'", false,
      quote('Bản nháp tham khảo: khoảng cách nhỏ nhất giữa hai lần xuất hiện của cùng một món trong DOC, tính theo ngày lịch. Chưa áp dụng thành quy định của trường.'), json(rule.source)]);
  }
  for (const group of intake.groups) for (const scope of ['ALL_DAY','DAYBOARDING']) {
    const energy = scope === 'ALL_DAY' ? group.allDay : group.dayboarding;
    insert('nutrition_intake_standards', ['school_id','standard_name','age_group','gender','meal_scope',
      'energy_kcal_min','energy_kcal_max','protein_ratio_min','protein_ratio_max','lipid_ratio_min','lipid_ratio_max',
      'carbohydrate_ratio_min','carbohydrate_ratio_max','calcium_mg_min','iron_mg_min','zinc_mg_min','vitamin_a_rae_mcg_min',
      'iron_absorption_rate','zinc_absorption_level','is_active','note','source_metadata'],
    [1, quote(`${group.label} — ${scope === 'ALL_DAY' ? 'cả ngày' : 'tại trường'} (01/VBHN-BGDĐT)`), quote(group.ageGroup), "'ALL'", quote(scope),
      ...energy, ...group.protein, ...group.lipid, ...group.carbohydrate, 'NULL','NULL','NULL','NULL','NULL','NULL', true,
      quote('Năng lượng và tỷ lệ P:L:G theo Chương trình Giáo dục mầm non. Vi chất và chất xơ chưa có nguồn đối chiếu trong phần trích, để NULL; không suy ra từ năng lượng.'),
      json({ seedKey: `PRESCHOOL_2021_${group.ageGroup}_${scope}_V1`, kind: 'OFFICIAL_PRESCHOOL_PROGRAM', source: intake.source,
        ageMonthsMin: group.ageMonthsMin, ageMonthsMax: group.ageMonthsMax,
        missingNutrients: ['fiberGMin','fiberGMax','calciumMgMin','ironMgMin','zincMgMin','vitaminARaeMcgMin'] })]);
  }
  sql.push(`INSERT INTO audit_logs(school_id,user_id,user_name,user_role,action,target_entity,details)
    SELECT 1,NULL,'Source data import','SYSTEM','INITIALIZE_NUTRITION_CONFIGURATION','NUTRITION_CONFIGURATION',
      jsonb_build_object('origin','SOURCE_CATALOG_IMPORT','migration','20261103-nutrition-configuration',
        'insertedRows',(SELECT jsonb_object_agg(table_name, total) FROM
          (SELECT table_name,sum(inserted_count) AS total FROM config_import_changes GROUP BY table_name) counts),
        'description','Actual configuration initialization; no historical user activity was synthesized.')
    WHERE (SELECT COALESCE(sum(inserted_count),0) FROM config_import_changes)>0;`);
  sql.push('DROP TABLE config_import_changes;');
  return sql.join('\n\n');
}
module.exports = { configurationData, configurationSql };
