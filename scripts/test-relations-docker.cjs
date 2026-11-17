#!/usr/bin/env node
// All fixture tables/functions live in a new schema inside one rolled-back transaction
// on the local Docker PostgreSQL. Never connects to the .env database.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildSql } = require('./import-source-catalog.cjs');
const { extractCatalog } = require('./lib/source-menu-catalog.cjs');
const { migrationSql } = require('./migrate-relations.cjs');
const root = path.resolve(__dirname, '..');
const container = process.env.KIDMEAL_POSTGRES_CONTAINER ||
  (fs.existsSync(path.join(root, '.docker-test/test.env')) ? 'kidmeal-test-postgres-1' : 'kidmeal_postgres');
const strip = (sql) => sql.replace(/^(?:BEGIN|COMMIT);\s*$/gm, '');
const fixtureSchema = `relations_test_${process.pid}`;
const catalog = extractCatalog(path.join(root, 'docs/dử liệu chính'));
const importSql = strip(buildSql(catalog));
const legacy = require('../database/reference/unverified-seed-recipes.json');
const legacySql = legacy.rows.map((row) => `INSERT INTO dish_recipes(id,dish_id,ingredient_id,gross_weight_g,net_weight_g,note)
  VALUES(${row.id},${row.dishId},${row.ingredientId},${row.grossWeightG},${row.netWeightG},'Unverified integration fixture');`).join('\n');

