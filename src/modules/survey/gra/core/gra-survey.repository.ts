import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { SurveyEntity } from 'src/modules/evidence/surveys/model/surveys.entity';

@Injectable()
export class GraSurveyRepository extends BaseRepository<SurveyEntity> {
	constructor(
		@InjectRepository(SurveyEntity)
		repository: Repository<SurveyEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	/** Busca una encuesta GRA existente para un estudiante en un período y programa */
	async findExistingGraSurvey(
		graSurveyTypeId: number,
		studentId: number,
		academicPeriodId: number,
		programId: number,
	): Promise<SurveyEntity | null> {
		return await this.repository
			.createQueryBuilder('s')
			.where('s.survey_type_id = :typeId', { typeId: graSurveyTypeId })
			.andWhere('s.student_id = :studentId', { studentId })
			.andWhere('s.academic_period_id = :periodId', { periodId: academicPeriodId })
			.andWhere('s.program_id = :programId', { programId })
			.getOne();
	}

	/** Obtiene el type_id de encuesta GRA desde core.types */
	async getGraSurveyTypeId(code = 'TG601-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Obtiene el type_id para estado activo de encuesta */
	async getActiveSurveyStatusId(code = 'TG602-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Obtiene el type_id para estado cerrado de encuesta */
	async getClosedSurveyStatusId(code = 'TG602-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Obtiene el type_id para notificación programada */
	async getScheduledNotificationStatusId(code = 'TG1001-T001'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Obtiene el type_id para notificación enviada */
	async getSentNotificationStatusId(code = 'TG1001-T002'): Promise<number | null> {
		const rows = await this.dataSource.query(`SELECT id FROM core.types WHERE code = $1 LIMIT 1`, [
			code,
		]);
		return rows?.[0]?.id ?? null;
	}

	/** Actualiza el estado de la encuesta a cerrado (COM) */
	async closeSurvey(
		surveyId: number,
		closedStatusId: number,
		commentaries?: string,
	): Promise<void> {
		const infoUpdate = commentaries
			? `, information = COALESCE(information::jsonb, '{}'::jsonb) || jsonb_build_object('commentaries', $3)`
			: '';
		const params: any[] = [closedStatusId, surveyId];
		if (commentaries) params.push(commentaries);

		await this.dataSource.query(
			`UPDATE evidence.surveys
			 SET survey_status_type_id = $1, updated_at = NOW()${infoUpdate}
			 WHERE id = $2`,
			params,
		);
	}

	/** Dashboard: cuenta encuestas GRA completadas vs pendientes */
	async getDashboardData(
		graSurveyTypeId: number,
		activeStatusId: number,
		closedStatusId: number,
		filters: { academic_period_id?: number; program_id?: number; campus_id?: number },
	): Promise<{ completed: number; pending: number; total: number; by_program: any[] }> {
		let whereClause = `s.survey_type_id = $1`;
		const params: any[] = [graSurveyTypeId];

		if (filters.academic_period_id) {
			whereClause += ` AND s.academic_period_id = $${params.length + 1}`;
			params.push(filters.academic_period_id);
		}
		if (filters.program_id) {
			whereClause += ` AND s.program_id = $${params.length + 1}`;
			params.push(filters.program_id);
		}
		if (filters.campus_id) {
			whereClause += ` AND s.campus_id = $${params.length + 1}`;
			params.push(filters.campus_id);
		}

		const [summary, byProgram] = await Promise.all([
			this.dataSource.query(
				`SELECT
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int AS completed,
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int AS pending,
					COUNT(*)::int AS total
				FROM evidence.surveys s
				WHERE ${whereClause}`,
				[...params, closedStatusId, activeStatusId],
			),
			this.dataSource.query(
				`SELECT
					p.name AS program_name,
					p.code AS program_code,
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 1})::int AS completed,
					COUNT(*) FILTER (WHERE s.survey_status_type_id = $${params.length + 2})::int AS pending,
					COUNT(*)::int AS total
				FROM evidence.surveys s
				INNER JOIN academic.programs p ON p.id = s.program_id
				WHERE ${whereClause}
				GROUP BY p.id, p.name, p.code
				ORDER BY p.name`,
				[...params, closedStatusId, activeStatusId],
			),
		]);

		return {
			completed: summary[0]?.completed ?? 0,
			pending: summary[0]?.pending ?? 0,
			total: summary[0]?.total ?? 0,
			by_program: byProgram,
		};
	}

	/** Busca el default course_section_id (requerido como FK) */
	async getDefaultCourseSectionId(): Promise<number | null> {
		const rows = await this.dataSource.query(
			`SELECT id FROM academic.course_sections ORDER BY id LIMIT 1`,
		);
		return rows?.[0]?.id ?? 1;
	}
}
