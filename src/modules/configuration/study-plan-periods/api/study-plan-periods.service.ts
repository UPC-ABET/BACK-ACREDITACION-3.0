import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

// Réplica de DataUploadBaseService.AssociateCurriculumWithAcademicPeriod (legacy ABET 2025).
// Asocia una malla curricular a un período y auto-instancia los study_plan_courses del período
// clonando desde el SPAP previo del mismo study_plan (equivale a la creación automática de
// CursoPeriodoAcademico del legacy — blueprint §2 FASE_0 nodo D1).

export interface StudyPlanPeriodResponse {
	study_plan_academic_period_id: number;
	study_plan_id: number;
	academic_period_id: number;
	courses_instantiated: number;
	cloned_from_spap_id: number | null;
}

@Injectable()
export class StudyPlanPeriodsService {
	constructor(private readonly dataSource: DataSource) {}

	// POST /configuration/periods/:periodId/study-plans/:studyPlanId
	async associate(periodId: number, studyPlanId: number): Promise<StudyPlanPeriodResponse> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			await this.assertPeriodExists(queryRunner.manager, periodId);
			await this.assertStudyPlanExists(queryRunner.manager, studyPlanId);
			await this.assertNotAlreadyAssociated(queryRunner.manager, periodId, studyPlanId);

			const inserted: Array<{ id: number }> = await queryRunner.manager.query(
				`INSERT INTO academic.study_plan_academic_periods
				 (study_plan_id, academic_period_id, upload_log_id, extra, is_active, created_at, updated_at)
				 VALUES ($1, $2, NULL, '{}'::jsonb, true, NOW(), NOW())
				 RETURNING id`,
				[studyPlanId, periodId],
			);
			const newSpapId = inserted[0].id;

			// Clonado del SPAP previo del mismo study_plan (réplica de la creación auto de CursoPeriodoAcademico).
			const { sourceSpapId, count } = await this.cloneStudyPlanCourses(queryRunner.manager, studyPlanId, newSpapId, periodId);

			await queryRunner.commitTransaction();
			return {
				study_plan_academic_period_id: newSpapId,
				study_plan_id: studyPlanId,
				academic_period_id: periodId,
				courses_instantiated: count,
				cloned_from_spap_id: sourceSpapId,
			};
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	// DELETE /configuration/periods/:periodId/study-plans/:studyPlanId — rollback limpio.
	// Borra los SPCs del SPAP y luego el SPAP. Falla si hay course_sections u otras FKs colgando.
	async unassociate(periodId: number, studyPlanId: number): Promise<{ success: boolean; deleted_courses: number }> {
		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();
		try {
			const spapId = await this.resolveSpapId(queryRunner.manager, periodId, studyPlanId);
			await this.assertNoSectionDependencies(queryRunner.manager, spapId);

			const deleted: Array<{ count: number }> = await queryRunner.manager.query(
				`WITH d AS (DELETE FROM academic.study_plan_courses WHERE study_plan_academic_period_id = $1 RETURNING 1)
				 SELECT COUNT(*)::int AS count FROM d`,
				[spapId],
			);
			await queryRunner.manager.query(
				'DELETE FROM academic.study_plan_academic_periods WHERE id = $1',
				[spapId],
			);

			await queryRunner.commitTransaction();
			return { success: true, deleted_courses: deleted[0]?.count ?? 0 };
		} catch (err) {
			await queryRunner.rollbackTransaction();
			throw err;
		} finally {
			await queryRunner.release();
		}
	}

	// GET /configuration/periods/:periodId/study-plans
	async listByPeriod(periodId: number) {
		return await this.dataSource.query(
			`SELECT spap.id AS study_plan_academic_period_id,
			        spap.study_plan_id,
			        spap.academic_period_id,
			        sp.code AS study_plan_code,
			        (SELECT COUNT(*)::int FROM academic.study_plan_courses spc WHERE spc.study_plan_academic_period_id = spap.id) AS courses_count
			 FROM academic.study_plan_academic_periods spap
			 JOIN academic.study_plans sp ON sp.id = spap.study_plan_id
			 WHERE spap.academic_period_id = $1
			 ORDER BY sp.code`,
			[periodId],
		);
	}

	// %% INTERNOS

