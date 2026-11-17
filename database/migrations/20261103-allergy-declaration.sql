BEGIN;
SET LOCAL lock_timeout='5s';
ALTER TABLE student_allergies DROP CONSTRAINT IF EXISTS student_allergies_severity_check;
ALTER TABLE student_allergies ADD CONSTRAINT student_allergies_severity_check
  CHECK (severity IN ('LOW','MEDIUM','HIGH','MILD','MODERATE','SEVERE','ANAPHYLACTIC'));
COMMIT;
