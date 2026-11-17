-- KidMeal serves ages 3 through 6 (third birthday up to, excluding, seventh).
-- Keep historical student records and archive unsupported configuration before removal.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('kidmeal-preschool-only'));

CREATE TABLE IF NOT EXISTS preschool_scope_archive (
    table_name TEXT NOT NULL,
    original_id BIGINT NOT NULL,
    row_data JSONB NOT NULL,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (table_name, original_id)
);

DO $$
DECLARE tab TEXT; unsupported BOOLEAN;
BEGIN
    FOREACH tab IN ARRAY ARRAY['nutritional_standards', 'nutrition_intake_standards',
                               'dish_frequency_rules', 'dish_spacing_rules'] LOOP
        EXECUTE format('INSERT INTO preschool_scope_archive(table_name,original_id,row_data)
            SELECT %L,id,to_jsonb(t) FROM %I t WHERE age_group NOT IN (''MAU_GIAO''%s)
            ON CONFLICT DO NOTHING', tab, tab,
            CASE WHEN tab IN ('dish_frequency_rules','dish_spacing_rules') THEN ',''ALL''' ELSE '' END);
        EXECUTE format('DELETE FROM %I WHERE age_group NOT IN (''MAU_GIAO''%s)', tab,
            CASE WHEN tab IN ('dish_frequency_rules','dish_spacing_rules') THEN ',''ALL''' ELSE '' END);
    END LOOP;
    -- Never relabel a nursery class/menu as preschool or silently discard its history.
    FOREACH tab IN ARRAY ARRAY['classes','menu_cycles','menus'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=tab AND column_name='age_group') THEN
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE age_group <> ''MAU_GIAO'')', tab) INTO unsupported;
            IF unsupported THEN RAISE EXCEPTION 'Unsupported age groups in %. Review historical records before migration.', tab; END IF;
        END IF;
    END LOOP;
END $$;

-- Replacing the existing named checks also prevents older imports reintroducing nursery data.
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_age_group_check;
ALTER TABLE classes ADD CONSTRAINT classes_age_group_check CHECK (age_group = 'MAU_GIAO');
ALTER TABLE menu_cycles DROP CONSTRAINT IF EXISTS menu_cycles_age_group_check;
ALTER TABLE menu_cycles ADD CONSTRAINT menu_cycles_age_group_check CHECK (age_group = 'MAU_GIAO');
ALTER TABLE menus DROP CONSTRAINT IF EXISTS menus_age_group_check;
ALTER TABLE menus ADD CONSTRAINT menus_age_group_check CHECK (age_group = 'MAU_GIAO');
ALTER TABLE nutritional_standards DROP CONSTRAINT IF EXISTS nutritional_standards_age_group_check;
ALTER TABLE nutritional_standards ADD CONSTRAINT nutritional_standards_age_group_check CHECK (age_group = 'MAU_GIAO');
ALTER TABLE nutrition_intake_standards DROP CONSTRAINT IF EXISTS nutrition_intake_standards_age_group_check;
ALTER TABLE nutrition_intake_standards ADD CONSTRAINT nutrition_intake_standards_age_group_check CHECK (age_group = 'MAU_GIAO');
ALTER TABLE dish_frequency_rules DROP CONSTRAINT IF EXISTS dish_frequency_rules_age_group_check;
ALTER TABLE dish_frequency_rules ADD CONSTRAINT dish_frequency_rules_age_group_check CHECK (age_group IN ('MAU_GIAO','ALL'));
ALTER TABLE dish_spacing_rules DROP CONSTRAINT IF EXISTS dish_spacing_rules_age_group_check;
ALTER TABLE dish_spacing_rules ADD CONSTRAINT dish_spacing_rules_age_group_check CHECK (age_group IN ('MAU_GIAO','ALL'));

INSERT INTO preschool_scope_archive(table_name,original_id,row_data)
    SELECT 'system_configs',id,to_jsonb(c) FROM system_configs c
    WHERE config_key='DAYBOARDING_ENERGY_TARGET' ON CONFLICT DO NOTHING;
UPDATE system_configs SET config_value=jsonb_build_object('MAU_GIAO',config_value::jsonb->'MAU_GIAO')::text
    WHERE config_key='DAYBOARDING_ENERGY_TARGET';
UPDATE system_configs SET config_value='{"minYears":3,"maxYearsInclusive":6,"ageGroup":"MAU_GIAO"}',
    description='Chỉ phục vụ trẻ từ đủ 3 tuổi đến trước sinh nhật 7 tuổi; ALL chỉ gồm các lớp mẫu giáo.'
    WHERE config_key='SUPPORTED_CHILD_AGES';
INSERT INTO system_configs(config_key,config_value,description)
SELECT 'SUPPORTED_CHILD_AGES','{"minYears":3,"maxYearsInclusive":6,"ageGroup":"MAU_GIAO"}',
        'Chỉ phục vụ trẻ từ đủ 3 tuổi đến trước sinh nhật 7 tuổi; ALL chỉ gồm các lớp mẫu giáo.'
WHERE NOT EXISTS (SELECT 1 FROM system_configs c WHERE config_key='SUPPORTED_CHILD_AGES'
    AND to_jsonb(c)->>'school_id' IS NULL);

CREATE OR REPLACE FUNCTION kidmeal_preschool_age_eligible(birthday DATE, reference_date DATE)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT reference_date >= (birthday + INTERVAL '3 years')::date
       AND reference_date < (birthday + INTERVAL '7 years')::date;
$$;

CREATE OR REPLACE FUNCTION kidmeal_school_today() RETURNS DATE LANGUAGE sql STABLE AS $$
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
$$;

