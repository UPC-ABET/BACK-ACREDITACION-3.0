import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Injectable()
export class PppSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
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

	async getPppTypeId(code: string = 'TG601-T003'): Promise<number | null> {
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
