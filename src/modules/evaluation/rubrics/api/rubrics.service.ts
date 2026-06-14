import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import { RubricRepository } from '../core/rubrics.repository';
import { RubricValidation } from '../core/rubrics.validation';
import {
	CreateRubricDto,
	CreateRubricCriteriaDto,
	CreateRubricQuestionDto,
	UpdateRubricDto,
} from '../model/rubrics.dtos';
import { DataSource, DeepPartial, EntityManager, In } from 'typeorm';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { RubricConfigService } from './rubric-config.service';
import { RubricEntity } from '../model/rubrics.entity';
import type { I18nText } from 'src/shared/types/i18n';
import pLimit from 'p-limit';
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

	private normalizeI18n(value: I18nText | string): I18nText {
		return typeof value === 'string' ? { en: value, es: value } : value;
	}

	private async syncCriterias(
		questionId: number,
		criterias: CreateRubricCriteriaDto[],
		manager: EntityManager,
	): Promise<void> {
		const criteriaRepo = manager.getRepository(RubricQuestionCriteriaEntity);

		const incomingIds = criterias.filter((c) => c.id).map((c) => c.id as number);

		// Borrar las que ya no vienen (si criterias = [] borra todas)
		const existing = await criteriaRepo.find({ where: { rubricQuestionId: questionId } });
		const toDelete = existing.filter((c) => !incomingIds.includes(c.id));
		if (toDelete.length > 0) {
			await criteriaRepo.delete(toDelete.map((c) => c.id));
		}

		const toUpdate = criterias.filter((c) => c.id);
		for (const c of toUpdate) {
			await criteriaRepo.update(c.id as number, {
				criteria: this.normalizeI18n(c.criteria),
				minValue: c.minValue,
				maxValue: c.maxValue,
			});
		}

		const toInsert = criterias.filter((c) => !c.id);
		if (toInsert.length > 0) {
			await criteriaRepo.save(
				toInsert.map((c) => ({
					rubricQuestionId: questionId,
					criteria: this.normalizeI18n(c.criteria),
					minValue: c.minValue,
					maxValue: c.maxValue,
				})) as DeepPartial<RubricQuestionCriteriaEntity>[],
			);
		}
	}

	private async syncQuestions(
		rubricId: number,
		questions: CreateRubricQuestionDto[],
		manager: EntityManager,
	): Promise<void> {
		const questionRepo = manager.getRepository(RubricQuestionEntity);
		const criteriaRepo = manager.getRepository(RubricQuestionCriteriaEntity);

		const incomingIds = questions.filter((q) => q.id).map((q) => q.id as number);

		// Borrar questions que ya no vienen (y sus criterias primero)
		const existing = await questionRepo.find({ where: { rubricId: rubricId } });
		const toDelete = existing.filter((q) => !incomingIds.includes(q.id));
		if (toDelete.length > 0) {
			const deletedIds = toDelete.map((q) => q.id);
			await criteriaRepo.delete({ rubricQuestionId: In(deletedIds) });
			await questionRepo.delete(deletedIds);
		}

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

		const toInsert = questions.filter((q) => !q.id);
		for (const q of toInsert) {
			const { criterias, ...questionData } = q;
			const saved = await questionRepo.save({
				...questionData,
				rubricId: rubricId,
				question: this.normalizeI18n(q.question),
			} as DeepPartial<RubricQuestionEntity>);

			if (criterias && criterias.length > 0) {
				await criteriaRepo.save(
					criterias.map((c) => ({
						rubricQuestionId: saved.id,
						criteria: this.normalizeI18n(c.criteria),
						minValue: c.minValue,
						maxValue: c.maxValue,
					})) as DeepPartial<RubricQuestionCriteriaEntity>[],
				);
			}
		}
	}

	private async isRubricUsed(rubricId: number): Promise<boolean> {
		const questions = await this.dataSource.getRepository(RubricQuestionEntity).find({
			where: { rubricId: rubricId },
		});
		if (questions.length === 0) return false;

		const questionIds = questions.map((q) => q.id);
		const criteriaList = await this.dataSource.getRepository(RubricQuestionCriteriaEntity).find({
			where: { rubricQuestionId: In(questionIds) },
		});
		if (criteriaList.length === 0) return false;

		return await this.dataSource.getRepository(RubricScoreEntity).exists({
			where: { rubricQuestionCriteriaId: In(criteriaList.map((c) => c.id)) },
		});
	}

	async create(dto: CreateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateUpdate(this.repository, id, dto);

		const { questions, ...rubricData } = dto;

		// Actualizar solo campos escalares de la rúbrica sin cargar relations
		// para que TypeORM no intente sincronizar questions en el save
		await this.dataSource.transaction(async (txManager) => {
			const rubricRepo = txManager.getRepository(RubricEntity);
			const entity = await rubricRepo.findOne({ where: { id }, relations: [] });
			if (!entity) throw new Error(`No se encontró la rúbrica con ID: ${id}`);
			Object.assign(entity, rubricData);
			await rubricRepo.save(entity);

			if (questions !== undefined) {
				await this.syncQuestions(id, questions, txManager);
			}
		});

		return await this.repository.findOneById(id);
	}

	async getAllWithFilters(filters?: {
		schoolId?: number;
		programId?: number;
		academicPeriodId?: number;
		courseId?: number;
	}) {
		const qb = this.dataSource
			.getRepository(RubricEntity)
			.createQueryBuilder('rubric')
			.leftJoinAndSelect('rubric.studyPlanCourse', 'studyPlanCourse')
			.leftJoinAndSelect('rubric.gradeType', 'gradeType')
			.leftJoinAndSelect('rubric.rubricType', 'rubricType')
			.leftJoinAndSelect('studyPlanCourse.course', 'course')
			.leftJoinAndSelect('studyPlanCourse.studyPlanAcademicPeriod', 'studyPlanAcademicPeriod')
			.leftJoinAndSelect('studyPlanAcademicPeriod.academicPeriod', 'academicPeriod')
			.leftJoinAndSelect('studyPlanAcademicPeriod.studyPlan', 'studyPlan')
			.leftJoinAndSelect('studyPlan.program', 'program');

		if (filters?.schoolId) {
			qb.andWhere(
				`program.id IN (
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

		if (filters?.programId) {
			qb.andWhere('program.id = :programId', { programId: filters.programId });
		}
		if (filters?.academicPeriodId) {
			qb.andWhere('academicPeriod.id = :academicPeriodId', {
				academicPeriodId: filters.academicPeriodId,
			});
		}
		if (filters?.courseId) {
			qb.andWhere('course.id = :courseId', { courseId: filters.courseId });
		}

		const rubrics = await qb.getMany();

		const limit = pLimit(5);
		return await Promise.all(
			rubrics.map((rubric) =>
				limit(async () => ({
					...rubric,
					isUsed: await this.isRubricUsed(rubric.id),
				})),
			),
		);
	}

	async getById(id: number) {
		const rubricWithContext = await this.rubricConfigService.getRubricWithContextData(id);
		return {
			...rubricWithContext,
			isUsed: await this.isRubricUsed(id),
		} as any;
	}

	async delete(
		id: number,
		manager?: EntityManager,
	): Promise<{ code: number; message: string; data: any }> {
		const rubric = await this.repository.findOneById(id);
		if (!rubric) {
			return { code: 2, message: 'La rúbrica no existe.', data: null };
		}

		if (await this.isRubricUsed(id)) {
			return {
				code: 1,
				message: 'No se puede eliminar una rúbrica con calificaciones registradas.',
				data: null,
			};
		}

		await this.dataSource.transaction(async (txManager) => {
			const questions = await txManager.find(RubricQuestionEntity, {
				where: { rubricId: id },
			});
			const questionIds = questions.map((q) => q.id);

			if (questionIds.length > 0) {
				await txManager.delete(RubricQuestionCriteriaEntity, {
					rubricQuestionId: In(questionIds),
				});
			}

			await txManager.delete(RubricQuestionEntity, { rubricId: id });
			await txManager.delete(rubric.constructor, id);
		});

		return { code: 0, message: 'Rúbrica eliminada exitosamente.', data: null };
	}
}
