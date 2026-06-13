import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { OutcomeEntity } from '../model/outcomes.entity';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';

export interface OutcomeDeleteBlockerCounts {
	courseOutcomeMappings: number;
	rubricQuestions: number;
	studentCourseOutcomeGrades: number;
	findingOutcomes: number;
	outcomeConfigs: number;
	scores: number;
}

export class OutcomeRepository extends BaseRepository<OutcomeEntity> {
	constructor(
		@InjectRepository(OutcomeEntity)
		repository: Repository<OutcomeEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findByIdWithCommission(id: number): Promise<OutcomeEntity | null> {
		return await this.dataSource
			.createQueryBuilder(OutcomeEntity, 'outcome')
			.leftJoinAndSelect('outcome.programCommission', 'program_commission')
			.leftJoinAndSelect('program_commission.commission', 'commission')
			.where('outcome.id = :id', { id })
			.getOne();
	}

	async findMaintenancePage(
		programId: number,
		academicPeriodId: number,
		search: string | undefined,
		skip: number,
		take: number,
	): Promise<[OutcomeEntity[], number]> {
		const qb = this.dataSource
			.createQueryBuilder(OutcomeEntity, 'outcome')
			.innerJoinAndSelect('outcome.programCommission', 'program_commission')
			.innerJoinAndSelect('program_commission.commission', 'commission')
			.where('program_commission.program_id = :programId', { programId })
			.andWhere('program_commission.academic_period_id = :academicPeriodId', { academicPeriodId });

		if (search?.trim()) {
			const term = `%${search.trim()}%`;
			qb.andWhere(
				`(outcome.outcome_code ILIKE :term
					OR outcome.outcome_name->>'es' ILIKE :term
					OR outcome.outcome_name->>'en' ILIKE :term)`,
				{ term },
			);
		}

		return await qb
			.orderBy('commission.code', 'ASC')
			.addOrderBy('outcome.outcomeCode', 'ASC')
			.addOrderBy('outcome.id', 'ASC')
			.skip(skip)
			.take(take)
			.getManyAndCount();
	}

	async findProgramCommissionId(
		programId: number,
		commissionId: number,
		academicPeriodId: number,
	): Promise<number | null> {
		const pc = await this.dataSource
			.createQueryBuilder(ProgramCommissionEntity, 'pc')
			.where('pc.program_id = :programId', { programId })
			.andWhere('pc.commission_id = :commissionId', { commissionId })
			.andWhere('pc.academic_period_id = :academicPeriodId', { academicPeriodId })
			.getOne();
		return pc?.id ?? null;
	}

	async findDeleteBlockerCounts(outcomeId: number): Promise<OutcomeDeleteBlockerCounts> {
		const [row] = await this.dataSource.query(
			`SELECT
				(SELECT COUNT(*) FROM academic.course_outcome_mappings WHERE outcome_id = $1) AS "courseOutcomeMappings",
				(SELECT COUNT(*) FROM evaluation.rubric_questions WHERE outcome_id = $1) AS "rubricQuestions",
				(SELECT COUNT(*) FROM evidence.student_course_outcome_grades WHERE outcome_id = $1) AS "studentCourseOutcomeGrades",
				(SELECT COUNT(*) FROM improvement.finding_outcomes WHERE outcome_id = $1) AS "findingOutcomes",
				(SELECT COUNT(*) FROM survey.outcome_configs WHERE outcome_id = $1) AS "outcomeConfigs",
				(SELECT COUNT(*) FROM survey.scores WHERE outcome_id = $1) AS "scores"`,
			[outcomeId],
		);

		return {
			courseOutcomeMappings: Number(row.courseOutcomeMappings),
			rubricQuestions: Number(row.rubricQuestions),
			studentCourseOutcomeGrades: Number(row.studentCourseOutcomeGrades),
			findingOutcomes: Number(row.findingOutcomes),
			outcomeConfigs: Number(row.outcomeConfigs),
			scores: Number(row.scores),
		};
	}
}
