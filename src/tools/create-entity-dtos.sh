#!/bin/bash

DOMAIN=$1
MODULE=$2

# 🔥 SI HAY PARAMETROS
if [ ! -z "$DOMAIN" ] && [ ! -z "$MODULE" ]; then
  npx ts-node -r tsconfig-paths/register src/tools/generators/generate-dtos.ts $DOMAIN $MODULE
  exit 0
fi

# 🔥 SI NO HAY PARAMETROS → MASIVO
npx ts-node -r tsconfig-paths/register src/tools/generators/generate-dtos.ts