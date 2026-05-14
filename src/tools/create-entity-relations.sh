#!/bin/bash

echo "🔁 Generando relaciones..."

npx ts-node src/tools/generators/generate-relations.ts

echo "✅ Relaciones generadas correctamente"