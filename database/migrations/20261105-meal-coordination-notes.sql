-- Shared teacher/kitchen workflow. Keep legacy meal_notes and their contents intact.
CREATE TABLE IF NOT EXISTS meal_coordination_notes (
  id bigserial PRIMARY KEY,
  class_id bigint NOT NULL REFERENCES classes(id),
  child_id bigint REFERENCES students(id) ON DELETE SET NULL,
  meal_date date NOT NULL,
  meal_session varchar(30) NOT NULL DEFAULT 'LUNCH',
  meal_session_label varchar(100) NOT NULL,
  note_type varchar(50) NOT NULL DEFAULT 'OTHER',
  note_type_label varchar(150) NOT NULL,
  priority varchar(20) NOT NULL DEFAULT 'NORMAL',
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  title text NOT NULL,
  content text NOT NULL,
  teacher_name varchar(255) NOT NULL,
  target_role varchar(30) NOT NULL DEFAULT 'KITCHEN',
  target_role_label varchar(150) NOT NULL,
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  kitchen_acknowledged boolean NOT NULL DEFAULT false,
  kitchen_acknowledged_by varchar(255),
  kitchen_acknowledged_at timestamptz,
  kitchen_response text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meal_coordination_class_date
  ON meal_coordination_notes(class_id, meal_date, created_at DESC);
