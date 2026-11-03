FROM postgres:16-alpine

# These files travel with the image. PostgreSQL runs them for a new data volume.
COPY database/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY database/seed.sql /docker-entrypoint-initdb.d/02-seed.sql
COPY database/generated/source-catalog.sql /docker-entrypoint-initdb.d/03-source-catalog.sql
COPY database/migrations/20261103-relational-integrity.sql /docker-entrypoint-initdb.d/04-relational-integrity.sql
COPY database/reset_sequences.sql /docker-entrypoint-initdb.d/05-reset-sequences.sql
COPY database/docker-test-runtime.sql /docker-entrypoint-initdb.d/06-test-runtime.sql
