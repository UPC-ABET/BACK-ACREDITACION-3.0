import { Column, Index, ColumnOptions } from 'typeorm';

export const DB_LENGTH_EMAIL = 254;
export const DB_LENGTH_NAME = 255;
export const DB_LENGTH_CODE = 50;
export const DB_LENGTH_PHONE = 20;
export const DB_LENGTH_PASSWORD = 255;

export const DB_LENGTH_TEXT_SHORT = 100;
export const DB_LENGTH_TEXT_MEDIUM = 1000;
export const DB_LENGTH_TEXT_LARGE = 5000;

export const DB_PRECISION_DECIMAL = 12;
export const DB_SCALE_DECIMAL = 6;

export const DB_DEFAULT_EMAIL = null;
export const DB_DEFAULT_NAME = '';
export const DB_DEFAULT_PHONE = '-';
export const DB_DEFAULT_TEXT = '';
export const DB_DEFAULT_INT = 0;
export const DB_DEFAULT_DECIMAL = 0.0;
export const DB_DEFAULT_BOOLEAN = false;
export const DB_DEFAULT_DATE = () => 'CURRENT_TIMESTAMP';
export const DB_DEFAULT_JSON = () => "'{}'";

type BaseOptions = Partial<ColumnOptions> & {
	unique?: boolean;
	indexed?: boolean;
	indexName?: string;
	withDefault?: boolean;
};

// %%CORE ENGINE (NO TOCAR)
function applyColumn(
	target: any,
	propertyKey: string | symbol,
	base: ColumnOptions,
	options?: BaseOptions,
) {
	const { unique = false, indexed = false, indexName, ...rest } = options || {};

	const columnOptions: ColumnOptions = {
		...base,
		...rest,
	};

	Column(columnOptions)(target, propertyKey);

	if (unique || indexed) {
		const tableName = target.constructor.name
			.replace(/Entity$/, '')
			.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
			.toLowerCase();
		const name = indexName || `IDX_${tableName}_${String(propertyKey).toLowerCase()}`;

		Index(name, { unique })(target, propertyKey);
	}
}

export function EmailColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = false, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_EMAIL,
				nullable,
				...(withDefault && { default: DB_DEFAULT_EMAIL }),
				unique,
			},
			rest,
		);
	};
}
export function NameColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = false, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_NAME,
				nullable,
				...(withDefault && { default: DB_DEFAULT_NAME }),
				unique: false,
			},
			rest,
		);
	};
}
export function CodeColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = false, unique = true, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_CODE,
				nullable: false,
				unique,
			},
			rest,
		);
	};
}
export function PasswordColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = false, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_PASSWORD,
				select: false,
				nullable,
				unique: false,
			},
			rest,
		);
	};
}
export function PhoneColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_PHONE,
				nullable,
				...(withDefault && { default: DB_DEFAULT_PHONE }),
				unique,
			},
			rest,
		);
	};
}
export function TextShortColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_TEXT_SHORT,
				nullable,
				...(withDefault && { default: DB_DEFAULT_TEXT }),
				unique: false,
			},
			rest,
		);
	};
}
export function TextMediumColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_TEXT_MEDIUM,
				nullable,
				...(withDefault && { default: DB_DEFAULT_TEXT }),
				unique: false,
			},
			rest,
		);
	};
}
export function TextLargeColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'varchar',
				length: DB_LENGTH_TEXT_LARGE,
				nullable,
				...(withDefault && { default: DB_DEFAULT_TEXT }),
				unique: false,
			},
			rest,
		);
	};
}
export function TextFullColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'text',
				nullable,
				...(withDefault && { default: DB_DEFAULT_TEXT }),
				unique: false,
			},
			rest,
		);
	};
}
export function IntegerFKIDColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = false, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'int',
				nullable,
				unique: false,
			},
			rest,
		);
	};
}
export function IntegerColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'int',
				nullable,
				...(withDefault && { default: DB_DEFAULT_INT }),
				unique: false,
			},
			rest,
		);
	};
}

const numericTransformer = {
	to: (v: number | null | undefined) => v,
	from: (v: string | number | null | undefined) =>
		v !== null && v !== undefined ? parseFloat(v as string) : null,
};

export function DecimalColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = false, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'numeric',
				precision: DB_PRECISION_DECIMAL,
				scale: DB_SCALE_DECIMAL,
				nullable,
				transformer: numericTransformer,
				...(withDefault && { default: DB_DEFAULT_DECIMAL }),
				unique: false,
			},
			rest,
		);
	};
}
export function BooleanColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = true, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'boolean',
				nullable,
				...(withDefault && { default: DB_DEFAULT_BOOLEAN }),
				unique: false,
			},
			rest,
		);
	};
}
export function DateColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = true, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'timestamptz',
				nullable,
				...(withDefault && { default: DB_DEFAULT_DATE }),
				unique: false,
			},
			rest,
		);
	};
}
export function JsonColumn(options?: BaseOptions): PropertyDecorator {
	return (target, propertyKey) => {
		const { withDefault = true, nullable = true, unique = false, ...rest } = options || {};
		applyColumn(
			target,
			propertyKey,
			{
				type: 'jsonb',
				nullable,
				...(withDefault && { default: DB_DEFAULT_JSON }),
				unique: false,
			},
			rest,
		);
	};
}
