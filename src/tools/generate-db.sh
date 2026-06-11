#!/bin/bash

set -e

SEEDS_DIR=src/database/scripts/seeds/upc

echo "Starting full DB setup"

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
echo "Dropping schemas..."
npx ts-node $SEEDS_DIR/0-drop-schema.ts

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
npm run migration:run

# ================================
# SEEDS
# ================================
echo "Running seeds..."

npx ts-node $SEEDS_DIR/1-load-types.ts

echo "Done. All steps completed."
