import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricRepository } from '../core/rubrics.repository';
import { RubricValidation } from '../core/rubrics.validation';

import { CreateRubricDto, UpdateRubricDto } from '../model/rubrics.dtos';
import { DataSource, EntityManager, In } from 'typeorm';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { RubricConfigService } from './rubric-config.service';
import { RubricEntity } from '../model/rubrics.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

@Injectable()
export class RubricService extends BaseService<RubricRepository> {
	constructor(
		protected readonly repository: RubricRepository,
		protected readonly dataSource: DataSource,
		private readonly rubricConfigService: RubricConfigService,
	) {
		super(repository);
	}

	// Determina si una rúbrica está siendo utilizada en alguna calificación registrada
	private async isRubricUsed(rubricId: number): Promise<boolean> {
		const questions = await this.dataSource.getRepository(RubricQuestionEntity).find({
			where: { rubric_id: rubricId },
		});

		if (questions.length === 0) return false;

		const questionIds = questions.map((q) => q.id);

		// Obtener criterios asociados a estas preguntas
		const criteriaList = await this.dataSource.getRepository(RubricQuestionCriteriaEntity).find({
			where: { rubric_question_id: In(questionIds) },
		});

		if (criteriaList.length === 0) return false;

		const criteriaIds = criteriaList.map((c) => c.id);

		// Verificar si hay scores asociados a estos criterios
		return await this.dataSource.getRepository(RubricScoreEntity).exists({
			where: {
				rubric_question_criteria_id: In(criteriaIds),
			},
		});
	}

	/**
	 * Resuelve los program_ids que pertenecen a una escuela usando la jerarquía de charts.
	 * Recorre el árbol organizacional desde la escuela hacia abajo hasta encontrar programas.
	 */
	private async resolveProgramIdsBySchoolId(schoolId: number): Promise<number[]> {
		const raw = await this.dataSource.query(
			`
			WITH RECURSIVE school_tree AS (
				SELECT id, root_chart_detail_id, entity_type_id, entity_code
				FROM "organization"."charts"
				WHERE entity_type_id = (SELECT id FROM "core"."types" WHERE code = $1)
				  AND entity_code = $2
				UNION ALL
				SELECT c.id, c.root_chart_detail_id, c.entity_type_id, c.entity_code
				FROM "organization"."charts" c
				INNER JOIN school_tree st ON c.root_chart_detail_id = st.id
			)
			SELECT DISTINCT entity_code AS program_id
			FROM school_tree
			WHERE entity_type_id = (SELECT id FROM "core"."types" WHERE code = $3)
			  AND entity_code IS NOT NULL
			`,
			[TYPE_CODES.ENTITY_TYPE.SCHOOL, schoolId, TYPE_CODES.ENTITY_TYPE.PROGRAM],
		);

		return raw.map((row: { program_id: number }) => row.program_id);
	}

	async create(dto: CreateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateUpdate(this.repository, id, dto);
		return await super.update(id, dto, manager);
	}

	async getAllWithFilters(filters?: { schoolId?: number; programId?: number; academicPeriodId?: number; courseId?: number }) {
		const qb = this.dataSource
			.getRepository(RubricEntity)
			.createQueryBuilder('rubric')
			.leftJoinAndSelect('rubric.study_plan_course', 'studyPlanCourse')
			.leftJoinAndSelect('rubric.grade_type', 'gradeType')
			.leftJoinAndSelect('rubric.rubric_type', 'rubricType')
			.leftJoinAndSelect('studyPlanCourse.course', 'course')
			.leftJoinAndSelect('studyPlanCourse.study_plan_academic_period', 'studyPlanAcademicPeriod')
			.leftJoinAndSelect('studyPlanAcademicPeriod.academic_period', 'academicPeriod')
			.leftJoinAndSelect('studyPlanAcademicPeriod.study_plan', 'studyPlan')
			.leftJoinAndSelect('studyPlan.program', 'program');

		if (filters?.schoolId) {
			const programIds = await this.resolveProgramIdsBySchoolId(filters.schoolId);
			if (programIds.length > 0) {
				qb.andWhere('program.id IN (:...programIds)', { programIds });
			} else {
				qb.andWhere('1 = 0');
			}
		}
		if (filters?.programId) {
			qb.andWhere('program.id = :programId', { programId: filters.programId });
		}
		if (filters?.academicPeriodId) {
			qb.andWhere('academicPeriod.id = :academicPeriodId', { academicPeriodId: filters.academicPeriodId });
		}
		if (filters?.courseId) {
			qb.andWhere('course.id = :courseId', { courseId: filters.courseId });
		}

		const rubrics = await qb.getMany();

		const rubricsWithUsage = await Promise.all(
			rubrics.map(async (rubric) => ({
				...rubric,
				isUsed: await this.isRubricUsed(rubric.id),
			})),
		);

		return rubricsWithUsage;
	}

	async getById(id: number) {
		const rubricWithContext = await this.rubricConfigService.getRubricWithContextData(id);

		return {
			...rubricWithContext,
			isUsed: await this.isRubricUsed(id),
		} as any;
	}

	/**
	 * Borra una rúbrica con cascada (R-RUB-018).
	 *
	 * Retorna:
	 * - code 0: eliminado exitosamente
	 * - code 1: tiene calificaciones (no se permite)
	 * - code 2: no existe
	 */
	async delete(id: number, manager?: EntityManager): Promise<{ code: number; message: string; data: any }> {
		const rubric = await this.repository.findOneById(id);
		if (!rubric) {
			return { code: 2, message: 'La rúbrica no existe.', data: null };
		}

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const questions = await queryRunner.manager.find(RubricQuestionEntity, {
				where: { rubric_id: id },
			});
			const questionIds = questions.map((q) => q.id);

			// Verificar si hay scores asociados
			if (questionIds.length > 0) {
				const criteriaList = await queryRunner.manager.find(RubricQuestionCriteriaEntity, {
					where: { rubric_question_id: In(questionIds) },
				});
				const criteriaIds = criteriaList.map((c) => c.id);
				if (criteriaIds.length > 0) {
					const scoreCount = await queryRunner.manager.count(RubricScoreEntity, {
						where: { rubric_question_criteria_id: In(criteriaIds) },
					});
					if (scoreCount > 0) {
						await queryRunner.rollbackTransaction();
						return { code: 1, message: 'No se puede eliminar una rúbrica con calificaciones registradas.', data: null };
					}
				}

				// Eliminar criterios
				await queryRunner.manager.delete(RubricQuestionCriteriaEntity, { rubric_question_id: In(questionIds) });
			}

			// Eliminar preguntas
			await queryRunner.manager.delete(RubricQuestionEntity, { rubric_id: id });
			// Eliminar rúbrica
			await queryRunner.manager.delete(rubric.constructor, id);

			await queryRunner.commitTransaction();
			return { code: 0, message: 'Rúbrica eliminada exitosamente.', data: null };
		} catch (error) {
			await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	}
}
