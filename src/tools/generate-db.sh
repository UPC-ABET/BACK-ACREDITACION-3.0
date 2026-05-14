#!/bin/bash

set -e  # 🔥 Detiene todo si algo falla

# ================================
# VALIDAR PARÁMETRO
# ================================
if [ -z "$1" ]; then
  echo "❌ Debes indicar el tenant"
  echo "👉 Uso: ./setup.sh upc"
  exit 1
fi

TENANT=$1

echo "🚀 Iniciando proceso completo para tenant: $TENANT"

# ================================
# STEP 0: GENERAR ENTIDADES
# ================================
echo "🏗️ Generando entidades..."
npm run create:entity-full

# ================================
# LIMPIAR MIGRACIONES
# ================================
echo "🧹 Limpiando carpeta de migraciones..."
rm -rf src/database/migrations/*

# ================================
# DROP SCHEMA
# ================================
echo "🗑️ Eliminando schema..."
npx ts-node src/database/scripts/seeds/$TENANT/0-drop-schema.ts $TENANT

# ================================
# GENERAR MIGRACIÓN
# ================================
echo "🛠️ Generando migración..."
npm run migration:generate -- src/database/migrations/Init 

# ================================
# COPIAR INIT → DBDIAGRAM
# ================================
echo "📄 Copiando Init a db-init.ts..."

INIT_FILE=$(ls src/database/migrations/*Init*.ts | head -n 1)

if [ -z "$INIT_FILE" ]; then
  echo "❌ No se encontró archivo Init en migrations"
  exit 1
fi

cp "$INIT_FILE" src/tools/generators/dbdiagram-utils/db-init.ts

# ================================
# GENERAR DB DIAGRAM
# ================================
echo "🧩 Generando dbdiagram..."
npm run create:dbdiagram

# ================================
# EJECUTAR MIGRACIÓN
# ================================
echo "📦 Ejecutando migraciones..."
npm run migrate:tenant $TENANT

# ================================
# SEEDS
# ================================
echo "🌱 Ejecutando seeds..."

npx ts-node src/database/scripts/seeds/$TENANT/1-load-types.ts $TENANT

echo "✅ Proceso completado correctamente para tenant: $TENANT"