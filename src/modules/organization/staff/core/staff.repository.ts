import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import type { I18nText } from 'src/shared/types/i18n';
import { StaffEntity } from '../model/staff.entity';

export interface StaffLookupRow {
	id: number;
	professorCode: string | null;
	firstName: string;
	lastName: string;
	jobTitle: I18nText;
	total: number;
}

export class StaffRepository extends BaseRepository<StaffEntity> {
	constructor(
		@InjectRepository(StaffEntity)
		repository: Repository<StaffEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findLookupPage(
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[StaffLookupRow[], number]> {
		const params: Array<string | number> = [];
		let searchCondition = '';
		if (search?.trim()) {
			params.push(`%${search.trim()}%`);
			searchCondition = `AND (
				prof.code ILIKE $${params.length}
				OR COALESCE(u.first_name, s.first_name) ILIKE $${params.length}
				OR COALESCE(u.last_name, s.last_name) ILIKE $${params.length}
			)`;
		}

		params.push(take);
		const limitParam = `$${params.length}`;
		params.push(skip);
		const offsetParam = `$${params.length}`;

		const rows: StaffLookupRow[] = await this.dataSource.query(
			`SELECT
				s.id                                 AS "id",
				prof.code                            AS "professorCode",
				COALESCE(u.first_name, s.first_name) AS "firstName",
				COALESCE(u.last_name, s.last_name)   AS "lastName",
				s.job_title                          AS "jobTitle",
				COUNT(*) OVER()::int                 AS "total"
			FROM organization.staff s
			LEFT JOIN organization.users u     ON u.id = s.user_id
			LEFT JOIN academic.professors prof ON prof.staff_id = s.id
			WHERE s.is_active = true ${searchCondition}
			ORDER BY COALESCE(u.last_name, s.last_name), COALESCE(u.first_name, s.first_name)
			LIMIT ${limitParam} OFFSET ${offsetParam}`,
			params,
		);

		const total = rows.length > 0 ? Number(rows[0].total) : 0;
		return [rows, total];
	}
}
