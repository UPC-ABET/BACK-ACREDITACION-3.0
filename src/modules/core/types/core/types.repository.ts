import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { TypeEntity } from '../model/types.entity';

export class TypeRepository extends BaseRepository<TypeEntity> {
	constructor(
		@InjectRepository(TypeEntity)
		repository: Repository<TypeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/**
	 * Builds the next sequential type code for a group: `<groupCode>-T<NNN>`
	 * (e.g. TG2001-T016). Returns null when the group does not exist.
	 */
	async generateNextCode(typeGroupId: number): Promise<string | null> {
		const rows = await this.dataSource.query(
			`SELECT g.code AS "groupCode",
			        COALESCE(MAX((substring(t.code from '-T([0-9]+)$'))::int), 0) AS "maxNumber"
			 FROM core.type_groups g
			 LEFT JOIN core.types t ON t.type_group_id = g.id
			 WHERE g.id = $1
			 GROUP BY g.code`,
			[typeGroupId],
		);

		if (!rows.length) return null;

		const groupCode = String(rows[0].groupCode);
		const nextNumber = Number(rows[0].maxNumber) + 1;
		return `${groupCode}-T${String(nextNumber).padStart(3, '0')}`;
	}
}
