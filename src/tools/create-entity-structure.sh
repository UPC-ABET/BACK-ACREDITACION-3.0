#!/bin/bash

create_entity() {
	BASE_PATH=$1
	ENTITY=$2

	ENTITY_PATH="$BASE_PATH/$ENTITY"

	mkdir -p \
		"src/modules/$ENTITY_PATH/api/docs" \
		"src/modules/$ENTITY_PATH/config" \
		"src/modules/$ENTITY_PATH/config/strings" \
		"src/modules/$ENTITY_PATH/core" \
		"src/modules/$ENTITY_PATH/model"
	touch \
		"src/modules/$ENTITY_PATH/api/docs/${ENTITY}.swagger.ts" \
		"src/modules/$ENTITY_PATH/api/${ENTITY}.controller.ts" \
		"src/modules/$ENTITY_PATH/api/${ENTITY}.service.ts" \
		"src/modules/$ENTITY_PATH/config/${ENTITY}.routes.ts" \
		"src/modules/$ENTITY_PATH/config/strings/${ENTITY}.validation.ts" \
		"src/modules/$ENTITY_PATH/core/${ENTITY}.repository.ts" \
		"src/modules/$ENTITY_PATH/core/${ENTITY}.validation.ts" \
		"src/modules/$ENTITY_PATH/model/${ENTITY}.dtos.ts" \
		"src/modules/$ENTITY_PATH/model/${ENTITY}.entity.ts" \
		"src/modules/$ENTITY_PATH/${ENTITY}.module.ts"
}
create_entity survey notification-messages

echo "✅ Estructura creada correctamente"