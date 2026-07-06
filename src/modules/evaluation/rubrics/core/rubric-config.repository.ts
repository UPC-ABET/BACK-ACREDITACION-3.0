import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseRepository } from 'src/commons/base.repository';
import { RubricEntity } from '../model/rubrics.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { CourseOutcomeMappingEntity } from 'src/modules/academic/course-outcome-mappings/model/course-outcome-mappings.entity';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import type { I18nText } from 'src/shared/types/i18n';

export interface NewRubricData {
	rubricTypeId: number;
	gradeTypeId: number;
	competencyScopeTypeId: number;
	studyPlanCourseId: number;
	isActive: boolean;
	extra?: any;
}

export interface NewRubricCriteria {
	criteria: I18nText;
	minValue: number;
	maxValue: number;
}

export interface NewRubricQuestion {
	outcomeId?: number;
	question: I18nText;
	criterias: NewRubricCriteria[];
}

export class RubricConfigRepository extends BaseRepository<RubricEntity> {
	constructor(
		@InjectRepository(RubricEntity)
		repository: Repository<RubricEntity>,
		dataSource: DataSource,
	) {
		super(repository, dataSource);
	}

	async getOutcomeIdsByCourse(studyPlanCourseId: number): Promise<number[]> {
		const mappings = await this.dataSource.getRepository(CourseOutcomeMappingEntity).find({
			where: { studyPlanCourseId },
		});
		return mappings.map((m) => m.outcomeId);
	}

	async hasVerificationOutcome(studyPlanCourseId: number, outcomeTypeId: number): Promise<boolean> {
		return await this.dataSource.getRepository(CourseOutcomeMappingEntity).exists({
			where: {
				studyPlanCourseId,
				outcomeTypeId,
			},
		});
	}

	/**
	 * Verification outcomes mapped to the course, implicitly grouped by commission
	 * (each outcome belongs to a single commission via outcome.programCommissionId).
	 */
	async getVerificationOutcomesByCourse(
		studyPlanCourseId: number,
		verificationOutcomeTypeId: number,
	): Promise<Array<{ outcomeId: number; programCommissionId: number | null }>> {
		const mappings = await this.dataSource.getRepository(CourseOutcomeMappingEntity).find({
			where: { studyPlanCourseId, outcomeTypeId: verificationOutcomeTypeId },
			relations: ['outcome'],
		});
		return mappings.map((m) => ({
			outcomeId: m.outcomeId,
			programCommissionId: m.outcome?.programCommissionId ?? null,
		}));
	}

	/** Same as getVerificationOutcomesByCourse but returns the full outcome entities. */
	async getVerificationOutcomeEntitiesByCourse(
		studyPlanCourseId: number,
		verificationOutcomeTypeId: number,
	): Promise<OutcomeEntity[]> {
		const mappings = await this.dataSource.getRepository(CourseOutcomeMappingEntity).find({
			where: { studyPlanCourseId, outcomeTypeId: verificationOutcomeTypeId },
			relations: ['outcome'],
		});
		return mappings.map((m) => m.outcome).filter((o): o is OutcomeEntity => o != null);
	}

	async createWithChildren(
		rubricData: NewRubricData,
		questions: NewRubricQuestion[],
	): Promise<RubricEntity> {
		return await this.dataSource.transaction(async (manager) => {
			const rubric = manager.create(RubricEntity, {
				rubricTypeId: rubricData.rubricTypeId,
				gradeTypeId: rubricData.gradeTypeId,
				competencyScopeTypeId: rubricData.competencyScopeTypeId,
				studyPlanCourseId: rubricData.studyPlanCourseId,
				isActive: rubricData.isActive,
				extra: rubricData.extra,
			});

			const txSavedRubric = await manager.save(rubric);

			const questionEntities: RubricQuestionEntity[] = [];
			for (const questionInput of questions) {
				const question = manager.create(RubricQuestionEntity, {
					rubricId: txSavedRubric.id,
					outcomeId: questionInput.outcomeId,
					question: questionInput.question,
					isActive: true,
				});
				const savedQuestion = await manager.save(question);

				const criteriaEntities = questionInput.criterias.map((criteriaInput) =>
					manager.create(RubricQuestionCriteriaEntity, {
						rubricQuestionId: savedQuestion.id,
						criteria: criteriaInput.criteria,
						minValue: criteriaInput.minValue,
						maxValue: criteriaInput.maxValue,
						isActive: true,
					}),
				);

				await manager.save(criteriaEntities);
				savedQuestion.criterias = criteriaEntities;
				questionEntities.push(savedQuestion);
			}

			txSavedRubric.questions = questionEntities;
			return txSavedRubric;
		});
	}
}
