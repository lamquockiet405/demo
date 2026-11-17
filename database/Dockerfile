ARG POSTGRES_VERSION=16
FROM postgres:${POSTGRES_VERSION}-alpine

# These files travel with the image. PostgreSQL runs them for a new data volume.
COPY database/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY database/seed.sql /docker-entrypoint-initdb.d/02-seed.sql
COPY database/generated/source-catalog.sql /docker-entrypoint-initdb.d/03-source-catalog.sql
COPY database/migrations/20261103-relational-integrity.sql /docker-entrypoint-initdb.d/04-relational-integrity.sql

COPY database/migrations/20261114-preschool-only.sql /docker-entrypoint-initdb.d/05-preschool-only.sql
COPY database/migrations/20261106-daily-meal-nutrition.sql /docker-entrypoint-initdb.d/06-daily-meal-nutrition.sql
COPY database/reset_sequences.sql /docker-entrypoint-initdb.d/07-reset-sequences.sql
