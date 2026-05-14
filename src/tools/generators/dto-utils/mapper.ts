import { DB_LENGTH_CODE, DB_LENGTH_EMAIL, DB_LENGTH_NAME, DB_LENGTH_PHONE, DB_LENGTH_TEXT_LARGE, DB_LENGTH_TEXT_MEDIUM, DB_LENGTH_TEXT_SHORT } from 'src/commons/configs/db.configs';

export function mapTypeFromDecorator(decorators: string[], name: string) {
	if (decorators.includes('EmailColumn')) return 'string';
	if (decorators.includes('PhoneColumn')) return 'string';
	if (decorators.includes('NameColumn')) return 'string';
	if (decorators.includes('TextShortColumn')) return 'string';
	if (decorators.includes('TextMediumColumn')) return 'string';
	if (decorators.includes('TextLargeColumn')) return 'string';
	if (decorators.includes('TextFullColumn')) return 'string';

	if (decorators.includes('IntegerColumn')) return 'number';
	if (decorators.includes('IntegerFKIDColumn')) return 'number';

	if (decorators.includes('DecimalColumn')) return 'number';

	if (decorators.includes('BooleanColumn')) return 'boolean';

	if (decorators.includes('DateColumn')) return 'Date';

	if (decorators.includes('JsonColumn')) return 'any';

	// 🔥 RELACIÓN FK fallback
	if (name.endsWith('_id')) return 'number';

	// ❌ TODO lo demás no debería existir en DTO
	return 'never';
}

export function mapValidator(type: string) {
	if (type === 'string') return '@IsString()';
	if (type === 'number') return '@IsNumber()';
	if (type === 'boolean') return '@IsBoolean()';
	if (type === 'Date') return '@IsDate()';

	return '';
}

export function mapLength(decorators: string[]) {
	if (decorators.includes('EmailColumn')) return DB_LENGTH_EMAIL;
	if (decorators.includes('NameColumn')) return DB_LENGTH_NAME;
	if (decorators.includes('PhoneColumn')) return DB_LENGTH_PHONE;

	if (decorators.includes('TextShortColumn')) return DB_LENGTH_TEXT_SHORT;
	if (decorators.includes('TextMediumColumn')) return DB_LENGTH_TEXT_MEDIUM;
	if (decorators.includes('TextLargeColumn')) return DB_LENGTH_TEXT_LARGE;

	if (decorators.includes('CodeColumn')) return DB_LENGTH_CODE;

	return null;
}

export function mapExample(type: string, name: string, decorators: string[] = []) {
	if (decorators.includes('JsonColumn')) {
		return `{ key: "${name}_value" }`;
	}

	if (type === 'string') return `'${name}_example'`;
	if (type === 'number') return 1;
	if (type === 'boolean') return true;
	if (type === 'Date') return `'2024-01-01T00:00:00Z'`;

	return `'${name}'`;
}
