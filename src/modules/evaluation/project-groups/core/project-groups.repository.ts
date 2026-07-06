import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProjectGroupEntity } from '../model/project-groups.entity';
import { FilterProjectGroupDto } from '../model/project-groups.dtos';

export class ProjectGroupRepository extends BaseRepository<ProjectGroupEntity> {
	constructor(
		@InjectRepository(ProjectGroupEntity)
		repository: Repository<ProjectGroupEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(
		filters: FilterProjectGroupDto & { academicPeriodId?: number | null },
	): Promise<ProjectGroupEntity[]> {
		const qb = this.dataSource
			.createQueryBuilder(ProjectGroupEntity, 'pg')
			.leftJoinAndSelect('pg.program', 'program')
			.leftJoinAndSelect('pg.academicPeriod', 'academicPeriod');

		if (filters.code) qb.andWhere('pg.code = :code', { code: filters.code });
		if (filters.academicPeriodId)
			qb.andWhere('pg.academicPeriodId = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		if (filters.programId)
			qb.andWhere('pg.programId = :programId', { programId: filters.programId });
		if (filters.isActive !== undefined)
			qb.andWhere('pg.isActive = :isActive', { isActive: filters.isActive });

		return await qb.orderBy('pg.code', 'ASC').getMany();
	}

	/** Same code within the same academic period + program collides (business key). */
	async findByCodeInScope(
		code: string,
		academicPeriodId: number,
		programId: number,
	): Promise<ProjectGroupEntity | null> {
		return await this.repository.findOne({
			where: { code, academicPeriodId, programId },
		});
	}

	async academicPeriodExists(academicPeriodId: number): Promise<boolean> {
		const rows = (await this.dataSource.query(
			`SELECT 1 FROM academic.academic_periods WHERE id = $1 LIMIT 1`,
			[academicPeriodId],
		)) as unknown[];
		return rows.length > 0;
	}

	async programExists(programId: number): Promise<boolean> {
		const rows = (await this.dataSource.query(
			`SELECT 1 FROM academic.programs WHERE id = $1 LIMIT 1`,
			[programId],
		)) as unknown[];
		return rows.length > 0;
	}

	async hasProjects(projectGroupId: number): Promise<boolean> {
		const rows = (await this.dataSource.query(
			`SELECT 1 FROM evaluation.projects WHERE project_group_id = $1 LIMIT 1`,
			[projectGroupId],
		)) as unknown[];
		return rows.length > 0;
	}
}
