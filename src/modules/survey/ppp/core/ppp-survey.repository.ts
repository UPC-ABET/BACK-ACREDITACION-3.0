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
			program_id?: number;
			academic_period_id?: number;
			campus_id?: number;
			student_id?: number;
			practice_number?: number;
		},
	): Promise<SurveyEntity[]> {
		const qb = this.repository
			.createQueryBuilder('s')
			.leftJoinAndSelect('s.student', 'student')
			.leftJoinAndSelect('s.academic_period', 'academic_period')
			.leftJoinAndSelect('s.program', 'program')
			.leftJoinAndSelect('s.campus', 'campus')
			.where('s.survey_type_id = :typeId', { typeId: pppTypeId });

		if (filters?.program_id !== undefined)
			qb.andWhere('s.program_id = :programId', { programId: filters.program_id });
		if (filters?.academic_period_id !== undefined)
			qb.andWhere('s.academic_period_id = :periodId', { periodId: filters.academic_period_id });
		if (filters?.campus_id !== undefined)
			qb.andWhere('s.campus_id = :campusId', { campusId: filters.campus_id });
		if (filters?.student_id !== undefined)
			qb.andWhere('s.student_id = :studentId', { studentId: filters.student_id });
		if (filters?.practice_number !== undefined)
			qb.andWhere('s.survey_number = :practiceNum', { practiceNum: filters.practice_number });

		qb.orderBy('s.created_at', 'DESC');

		return await qb.getMany();
	}

	async findOnePpp(id: number, pppTypeId: number): Promise<SurveyEntity | null> {
		return await this.repository
			.createQueryBuilder('s')
			.leftJoinAndSelect('s.student', 'student')
			.leftJoinAndSelect('s.academic_period', 'academic_period')
			.leftJoinAndSelect('s.program', 'program')
			.leftJoinAndSelect('s.campus', 'campus')
			.where('s.id = :id', { id })
			.andWhere('s.survey_type_id = :typeId', { typeId: pppTypeId })
			.getOne();
	}

	async getDashboardData(
		pppTypeId: number,
		filters?: {
			program_id?: number;
			academic_period_id?: number;
			campus_id?: number;
			practice_number?: number;
		},
	): Promise<
		{ outcome_id: number; outcome_name: string; avg_score: number; total_surveys: number }[]
	> {
		const params: any[] = [pppTypeId];
		const conditions: string[] = [`s.survey_type_id = $1`];

		if (filters?.program_id !== undefined) {
			params.push(filters.program_id);
			conditions.push(`s.program_id = $${params.length}`);
		}
		if (filters?.academic_period_id !== undefined) {
			params.push(filters.academic_period_id);
			conditions.push(`s.academic_period_id = $${params.length}`);
		}
		if (filters?.campus_id !== undefined) {
			params.push(filters.campus_id);
			conditions.push(`s.campus_id = $${params.length}`);
		}
		if (filters?.practice_number !== undefined) {
			params.push(filters.practice_number);
			conditions.push(`s.survey_number = $${params.length}`);
		}

		const whereClause = conditions.join(' AND ');

		return await this.dataSource.query(
			`SELECT
				sc.outcome_id,
				oc.user_outcome_name AS outcome_name,
				ROUND(AVG(sc.score)::numeric, 4) AS avg_score,
				COUNT(DISTINCT s.id)::int AS total_surveys
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