	// Clona los SPCs del SPAP más reciente del mismo study_plan (period anterior).
	// Si no hay previo (primera vez que se abre la malla), devuelve count=0 — los cursos vendrán por carga Excel.
	private async cloneStudyPlanCourses(
		manager: EntityManager,
		studyPlanId: number,
		newSpapId: number,
		newPeriodId: number,
	): Promise<{ sourceSpapId: number | null; count: number }> {
		const source: Array<{ id: number }> = await manager.query(
			`SELECT spap.id
			 FROM academic.study_plan_academic_periods spap
			 JOIN academic.academic_periods ap ON ap.id = spap.academic_period_id
			 WHERE spap.study_plan_id = $1 AND spap.id <> (SELECT id FROM academic.study_plan_academic_periods WHERE study_plan_id = $1 AND academic_period_id = $2)
			 ORDER BY ap.code DESC
			 LIMIT 1`,
			[studyPlanId, newPeriodId],
		);
		if (source.length === 0) return { sourceSpapId: null, count: 0 };
		const sourceSpapId = source[0].id;

		const result: Array<{ count: number }> = await manager.query(
			`WITH inserted AS (
			   INSERT INTO academic.study_plan_courses
			     (study_plan_academic_period_id, course_id, is_elective, level_type_id, upload_log_id, extra, is_active, created_at, updated_at)
			   SELECT $1, spc.course_id, spc.is_elective, spc.level_type_id, NULL, '{}'::jsonb, true, NOW(), NOW()
			   FROM academic.study_plan_courses spc
			   WHERE spc.study_plan_academic_period_id = $2 AND spc.is_active = true
			   RETURNING 1
			 )
			 SELECT COUNT(*)::int AS count FROM inserted`,
			[newSpapId, sourceSpapId],
		);
		return { sourceSpapId, count: result[0]?.count ?? 0 };
	}

	// %% GUARDS

	private async assertPeriodExists(manager: EntityManager, periodId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM academic.academic_periods WHERE id = $1 AND is_active = true',
			[periodId],
		);
		if (rows.length === 0) throw new HttpException({ message: 'Período no encontrado o inactivo', errors: [`period_id=${periodId}`] }, HttpStatus.NOT_FOUND);
	}

	private async assertStudyPlanExists(manager: EntityManager, studyPlanId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM academic.study_plans WHERE id = $1',
			[studyPlanId],
		);
		if (rows.length === 0) throw new HttpException({ message: 'Malla curricular no encontrada', errors: [`study_plan_id=${studyPlanId}`] }, HttpStatus.NOT_FOUND);
	}

	private async assertNotAlreadyAssociated(manager: EntityManager, periodId: number, studyPlanId: number): Promise<void> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM academic.study_plan_academic_periods WHERE academic_period_id = $1 AND study_plan_id = $2',
			[periodId, studyPlanId],
		);
		if (rows.length > 0) {
			throw new HttpException(
				{ message: 'La malla ya está asociada a este período', errors: [`spap_id=${rows[0].id}`] },
				HttpStatus.CONFLICT,
			);
		}
	}

	private async resolveSpapId(manager: EntityManager, periodId: number, studyPlanId: number): Promise<number> {
		const rows: Array<{ id: number }> = await manager.query(
			'SELECT id FROM academic.study_plan_academic_periods WHERE academic_period_id = $1 AND study_plan_id = $2',
			[periodId, studyPlanId],
		);
		if (rows.length === 0) {
			throw new HttpException(
				{ message: 'Asociación malla-período no encontrada', errors: [`period_id=${periodId}`, `study_plan_id=${studyPlanId}`] },
				HttpStatus.NOT_FOUND,
			);
		}
		return rows[0].id;
	}

	// Bloquea el rollback si ya hay course_sections instanciadas (significa que hubo carga de Sección).
	private async assertNoSectionDependencies(manager: EntityManager, spapId: number): Promise<void> {
		const rows: Array<{ n: number }> = await manager.query(
			`SELECT COUNT(*)::int AS n
			 FROM academic.course_sections cs
			 JOIN academic.study_plan_courses spc ON spc.id = cs.study_plan_course_id
			 WHERE spc.study_plan_academic_period_id = $1`,
			[spapId],
		);
		if (rows[0].n > 0) {
			throw new HttpException(
				{ message: 'No se puede revertir: ya hay secciones cargadas sobre esta malla-período', errors: [`course_sections=${rows[0].n}`] },
				HttpStatus.CONFLICT,
			);
		}
	}
}
