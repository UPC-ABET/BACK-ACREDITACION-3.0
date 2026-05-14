#!/bin/bash

INPUT=${1:-src/tools/generators/dbdiagram-utils/db-init.ts}
OUTPUT=${2:-src/tools/generators/dbdiagram-utils/output.dbml}

npx ts-node src/tools/generators/generate-dbdiagram.ts "$INPUT" "$OUTPUT"