-- A changing clock must not be used in a CHECK constraint. Validate admission on writes,
-- and use this view for current eligibility when a pupil has aged out since admission.
CREATE OR REPLACE VIEW preschool_service_students AS
    SELECT s.* FROM students s JOIN classes c ON c.id=s.class_id
    WHERE s.status='ACTIVE' AND c.status='ACTIVE' AND c.age_group='MAU_GIAO'
      AND kidmeal_preschool_age_eligible(s.date_of_birth,kidmeal_school_today());

CREATE OR REPLACE FUNCTION enforce_preschool_student_age() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status='ACTIVE' AND
       (TG_OP='INSERT' OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
        OR NEW.class_id IS DISTINCT FROM OLD.class_id OR NEW.status IS DISTINCT FROM OLD.status) AND
       NOT kidmeal_preschool_age_eligible(NEW.date_of_birth,kidmeal_school_today()) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='KidMeal chỉ phục vụ trẻ từ 3 đến 6 tuổi';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_preschool_student_age ON students;
CREATE TRIGGER trg_preschool_student_age BEFORE INSERT OR UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION enforce_preschool_student_age();

-- Preserve completed-year history. Draft rosters use the later of today/year start.
CREATE OR REPLACE FUNCTION enforce_preschool_enrollment_age() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE year_status TEXT; starts DATE;
BEGIN
    IF NEW.status <> 'ENROLLED' THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND NEW.class_id=OLD.class_id AND NEW.academic_year_id=OLD.academic_year_id
       AND NEW.status=OLD.status AND NEW.student_id=OLD.student_id
       AND NEW.student_snapshot->>'dateOfBirth' IS NOT DISTINCT FROM OLD.student_snapshot->>'dateOfBirth' THEN
        RETURN NEW;
    END IF;
    SELECT status,start_date INTO year_status,starts FROM academic_year WHERE id=NEW.academic_year_id;
    IF year_status <> 'COMPLETED' AND NOT COALESCE(kidmeal_preschool_age_eligible(
        (NEW.student_snapshot->>'dateOfBirth')::date,GREATEST(starts,kidmeal_school_today())),FALSE) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='KidMeal chỉ nhận học sinh từ 3 đến 6 tuổi trong năm học';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_preschool_enrollment_age ON student_academic_enrollments;
CREATE TRIGGER trg_preschool_enrollment_age BEFORE INSERT OR UPDATE ON student_academic_enrollments
    FOR EACH ROW EXECUTE FUNCTION enforce_preschool_enrollment_age();

CREATE OR REPLACE FUNCTION enforce_preschool_year_activation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status='ACTIVE' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.start_date IS DISTINCT FROM NEW.start_date) AND EXISTS (
        SELECT 1 FROM student_academic_enrollments e WHERE e.academic_year_id=NEW.id AND e.status='ENROLLED'
          AND NOT COALESCE(kidmeal_preschool_age_eligible((e.student_snapshot->>'dateOfBirth')::date,
              GREATEST(NEW.start_date,kidmeal_school_today())),FALSE)
    ) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Danh sách năm học có học sinh ngoài độ tuổi 3–6';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_preschool_year_activation ON academic_year;
CREATE TRIGGER trg_preschool_year_activation BEFORE INSERT OR UPDATE ON academic_year
    FOR EACH ROW EXECUTE FUNCTION enforce_preschool_year_activation();

CREATE OR REPLACE FUNCTION enforce_preschool_snack_registration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE birthday DATE; starts DATE; student_status TEXT;
BEGIN
    IF NEW.status='CANCELLED' THEN RETURN NEW; END IF;
    SELECT date_of_birth,status INTO birthday,student_status FROM students WHERE id=NEW.student_id;
    SELECT start_date INTO starts FROM snack_service_periods WHERE id=NEW.period_id;
    IF student_status <> 'ACTIVE' OR NOT kidmeal_preschool_age_eligible(birthday,GREATEST(starts,kidmeal_school_today())) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Chỉ đăng ký bữa xế cho trẻ từ 3 đến 6 tuổi';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_preschool_snack_registration ON snack_registrations;
CREATE TRIGGER trg_preschool_snack_registration BEFORE INSERT OR UPDATE ON snack_registrations
    FOR EACH ROW EXECUTE FUNCTION enforce_preschool_snack_registration();

-- New/current meal records cannot serve an out-of-scope pupil. Old records stay readable.
CREATE OR REPLACE FUNCTION enforce_preschool_meal_age() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE birthday DATE; student_status TEXT;
BEGIN
    IF NEW.date < kidmeal_school_today() THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME='snack_daily_rosters' AND to_jsonb(NEW)->>'status' IN ('CANCELLED','ABSENT') THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME='meal_attendances' AND to_jsonb(NEW)->>'is_attended'='false' THEN RETURN NEW; END IF;
    SELECT date_of_birth,status INTO birthday,student_status FROM students WHERE id=NEW.student_id;
    IF student_status <> 'ACTIVE' OR NOT kidmeal_preschool_age_eligible(birthday,NEW.date) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Chỉ phục vụ bữa ăn cho trẻ từ 3 đến 6 tuổi';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_preschool_meal_age ON meal_attendances;
CREATE TRIGGER trg_preschool_meal_age BEFORE INSERT OR UPDATE ON meal_attendances
    FOR EACH ROW EXECUTE FUNCTION enforce_preschool_meal_age();
DROP TRIGGER IF EXISTS trg_preschool_snack_age ON snack_daily_rosters;
CREATE TRIGGER trg_preschool_snack_age BEFORE INSERT OR UPDATE ON snack_daily_rosters
    FOR EACH ROW EXECUTE FUNCTION enforce_preschool_meal_age();
COMMIT;
