import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricRepository } from '../core/rubrics.repository';
import { RubricValidation } from '../core/rubrics.validation';
import { CreateRubricDto, CreateRubricCriteriaDto, CreateRubricQuestionDto, UpdateRubricDto } from '../model/rubrics.dtos';
import { DataSource, DeepPartial, EntityManager, In } from 'typeorm';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { RubricConfigService } from './rubric-config.service';
import { RubricEntity } from '../model/rubrics.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import type { I18nText } from 'src/shared/types/i18n';

@Injectable()
export class RubricService extends BaseService<RubricRepository> {
	constructor(
		protected readonly repository: RubricRepository,
		protected readonly dataSource: DataSource,
		private readonly rubricConfigService: RubricConfigService,
	) {
		super(repository);
	}

	// ── Helpers ───────────────────────────────────────────────────────────

	private normalizeI18n(value: I18nText | string): I18nText {
		return typeof value === 'string' ? { en: value, es: value } : value;
	}

	// ── Sincronización de criterias ───────────────────────────────────────

	private async syncCriterias(
		questionId: number,
		criterias: CreateRubricCriteriaDto[],
		manager: EntityManager,
	): Promise<void> {
		const criteriaRepo = manager.getRepository(RubricQuestionCriteriaEntity);

		const incomingIds = criterias.filter((c) => c.id).map((c) => c.id as number);

		// Borrar las que ya no vienen (si criterias = [] borra todas)
		const existing = await criteriaRepo.find({ where: { rubric_question_id: questionId } });
		const toDelete = existing.filter((c) => !incomingIds.includes(c.id));
		if (toDelete.length > 0) {
			await criteriaRepo.delete(toDelete.map((c) => c.id));
		}

		// Actualizar las que tienen id
		const toUpdate = criterias.filter((c) => c.id);
		for (const c of toUpdate) {
			await criteriaRepo.update(c.id as number, {
				criteria: this.normalizeI18n(c.criteria),
				min_value: c.min_value,
				max_value: c.max_value,
			});
		}

		// Insertar las nuevas (sin id)
		const toInsert = criterias.filter((c) => !c.id);
		if (toInsert.length > 0) {
			await criteriaRepo.save(
				toInsert.map((c) => ({
					rubric_question_id: questionId,
					criteria: this.normalizeI18n(c.criteria),
					min_value: c.min_value,
					max_value: c.max_value,
				})) as DeepPartial<RubricQuestionCriteriaEntity>[],
			);
		}
	}

	// ── Sincronización de questions ───────────────────────────────────────

	private async syncQuestions(
		rubricId: number,
		questions: CreateRubricQuestionDto[],
		manager: EntityManager,
	): Promise<void> {
		const questionRepo = manager.getRepository(RubricQuestionEntity);
		const criteriaRepo = manager.getRepository(RubricQuestionCriteriaEntity);

		const incomingIds = questions.filter((q) => q.id).map((q) => q.id as number);

		// Borrar questions que ya no vienen (y sus criterias primero)
		const existing = await questionRepo.find({ where: { rubric_id: rubricId } });
		const toDelete = existing.filter((q) => !incomingIds.includes(q.id));
		if (toDelete.length > 0) {
			const deletedIds = toDelete.map((q) => q.id);
			await criteriaRepo.delete({ rubric_question_id: In(deletedIds) });
			await questionRepo.delete(deletedIds);
		}

		// Actualizar las que tienen id
		const toUpdate = questions.filter((q) => q.id);
		for (const q of toUpdate) {
			const { criterias, id, ...questionData } = q;
			await questionRepo.update(id as number, {
				...questionData,
				question: this.normalizeI18n(q.question),
			});
			if (criterias !== undefined) {
				await this.syncCriterias(id as number, criterias, manager);
			}
		}

		// Insertar las nuevas (sin id)
		const toInsert = questions.filter((q) => !q.id);
		for (const q of toInsert) {
			const { criterias, ...questionData } = q;
			const saved = await questionRepo.save({
				...questionData,
				rubric_id: rubricId,
				question: this.normalizeI18n(q.question),
			} as DeepPartial<RubricQuestionEntity>);

			if (criterias && criterias.length > 0) {
				await criteriaRepo.save(
					criterias.map((c) => ({
						rubric_question_id: saved.id,
						criteria: this.normalizeI18n(c.criteria),
						min_value: c.min_value,
						max_value: c.max_value,
					})) as DeepPartial<RubricQuestionCriteriaEntity>[],
				);
			}
		}
	}

	// ── isRubricUsed ──────────────────────────────────────────────────────

	private async isRubricUsed(rubricId: number): Promise<boolean> {
		const questions = await this.dataSource.getRepository(RubricQuestionEntity).find({
			where: { rubric_id: rubricId },
		});
		if (questions.length === 0) return false;

		const questionIds = questions.map((q) => q.id);
		const criteriaList = await this.dataSource.getRepository(RubricQuestionCriteriaEntity).find({
			where: { rubric_question_id: In(questionIds) },
		});
		if (criteriaList.length === 0) return false;

		return await this.dataSource.getRepository(RubricScoreEntity).exists({
			where: { rubric_question_criteria_id: In(criteriaList.map((c) => c.id)) },
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
	// ── CRUD ──────────────────────────────────────────────────────────────

	async create(dto: CreateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateUpdate(this.repository, id, dto);

		const { questions, ...rubricData } = dto;

		// Actualizar solo campos escalares de la rúbrica sin cargar relations
		// para que TypeORM no intente sincronizar questions en el save
		const rubricRepo = this.dataSource.getRepository(RubricEntity);
		const entity = await rubricRepo.findOne({ where: { id }, relations: [] });
		if (!entity) throw new Error(`No se encontró la rúbrica con ID: ${id}`);
		Object.assign(entity, rubricData);
		await rubricRepo.save(entity);

		// Sincronizar questions en transacción separada
		if (questions !== undefined) {
			const queryRunner = this.dataSource.createQueryRunner();
			await queryRunner.connect();
			await queryRunner.startTransaction();
			try {
				await this.syncQuestions(id, questions, queryRunner.manager);
				await queryRunner.commitTransaction();
			} catch (error) {
				await queryRunner.rollbackTransaction();
				throw error;
			} finally {
				await queryRunner.release();
			}
		}

		return await this.repository.findOneById(id);
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

		return await Promise.all(
			rubrics.map(async (rubric) => ({
				...rubric,
				isUsed: await this.isRubricUsed(rubric.id),
			})),
		);
	}

	async getById(id: number) {
		const rubricWithContext = await this.rubricConfigService.getRubricWithContextData(id);
		return {
			...rubricWithContext,
			isUsed: await this.isRubricUsed(id),
		} as any;
	}

	async delete(id: number, manager?: EntityManager): Promise<{ code: number; message: string; data: any }> {
		const rubric = await this.repository.findOneById(id);
		if (!rubric) {
			return { code: 2, message: 'La rúbrica no existe.', data: null };
		}

		const queryRunner = this.dataSource.createQueryRunner();
		await queryRunner.connect();
		await queryRunner.startTransaction();

		try {
			const questions = await queryRunner.manager.find(RubricQuestionEntity, { where: { rubric_id: id } });
			const questionIds = questions.map((q) => q.id);

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

				await queryRunner.manager.delete(RubricQuestionCriteriaEntity, { rubric_question_id: In(questionIds) });
			}

			await queryRunner.manager.delete(RubricQuestionEntity, { rubric_id: id });
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