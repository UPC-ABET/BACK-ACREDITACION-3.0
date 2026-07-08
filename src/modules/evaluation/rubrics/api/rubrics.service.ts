import { Injectable } from '@nestjs/common';
import { BaseService } from 'src/commons/base.service';
import {
	RubricRepository,
	NormalizedRubricCriteria,
	NormalizedRubricQuestion,
} from '../core/rubrics.repository';
import { RubricValidation } from '../core/rubrics.validation';
import { rubricsValidationStrings } from '../config/strings/rubrics.validation';
import {
	CreateRubricDto,
	CreateRubricCriteriaDto,
	CreateRubricQuestionDto,
	UpdateRubricDto,
} from '../model/rubrics.dtos';
import { EntityManager } from 'typeorm';
import { RubricConfigService } from './rubric-config.service';
import type { I18nText } from 'src/shared/types/i18n';
import pLimit from 'p-limit';

@Injectable()
export class RubricService extends BaseService<RubricRepository> {
	constructor(
		protected readonly repository: RubricRepository,
		private readonly rubricConfigService: RubricConfigService,
	) {
		super(repository);
	}

	private normalizeI18n(value: I18nText | string): I18nText {
		return typeof value === 'string' ? { en: value, es: value } : value;
	}

	private normalizeCriteria(criteria: CreateRubricCriteriaDto): NormalizedRubricCriteria {
		return {
			id: criteria.id,
			criteria: this.normalizeI18n(criteria.criteria),
			minValue: criteria.minValue,
			maxValue: criteria.maxValue,
		};
	}

	private normalizeQuestions(questions: CreateRubricQuestionDto[]): NormalizedRubricQuestion[] {
		return questions.map((q) => ({
			id: q.id,
			outcomeId: q.outcomeId,
			question: this.normalizeI18n(q.question),
			criterias: q.criterias?.map((c) => this.normalizeCriteria(c)),
		}));
	}

	async create(dto: CreateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateCreate(this.repository, dto);
		return await super.create(dto, manager);
	}

	async update(id: number, dto: UpdateRubricDto, manager?: EntityManager) {
		await RubricValidation.validateUpdate(this.repository, id, dto);

		const { questions, ...rubricData } = dto;

		await this.repository.updateWithQuestions(
			id,
			rubricData,
			questions !== undefined ? this.normalizeQuestions(questions) : undefined,
		);

		return await this.repository.findOneById(id);
	}

	async getAllWithFilters(filters?: {
		schoolId?: number;
		programId?: number;
		academicPeriodId?: number;
		courseId?: number;
	}) {
		const rubrics = await this.repository.findManyWithContext(filters);

		const limit = pLimit(5);
		return await Promise.all(
			rubrics.map((rubric) =>
				limit(async () => ({
					...rubric,
					programName:
						rubric.studyPlanCourse?.studyPlanAcademicPeriod?.studyPlan?.program?.name ?? null,
					isUsed: await this.repository.isUsed(rubric.id),
				})),
			),
		);
	}

	async getById(id: number) {
		const rubricWithContext = await this.rubricConfigService.getRubricWithContextData(id);
		return {
			...rubricWithContext,
			isUsed: await this.repository.isUsed(id),
		} as any;
	}

	async delete(
		id: number,
		manager?: EntityManager,
	): Promise<{ code: number; message: string; data: any }> {
		const rubric = await this.repository.findOneById(id);
		if (!rubric) {
			return { code: 2, message: rubricsValidationStrings.error.notFound, data: null };
		}

		if (await this.repository.isUsed(id)) {
			return {
				code: 1,
				message: rubricsValidationStrings.error.rubricInUse,
				data: null,
			};
		}

		await this.repository.deleteWithChildren(id);

		return { code: 0, message: rubricsValidationStrings.result.deleted, data: null };
	}
}
