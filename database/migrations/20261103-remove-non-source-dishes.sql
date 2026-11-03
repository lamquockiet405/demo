-- Audit copies do not belong to the application's live dish catalog.
CREATE TABLE IF NOT EXISTS source_catalog_removed_dishes (
    original_dish_id BIGINT PRIMARY KEY,
    dish JSONB NOT NULL,
    source_documents JSONB NOT NULL,
    reason TEXT NOT NULL DEFAULT 'NOT_IN_SOURCE_DOC',
    removed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS source_catalog_removed_dish_references (
    original_dish_id BIGINT NOT NULL,
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    column_name TEXT NOT NULL,
    row_hash TEXT NOT NULL,
    row_data JSONB NOT NULL,
    PRIMARY KEY (original_dish_id, table_schema, table_name, column_name, row_hash)
);
