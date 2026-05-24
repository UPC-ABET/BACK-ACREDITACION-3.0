import { mapTypeFromDecorator } from './mapper';
import { project } from './project';

export function parseEntity(filePath: string) {
	const file = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);
	const cls = file.getClasses()[0];

	if (!cls) {
		throw new Error('No class found in entity');
	}

	const entityName = cls.getName();

	let properties = [...cls.getProperties()];

	let base = cls.getBaseClass();
	while (base) {
		properties = [...base.getProperties(), ...properties];
		base = base.getBaseClass();
	}

	const fields = properties.map((prop) => {
		const name = prop.getName();

		const decorators = prop.getDecorators().map((d) => d.getName());

		const tsType = prop.getTypeNode()?.getText();

		const type = mapTypeFromDecorator(decorators, name, tsType);

		const isOptional = prop.hasQuestionToken() || prop.getText().includes('nullable: true');

		return {
			name,
			type,
			decorators,
			isOptional,
		};
	});

	return { entityName, fields };
}
