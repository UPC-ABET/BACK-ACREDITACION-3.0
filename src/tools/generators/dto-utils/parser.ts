// src/tools/dto-utils/parser.ts
import { mapTypeFromDecorator } from './mapper';
import { project } from './project'; // 🔥 IMPORT GLOBAL

export function parseEntity(filePath: string) {
	const file = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);
	const cls = file.getClasses()[0];

	if (!cls) {
		throw new Error('No se encontró clase en la entidad');
	}

	const entityName = cls.getName();

	let properties = [...cls.getProperties()];

	// 🔥 HERENCIA (BaseEntity)
	let base = cls.getBaseClass();
	while (base) {
		properties = [...base.getProperties(), ...properties];
		base = base.getBaseClass();
	}

	const fields = properties.map((prop) => {
		const name = prop.getName();

		const decorators = prop.getDecorators().map((d) => d.getName());

		const type = mapTypeFromDecorator(decorators, name);

		const isOptional = prop.hasQuestionToken() || prop.getText().includes('nullable: true');

		return {
			name,
			type,
			decorators, // 🔥 IMPORTANTE (ya lo usas luego)
			isOptional,
		};
	});

	return { entityName, fields };
}
