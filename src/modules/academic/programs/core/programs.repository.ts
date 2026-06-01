import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { ProgramEntity } from '../model/programs.entity';
import { FilterProgramDto } from '../model/programs.dtos';
import { StudyPlanEntity } from '../../study-plans/model/study-plans.entity';
import { StudyPlanAcademicPeriodEntity } from '../../study-plan-academic-periods/model/study-plan-academic-periods.entity';

const SCHOOL_TYPE_CODE = 'TG903-T001';
const PROGRAM_TYPE_CODE = 'TG903-T002';

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

		// ── Direct Filters ─────────────────────────────────────────────────
		if (filters.code) qb.andWhere('prog.code = :code', { code: filters.code });
		if (filters.isActive !== undefined)
			qb.andWhere('prog.is_active = :isActive', { isActive: filters.isActive });
		if (filters.modalityTypeId)
			qb.andWhere('prog.modality_type_id = :modalityTypeId', {
				modalityTypeId: filters.modalityTypeId,
			});

		// ── Flags ────────────────────────────────────────────────────────────
		const needsSp = !!(filters.academicPeriodId || filters.schoolId);
		const needsSpap = !!filters.academicPeriodId;

		// ── JOINs ────────────────────────────────────────────────────────────
		if (needsSp) {
			qb.leftJoin(StudyPlanEntity, 'sp', 'sp.program_id = prog.id');
		}
		if (needsSpap) {
			qb.leftJoin(StudyPlanAcademicPeriodEntity, 'spap', 'spap.study_plan_id = sp.id');
			qb.andWhere('spap.academic_period_id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}

		// ── School ──────────────────────────────────────────────────────────
		// ── School ──────────────────────────────────────────────────────────
		if (filters.schoolId) {
			qb.andWhere(
				`prog.id IN (
            SELECT ch_prog.entity_code
            FROM   organization.charts   ch_prog
            INNER JOIN core.types        t_prog
                   ON  t_prog.id   = ch_prog.entity_type_id
                   AND t_prog.code = '${PROGRAM_TYPE_CODE}'
            INNER JOIN organization.charts ch_sch
                   ON  ch_sch.id   = ch_prog.root_chart_id
            INNER JOIN core.types        t_sch
                   ON  t_sch.id    = ch_sch.entity_type_id
                   AND t_sch.code  = '${SCHOOL_TYPE_CODE}'
            INNER JOIN organization.schools sch
                   ON  sch.id      = ch_sch.entity_code
            WHERE  sch.id = :schoolId
        )`,
			);
			qb.setParameter('schoolId', filters.schoolId);
		}
		return await qb.getMany();
	}
}
