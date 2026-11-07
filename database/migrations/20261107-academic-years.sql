BEGIN;

CREATE TABLE IF NOT EXISTS academic_year (
    id BIGSERIAL PRIMARY KEY,
    school_id BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED')),
    source_year_id BIGINT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT academic_year_dates CHECK (end_date > start_date),
    UNIQUE (school_id, name),
    UNIQUE (id, school_id),
    FOREIGN KEY (source_year_id, school_id) REFERENCES academic_year(id, school_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_year_active ON academic_year(school_id) WHERE status = 'ACTIVE';

ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year_id BIGINT;
DO $$ BEGIN
    ALTER TABLE classes ADD CONSTRAINT fk_classes_academic_year
        FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_year(id, school_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_year_pair ON classes(id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year_id);

CREATE TABLE IF NOT EXISTS student_academic_enrollments (
    id BIGSERIAL PRIMARY KEY,
    academic_year_id BIGINT NOT NULL REFERENCES academic_year(id) ON DELETE RESTRICT,
    class_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'ENROLLED' CHECK (status IN ('ENROLLED', 'LEFT', 'GRADUATED')),
    student_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(student_snapshot) = 'object'),
    parent_contacts JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(parent_contacts) = 'array'),
    notes TEXT NOT NULL DEFAULT '',
    UNIQUE (academic_year_id, student_id),
    FOREIGN KEY (class_id, academic_year_id) REFERENCES classes(id, academic_year_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_year_enrollments_class ON student_academic_enrollments(class_id);

-- Preserve the existing school_year values and roster before any rollover.
INSERT INTO academic_year(school_id, name, start_date, end_date, status)
SELECT c.school_id,c.school_year,
    make_date(CASE WHEN c.school_year ~ '^\d{4}' THEN left(c.school_year,4)::int ELSE 2026 END,9,1),
    make_date(CASE WHEN c.school_year ~ '^\d{4}' THEN left(c.school_year,4)::int+1 ELSE 2027 END,8,31),
    CASE WHEN c.rank=1 AND NOT EXISTS (SELECT 1 FROM academic_year a WHERE a.school_id=c.school_id AND a.status='ACTIVE')
        THEN 'ACTIVE' ELSE 'COMPLETED' END
FROM (SELECT school_id,school_year,row_number() OVER (PARTITION BY school_id ORDER BY school_year DESC) AS rank
    FROM (SELECT DISTINCT school_id,school_year FROM classes WHERE school_year<>'') legacy) c
ON CONFLICT (school_id,name) DO NOTHING;

UPDATE classes c SET academic_year_id = y.id FROM academic_year y
WHERE c.academic_year_id IS NULL AND c.school_id = y.school_id AND c.school_year = y.name;

INSERT INTO student_academic_enrollments(academic_year_id, class_id, student_id, student_snapshot, parent_contacts)
SELECT c.academic_year_id, c.id, s.id,
    jsonb_build_object('studentCode', s.student_code, 'fullName', s.full_name, 'dateOfBirth', s.date_of_birth, 'gender', s.gender),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('parentId', u.id::text, 'fullName', u.full_name,
        'phone', COALESCE(u.phone, ''), 'email', u.email, 'relationship', sp.relationship, 'isPrimary', sp.is_primary)
        ORDER BY sp.is_primary DESC, u.id)
        FROM student_parents sp JOIN users u ON u.id = sp.parent_id WHERE sp.student_id = s.id), '[]'::jsonb)
FROM students s JOIN classes c ON c.id = s.class_id WHERE c.academic_year_id IS NOT NULL
ON CONFLICT (academic_year_id, student_id) DO NOTHING;

-- Legacy student/class screens continue to update the active year's roster.
-- Completed years are deliberately excluded so their snapshots remain intact.
CREATE OR REPLACE FUNCTION sync_active_student_enrollment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_year BIGINT;
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.class_id IS DISTINCT FROM NEW.class_id THEN
        UPDATE student_academic_enrollments e SET status='LEFT'
        FROM academic_year y WHERE e.academic_year_id=y.id AND y.status='ACTIVE'
            AND e.student_id=NEW.id AND e.class_id=OLD.class_id AND e.status='ENROLLED';
    END IF;
    SELECT c.academic_year_id INTO target_year FROM classes c JOIN academic_year y ON y.id=c.academic_year_id
        WHERE c.id=NEW.class_id AND y.status='ACTIVE';
    IF target_year IS NOT NULL THEN
        INSERT INTO student_academic_enrollments(academic_year_id,class_id,student_id,student_snapshot,parent_contacts)
        VALUES (target_year,NEW.class_id,NEW.id,
            jsonb_build_object('studentCode',NEW.student_code,'fullName',NEW.full_name,'dateOfBirth',NEW.date_of_birth,'gender',NEW.gender),
            COALESCE((SELECT jsonb_agg(jsonb_build_object('parentId',u.id::text,'fullName',u.full_name,'phone',COALESCE(u.phone,''),
                'email',u.email,'relationship',sp.relationship,'isPrimary',sp.is_primary)) FROM student_parents sp JOIN users u ON u.id=sp.parent_id
                WHERE sp.student_id=NEW.id),'[]'::jsonb))
        ON CONFLICT (academic_year_id,student_id) DO UPDATE SET class_id=EXCLUDED.class_id,
            student_snapshot=EXCLUDED.student_snapshot,status='ENROLLED';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_active_student_enrollment ON students;
CREATE TRIGGER trg_active_student_enrollment AFTER INSERT OR UPDATE OF class_id,student_code,full_name,date_of_birth,gender
    ON students FOR EACH ROW EXECUTE FUNCTION sync_active_student_enrollment();

CREATE OR REPLACE FUNCTION refresh_active_parent_contacts(target_student BIGINT) RETURNS void LANGUAGE sql AS $$
    UPDATE student_academic_enrollments e SET parent_contacts=COALESCE((
        SELECT jsonb_agg(jsonb_build_object('parentId',u.id::text,'fullName',u.full_name,'phone',COALESCE(u.phone,''),
            'email',u.email,'relationship',sp.relationship,'isPrimary',sp.is_primary) ORDER BY sp.is_primary DESC,u.id)
        FROM student_parents sp JOIN users u ON u.id=sp.parent_id WHERE sp.student_id=target_student),'[]'::jsonb)
    FROM academic_year y WHERE y.id=e.academic_year_id AND y.status='ACTIVE' AND e.student_id=target_student;
$$;
CREATE OR REPLACE FUNCTION sync_active_parent_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE','DELETE') THEN PERFORM refresh_active_parent_contacts(OLD.student_id); END IF;
    IF TG_OP IN ('INSERT','UPDATE') THEN PERFORM refresh_active_parent_contacts(NEW.student_id); END IF;
    RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_active_parent_link ON student_parents;
CREATE TRIGGER trg_active_parent_link AFTER INSERT OR UPDATE OR DELETE ON student_parents FOR EACH ROW EXECUTE FUNCTION sync_active_parent_link();
CREATE OR REPLACE FUNCTION sync_active_parent_profile() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE link RECORD;
BEGIN
    FOR link IN SELECT student_id FROM student_parents WHERE parent_id=NEW.id LOOP
        PERFORM refresh_active_parent_contacts(link.student_id);
    END LOOP;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_active_parent_profile ON users;
CREATE TRIGGER trg_active_parent_profile AFTER UPDATE OF full_name,phone,email ON users FOR EACH ROW EXECUTE FUNCTION sync_active_parent_profile();

COMMIT;
