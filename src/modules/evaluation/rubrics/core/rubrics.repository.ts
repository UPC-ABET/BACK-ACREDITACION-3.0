import { InjectRepository } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource, DeepPartial, EntityManager, In, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { rubricsValidationStrings } from '../config/strings/rubrics.validation';
import { RubricEntity } from '../model/rubrics.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import type { I18nText } from 'src/shared/types/i18n';
import {
	programInSchoolSubquery,
	schoolProgramFilterParams,
} from 'src/libs/school-program.functions';

export interface RubricListFilters {
	schoolId?: number;
	programId?: number;
	academicPeriodId?: number;
	courseId?: number;
}

export interface NormalizedRubricCriteria {
	id?: number;
	criteria: I18nText;
	minValue: number;
	maxValue: number;
}

export interface NormalizedRubricQuestion {
	id?: number;
	outcomeId?: number;
	question: I18nText;
	criterias?: NormalizedRubricCriteria[];
}

export class RubricRepository extends BaseRepository<RubricEntity> {
	constructor(
		@InjectRepository(RubricEntity)
		repository: Repository<RubricEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async findManyWithContext(filters?: RubricListFilters): Promise<RubricEntity[]> {
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
			qb.andWhere(programInSchoolSubquery('program.id')).setParameters(
				schoolProgramFilterParams(filters.schoolId),
			);
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

		return await qb.getMany();
	}

	async isUsed(rubricId: number): Promise<boolean> {
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

	async updateWithQuestions(
		id: number,
		rubricData: DeepPartial<RubricEntity>,
		questions: NormalizedRubricQuestion[] | undefined,
	): Promise<void> {
		await this.dataSource.transaction(async (txManager) => {
			const rubricRepo = txManager.getRepository(RubricEntity);
			const entity = await rubricRepo.findOne({ where: { id }, relations: [] });
			if (!entity) throw new NotFoundException(rubricsValidationStrings.error.notFound);
			Object.assign(entity, rubricData);
			await rubricRepo.save(entity);

			if (questions !== undefined) {
				await this.syncQuestions(id, questions, txManager);
			}
		});
	}

	async deleteWithChildren(id: number): Promise<void> {
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
			await txManager.delete(RubricEntity, id);
		});
	}

	private async syncCriterias(
		questionId: number,
		criterias: NormalizedRubricCriteria[],
		manager: EntityManager,
	): Promise<void> {
		const criteriaRepo = manager.getRepository(RubricQuestionCriteriaEntity);

		const incomingIds = criterias.filter((c) => c.id).map((c) => c.id as number);

		const existing = await criteriaRepo.find({ where: { rubricQuestionId: questionId } });
		const toDelete = existing.filter((c) => !incomingIds.includes(c.id));
		if (toDelete.length > 0) {
			await criteriaRepo.delete(toDelete.map((c) => c.id));
		}

		const toUpdate = criterias.filter((c) => c.id);
		for (const c of toUpdate) {
			await criteriaRepo.update(c.id as number, {
				criteria: c.criteria,
				minValue: c.minValue,
				maxValue: c.maxValue,
			});
		}

		const toInsert = criterias.filter((c) => !c.id);
		if (toInsert.length > 0) {
			await criteriaRepo.save(
				toInsert.map((c) => ({
					rubricQuestionId: questionId,
					criteria: c.criteria,
					minValue: c.minValue,
					maxValue: c.maxValue,
				})) as DeepPartial<RubricQuestionCriteriaEntity>[],
			);
		}
	}

	private async syncQuestions(
		rubricId: number,
		questions: NormalizedRubricQuestion[],
		manager: EntityManager,
	): Promise<void> {
		const questionRepo = manager.getRepository(RubricQuestionEntity);
		const criteriaRepo = manager.getRepository(RubricQuestionCriteriaEntity);

		const incomingIds = questions.filter((q) => q.id).map((q) => q.id as number);

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
				question: q.question,
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
				question: q.question,
			} as DeepPartial<RubricQuestionEntity>);

			if (criterias && criterias.length > 0) {
				await criteriaRepo.save(
					criterias.map((c) => ({
						rubricQuestionId: saved.id,
						criteria: c.criteria,
						minValue: c.minValue,
						maxValue: c.maxValue,
					})) as DeepPartial<RubricQuestionCriteriaEntity>[],
				);
			}
		}
	}
}
