#!/bin/bash

set -e

# ================================
# VALIDATE PARAMETER
# ================================
if [ -z "$1" ]; then
  echo "Tenant required. Usage: ./generate-db.sh <tenant>"
  exit 1
fi

TENANT=$1

echo "Starting full DB setup for tenant: $TENANT"

# ================================
# STEP 0: GENERATE ENTITIES
# ================================
echo "Generating entities..."
npm run create:entity-full

# ================================
# CLEAN MIGRATIONS
# ================================
echo "Cleaning migrations folder..."
rm -rf src/database/migrations/*

# ================================
# DROP SCHEMA
# ================================
echo "Dropping schema..."
npx ts-node src/database/scripts/seeds/$TENANT/0-drop-schema.ts $TENANT

# ================================
# GENERATE MIGRATION
# ================================
echo "Generating migration..."
npm run migration:generate -- src/database/migrations/Init

# ================================
# COPY INIT -> DBDIAGRAM
# ================================
echo "Copying Init to db-init.ts..."

INIT_FILE=$(ls src/database/migrations/*Init*.ts | head -n 1)

if [ -z "$INIT_FILE" ]; then
  echo "Init file not found in migrations"
  exit 1
fi

cp "$INIT_FILE" src/tools/generators/dbdiagram-utils/db-init.ts

# ================================
# GENERATE DB DIAGRAM
# ================================
echo "Generating dbdiagram..."
npm run create:dbdiagram

# ================================
# RUN MIGRATION
# ================================
echo "Running migrations..."
npm run migrate:tenant $TENANT

# ================================
# SEEDS
# ================================
echo "Running seeds..."

npx ts-node src/database/scripts/seeds/$TENANT/1-load-types.ts $TENANT

echo "Done. All steps completed for tenant: $TENANT"
