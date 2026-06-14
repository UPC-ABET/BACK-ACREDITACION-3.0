import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProgramEntity } from '../model/programs.entity';
import { FilterProgramDto } from '../model/programs.dtos';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

export class ProgramRepository extends BaseRepository<ProgramEntity> {
	constructor(
		@InjectRepository(ProgramEntity)
		repository: Repository<ProgramEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getByFilters(filters: FilterProgramDto): Promise<ProgramEntity[]> {
		const qb = this.dataSource.createQueryBuilder(ProgramEntity, 'prog');

		if (filters.code) qb.andWhere('prog.code = :code', { code: filters.code });
		if (filters.isActive !== undefined)
			qb.andWhere('prog.is_active = :isActive', { isActive: filters.isActive });
		if (filters.modalityTypeId)
			qb.andWhere('prog.modality_type_id = :modalityTypeId', {
				modalityTypeId: filters.modalityTypeId,
			});

		if (filters.academicPeriodId) {
			qb.innerJoin(StudyPlanEntity, 'sp', 'sp.program_id = prog.id');
			qb.innerJoin(StudyPlanAcademicPeriodEntity, 'spap', 'spap.study_plan_id = sp.id');
			qb.andWhere('spap.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		if (filters.schoolId) {
			qb.andWhere(
				`prog.id IN (
					SELECT ch_prog.entity_code
					FROM   organization.charts ch_prog
					INNER JOIN organization.charts ch_sch
					       ON  ch_sch.id = ch_prog.root_chart_id
					WHERE  ch_prog.entity_type_id = (SELECT id FROM core.types WHERE code = :programTypeCode)
					  AND  ch_sch.entity_type_id  = (SELECT id FROM core.types WHERE code = :schoolTypeCode)
					  AND  ch_sch.entity_code = :schoolId
				)`,
			);
			qb.setParameter('programTypeCode', TYPE_CODES.ENTITY_TYPE.PROGRAM);
			qb.setParameter('schoolTypeCode', TYPE_CODES.ENTITY_TYPE.SCHOOL);
			qb.setParameter('schoolId', filters.schoolId);
		}

		return await qb.getMany();
	}

	async findByModality(modalityTypeId: number): Promise<ProgramEntity[]> {
		return await this.dataSource
			.createQueryBuilder(ProgramEntity, 'prog')
			.where('prog.modality_type_id = :modalityTypeId', { modalityTypeId })
			.andWhere('prog.is_active = true')
			.orderBy('prog.code', 'ASC')
			.getMany();
	}
}
