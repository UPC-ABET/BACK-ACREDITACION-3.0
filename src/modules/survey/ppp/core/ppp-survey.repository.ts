import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

@Injectable()
export class PppSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Exposes a DB transaction to services without them injecting `DataSource`
	 *  directly (repository boundary — see `docs/POLICIES.md`). */
	async transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		return this.dataSource.transaction(work);
	}

	async findAllPpp(
		pppTypeId: number,
		filters?: {
			programId?: number;
			academicPeriodId?: number;
			campusId?: number;
			studentId?: number;
			practiceNumber?: number;
		},
	): Promise<SurveyEntity[]> {
		const qb = this.repository
			.createQueryBuilder('s')
			.leftJoinAndSelect('s.student', 'student')
			.leftJoinAndSelect('s.academicPeriod', 'academic_period')
			.leftJoinAndSelect('s.program', 'program')
			.leftJoinAndSelect('s.campus', 'campus')
			.where('s.survey_type_id = :typeId', { typeId: pppTypeId });

		if (filters?.programId !== undefined)
			qb.andWhere('s.program_id = :programId', { programId: filters.programId });
		if (filters?.academicPeriodId !== undefined)
			qb.andWhere('s.academic_period_id = :periodId', { periodId: filters.academicPeriodId });
		if (filters?.campusId !== undefined)
			qb.andWhere('s.campus_id = :campusId', { campusId: filters.campusId });
		if (filters?.studentId !== undefined)
			qb.andWhere('s.student_id = :studentId', { studentId: filters.studentId });
		if (filters?.practiceNumber !== undefined)
			qb.andWhere('s.survey_number = :practiceNum', { practiceNum: filters.practiceNumber });

		qb.orderBy('s.created_at', 'DESC');

		return await qb.getMany();
	}

	async findOnePpp(id: number, pppTypeId: number): Promise<SurveyEntity | null> {
		return await this.repository
			.createQueryBuilder('s')
			.leftJoinAndSelect('s.student', 'student')
			.leftJoinAndSelect('s.academicPeriod', 'academic_period')
			.leftJoinAndSelect('s.program', 'program')
			.leftJoinAndSelect('s.campus', 'campus')
			.where('s.id = :id', { id })
			.andWhere('s.survey_type_id = :typeId', { typeId: pppTypeId })
			.getOne();
	}

	async getDashboardData(
		pppTypeId: number,
		filters?: {
			programId?: number;
			academicPeriodId?: number;
			campusId?: number;
			practiceNumber?: number;
		},
	): Promise<{ outcomeId: number; outcomeName: string; avgScore: number; totalSurveys: number }[]> {
		const params: any[] = [pppTypeId];
		const conditions: string[] = [`s.survey_type_id = $1`];

		if (filters?.programId !== undefined) {
			params.push(filters.programId);
			conditions.push(`s.program_id = $${params.length}`);
		}
		if (filters?.academicPeriodId !== undefined) {
			params.push(filters.academicPeriodId);
			conditions.push(`s.academic_period_id = $${params.length}`);
		}
		if (filters?.campusId !== undefined) {
			params.push(filters.campusId);
			conditions.push(`s.campus_id = $${params.length}`);
		}
		if (filters?.practiceNumber !== undefined) {
			params.push(filters.practiceNumber);
			conditions.push(`s.survey_number = $${params.length}`);
		}

		const whereClause = conditions.join(' AND ');

		return await this.dataSource.query(
			`SELECT
				sc.outcome_id                    AS "outcomeId",
				oc.user_outcome_name             AS "outcomeName",
				ROUND(AVG(sc.score)::numeric, 4) AS "avgScore",
				COUNT(DISTINCT s.id)::int        AS "totalSurveys"
			FROM evidence.surveys s
			INNER JOIN survey.scores sc ON sc.survey_id = s.id
			LEFT JOIN survey.outcome_configs oc ON oc.outcome_id = sc.outcome_id
			WHERE ${whereClause}
			GROUP BY sc.outcome_id, oc.user_outcome_name
			ORDER BY oc.user_outcome_name`,
			params,
		);
	}

	async findStudentByCode(code: string): Promise<{ id: number } | null> {
		const rows = await this.dataSource.query(
			`SELECT id FROM academic.students WHERE code = $1 LIMIT 1`,
			[code],
		);
		return rows?.[0] ?? null;
	}

	// PPP surveys are tied to a campus + course section (NOT NULL FKs). The Excel
	// upload does not carry these, so resolve the student's actual section/campus
	// when enrolled, falling back to the first available section otherwise.
	async resolveCourseSectionAndCampus(
		studentId: number,
	): Promise<{ courseSectionId: number; campusId: number } | null> {
		const enrolled = await this.dataSource.query(
			`SELECT sse.course_section_id AS "courseSectionId", es.campus_id AS "campusId"
			 FROM academic.enrolled_students es
			 JOIN academic.student_section_enrollments sse ON sse.enrolled_student_id = es.id
			 WHERE es.student_id = $1
			 ORDER BY sse.id DESC LIMIT 1`,
			[studentId],
		);
		if (enrolled?.[0]) return enrolled[0];

		const fallback = await this.dataSource.query(
			`SELECT id AS "courseSectionId", campus_id AS "campusId"
			 FROM academic.course_sections ORDER BY id LIMIT 1`,
		);
		return fallback?.[0] ?? null;
	}

	async getPppTypeId(code: string = TYPE_CODES.SURVEY_TYPE.PPP): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	async getPppStatusTypeId(code: string = 'TG602-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}
}
