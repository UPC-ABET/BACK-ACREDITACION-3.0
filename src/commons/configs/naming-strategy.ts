import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Extends SnakeNamingStrategy to use uppercase prefixes for auto-generated
 * constraint and index names. Matches the project convention:
 *
 *   - `PK_<table>`            primary keys
 *   - `UQ_<table>_<columns>`  unique constraints
 *   - `FK_<table>_<columns>`  foreign keys
 *   - `IDX_<table>_<columns>` indexes (`REL_` for inverse-relation indexes)
 *
 * Explicit names passed to `@JoinColumn({ foreignKeyConstraintName })`,
 * `@Unique('UQ_...', [...])`, or `@Index('IDX_...', [...])` always win — this
 * strategy only kicks in when TypeORM has to invent a name.
 */
export class UpperPrefixSnakeNamingStrategy extends SnakeNamingStrategy {
	primaryKeyName(tableOrName: any, columnNames: string[]): string {
		const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
		const cleanTable = table.replace(/^.+\./, '');
		return columnNames.length === 1 && columnNames[0] === 'id'
			? `PK_${cleanTable}`
			: `PK_${cleanTable}_${columnNames.join('_')}`;
	}

	uniqueConstraintName(tableOrName: any, columnNames: string[]): string {
		const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
		const cleanTable = table.replace(/^.+\./, '');
		return `UQ_${cleanTable}_${columnNames.join('_')}`;
	}

	foreignKeyName(
		tableOrName: any,
		columnNames: string[],
		_referencedTablePath?: string,
		_referencedColumnNames?: string[],
	): string {
		const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
		const cleanTable = table.replace(/^.+\./, '');
		return `FK_${cleanTable}_${columnNames.join('_')}`;
	}

	indexName(tableOrName: any, columnNames: string[], where?: string): string {
		const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
		const cleanTable = table.replace(/^.+\./, '');
		const suffix = where ? `_${where.replace(/\W+/g, '_')}` : '';
		return `IDX_${cleanTable}_${columnNames.join('_')}${suffix}`;
	}

	relationConstraintName(tableOrName: any, columnNames: string[], where?: string): string {
		const table = typeof tableOrName === 'string' ? tableOrName : tableOrName.name;
		const cleanTable = table.replace(/^.+\./, '');
		const suffix = where ? `_${where.replace(/\W+/g, '_')}` : '';
		return `REL_${cleanTable}_${columnNames.join('_')}${suffix}`;
	}
}
