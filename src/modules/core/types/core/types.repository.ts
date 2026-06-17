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

	/**
	 * Active types belonging to a type group, looked up by the group's code.
	 * Returns the IAM-facing shape: id, typeGroupId, code, name, description, extra.
	 */
	async setCanEvaluate(
		id: number,
		canEvaluate: boolean,
		maxEvaluators?: number | null,
	): Promise<void> {
		await this.dataSource.query(
			`UPDATE core.types
			 SET extra = COALESCE(extra, '{}'::jsonb)
			           || jsonb_build_object('can_evaluate', $1::boolean)
			           || CASE
			                WHEN $3::text IS NULL THEN jsonb_build_object('max_evaluators', NULL)
			                ELSE jsonb_build_object('max_evaluators', $3::int)
			              END,
			     updated_at = now()
			 WHERE id = $2`,
			[canEvaluate, id, maxEvaluators ?? null],
		);
	}

	async findByGroupCode(groupCode: string) {
		const rows = await this.dataSource.query(
			`SELECT t.id::int AS id,
			        t.type_group_id AS "typeGroupId",
			        t.code,
			        t.name,
			        t.description,
			        t.extra
			 FROM core.types t
			 JOIN core.type_groups g ON g.id = t.type_group_id
			 WHERE g.code = $1 AND t.is_active = true
			 ORDER BY NULLIF(t.extra->>'order', '')::int NULLS LAST, t.code`,
			[groupCode],
		);

		return rows;
	}
}