for (const scenario of ['fresh','legacy']) {
  const sql = `BEGIN;
CREATE SCHEMA ${fixtureSchema}; SET LOCAL search_path TO ${fixtureSchema};
${strip(fs.readFileSync(path.join(root,'database/schema.sql'),'utf8'))}
${strip(fs.readFileSync(path.join(root,'database/seed.sql'),'utf8'))}
${scenario === 'legacy' ? legacySql : ''}
${importSql}
DROP TABLE source_dish_ids;
${importSql}
${migrationSql()}
CREATE OR REPLACE FUNCTION pg_temp.check_erd(ok BOOLEAN,message TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '%',message; END IF; END $$;
SELECT pg_temp.check_erd(NOT EXISTS(SELECT 1 FROM pg_constraint WHERE connamespace='${fixtureSchema}'::regnamespace AND contype='f' AND NOT convalidated),'Unvalidated FK');
WITH RECURSIVE edges AS (
 SELECT conrelid AS child,confrelid AS parent FROM pg_constraint WHERE contype='f' AND connamespace='${fixtureSchema}'::regnamespace
), reached(id) AS (
 SELECT 'users'::regclass::oid UNION
 SELECT CASE WHEN e.child=r.id THEN e.parent ELSE e.child END FROM reached r JOIN edges e ON e.child=r.id OR e.parent=r.id
)
SELECT pg_temp.check_erd((SELECT count(*) FROM reached)=(SELECT count(*) FROM pg_tables WHERE schemaname='${fixtureSchema}'),'Disconnected graph');
SELECT pg_temp.check_erd(NOT EXISTS(SELECT 1 FROM source_catalog_removed_dish_references r LEFT JOIN source_catalog_removed_dishes d USING(original_dish_id) WHERE d.original_dish_id IS NULL),'Orphan archive reference');
SELECT pg_temp.check_erd(NOT EXISTS(SELECT 1 FROM source_catalog_removed_dishes WHERE import_run_id IS NULL),'Missing archive import run');
SELECT pg_temp.check_erd(NOT EXISTS(SELECT 1 FROM growth_zscores WHERE waz_standard_id IS NOT NULL OR haz_standard_id IS NOT NULL OR baz_standard_id IS NOT NULL),'Fabricated legacy WHO provenance');
DO $$ DECLARE rejected BOOLEAN; dish_key BIGINT; sample_key BIGINT; standard_key BIGINT; menu_key BIGINT; version_key BIGINT; BEGIN
 rejected:=FALSE;
 BEGIN INSERT INTO audit_logs(school_id,action) VALUES(-999999,'FK_TEST'); EXCEPTION WHEN foreign_key_violation THEN rejected:=TRUE; END;
 PERFORM pg_temp.check_erd(rejected,'Audit FK accepted an orphan');
 INSERT INTO dishes(name) VALUES('__unique_erd_test__') RETURNING id INTO dish_key;
 INSERT INTO food_samples(date,dish_name,sample_code) VALUES(CURRENT_DATE,'__unique_erd_test__','FK_TEST') RETURNING id INTO sample_key;
 PERFORM pg_temp.check_erd((SELECT dish_id=dish_key FROM food_samples WHERE id=sample_key),'Unique name did not resolve');
 DELETE FROM dishes WHERE id=dish_key;
 PERFORM pg_temp.check_erd((SELECT dish_id IS NULL AND dish_name='__unique_erd_test__' FROM food_samples WHERE id=sample_key),'Deleting a dish erased/relinked its historical sample');
 INSERT INTO dishes(name) VALUES('__ambiguous_erd_test__'),('__ambiguous_erd_test__');
 INSERT INTO food_samples(date,dish_name,sample_code) VALUES(CURRENT_DATE,'__ambiguous_erd_test__','AMBIGUOUS') RETURNING id INTO sample_key;
 PERFORM pg_temp.check_erd((SELECT dish_id IS NULL FROM food_samples WHERE id=sample_key),'Ambiguous sample was guessed');
 rejected:=FALSE;
 BEGIN UPDATE food_samples SET dish_id=-999999 WHERE id=sample_key; EXCEPTION WHEN foreign_key_violation THEN rejected:=TRUE; END;
 PERFORM pg_temp.check_erd(rejected,'Sample FK accepted an orphan');
 SELECT id INTO menu_key FROM menus ORDER BY id LIMIT 1;
 SELECT id INTO standard_key FROM nutritional_standards WHERE age_group<>(SELECT age_group FROM menus WHERE id=menu_key) LIMIT 1;
 rejected:=FALSE;
 BEGIN UPDATE menus SET nutritional_standard_id=standard_key WHERE id=menu_key; EXCEPTION WHEN check_violation THEN rejected:=TRUE; END;
 PERFORM pg_temp.check_erd(rejected,'Menu accepted a standard for the wrong age');
 SELECT id INTO version_key FROM menu_versions LIMIT 1;
 INSERT INTO menu_rule_violations(menu_version_id,rule_code,severity,message) VALUES(version_key,'DYNAMIC_ERD_TEST','WARNING','fixture');
 PERFORM pg_temp.check_erd(EXISTS(SELECT 1 FROM nutrition_rule_codes WHERE code='DYNAMIC_ERD_TEST'),'Dynamic code was not registered');
 INSERT INTO system_configs(config_key,config_value) VALUES('__scope_test__','global');
 INSERT INTO system_configs(config_key,config_value,school_id) VALUES('__scope_test__','school',(SELECT min(id) FROM schools));
 rejected:=FALSE;
 BEGIN INSERT INTO system_configs(config_key,config_value) VALUES('__scope_test__','duplicate'); EXCEPTION WHEN unique_violation THEN rejected:=TRUE; END;
 PERFORM pg_temp.check_erd(rejected,'Duplicate global config accepted');
 rejected:=FALSE;
 BEGIN UPDATE growth_zscores SET waz_standard_id=-999999 WHERE id=(SELECT min(id) FROM growth_zscores); EXCEPTION WHEN foreign_key_violation OR check_violation THEN rejected:=TRUE; END;
 PERFORM pg_temp.check_erd(rejected,'WHO FK accepted an orphan');
END $$;
ROLLBACK;`;
  try {
    execFileSync('docker',['exec','-i',container,'sh','-c',
      'exec psql -X -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { input: sql, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 60000, stdio: ['pipe','pipe','pipe'] });
    console.log(JSON.stringify({ scenario, passed: true, connected: true, idempotent: true,
      orphanRejection: true, historicalSamplesPreserved: true, dynamicRuleCodes: true, configScopes: true, rolledBack: true }));
  } catch (error) {
    console.error(String(error.stderr || error.message).split(/\r?\n/).slice(-12).join('\n'));
    process.exitCode = 1;
    break;
  }
}
