import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RubricEntity } from '../model/rubrics.entity';
import { CreateRubricDto } from '../model/rubrics.dtos';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricConfigRepository } from '../core/rubric-config.repository';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { toI18n } from 'src/shared/types/i18n';
import type { I18nText } from 'src/shared/types/i18n';
import { rubricsValidationStrings } from '../config/strings/rubrics.validation';
import { ProgramCommissionEntity } from 'src/modules/accreditation/program-commissions/model/program-commissions.entity';
import { OutcomeEntity } from 'src/modules/accreditation/outcomes/model/outcomes.entity';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';

/**
 * RubricConfigService
 *
 * Servicio especializado para la configuración completa de rúbricas.
 *
 * Reglas implementadas:
 * - R-RUB-008: Una sola rúbrica activa por (study_plan_course_id, grade_type_id, competency_scope_type_id)
 * - R-RUB-012: Auto-asignación de niveles de desempeño según instrument_type
 * - R-RUB-013: ValorMaximo = max(PuntajeMayor) de niveles de desempeño aplicables
 * - R-RUB-014: Recálculo de NotaMaxima por pregunta y rúbrica
 * - R-RUB-015: En rúbrica WASC (PA) el NotaOutcome = max; en ABET = sum
 */
@Injectable()
export class RubricConfigService {
	constructor(
		@InjectRepository(RubricEntity)
		private readonly rubricRepo: Repository<RubricEntity>,
		@InjectRepository(StudyPlanCourseEntity)
		private readonly courseRepo: Repository<StudyPlanCourseEntity>,
		@InjectRepository(RubricQuestionEntity)
		private readonly questionRepo: Repository<RubricQuestionEntity>,
		@InjectRepository(RubricQuestionCriteriaEntity)
		private readonly criteriaRepo: Repository<RubricQuestionCriteriaEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@InjectRepository(ProgramCommissionEntity)
		private readonly programCommissionRepo: Repository<ProgramCommissionEntity>,
		@InjectRepository(OutcomeEntity)
		private readonly outcomeRepo: Repository<OutcomeEntity>,
		private readonly rubricConfigRepository: RubricConfigRepository,
	) {}

	private async resolveRubricTypeIdByCode(code: string): Promise<number | null> {
		const type = await this.typeRepo.findOne({ where: { code } });
		return type?.id ?? null;
	}

	async recalculateMaxScore(
		rubricId: number,
	): Promise<{ byQuestion: Map<number, number>; totalMaxScore: number }> {
		const rubric = await this.rubricRepo.findOne({ where: { id: rubricId } });
		if (!rubric) throw new NotFoundException(rubricsValidationStrings.error.notFound);

		const questions = await this.questionRepo.find({
			where: { rubricId: rubricId },
			relations: ['criterias'],
		});

		const byQuestion = new Map<number, number>();
		let totalMaxScore = 0;

		for (const question of questions) {
			const maxValues = question.criterias.map((c) => c.maxValue);
			if (maxValues.length === 0) continue;

			const questionMax = Math.max(...maxValues);

			byQuestion.set(question.id, questionMax);
			totalMaxScore += questionMax;
		}

		return { byQuestion, totalMaxScore };
	}

	/**
	 * Crea una rúbrica completa con sus preguntas y criterios de forma transaccional
	 *
	 * Validaciones:
	 * 1. Si es Capstone y Múltiple competencia, todas las preguntas DEBEN tener outcome_id
	 * 2. El study_plan_course_id debe existir en la BD
	 * 3. Todo se guarda de forma transaccional o se revierte
	 * 4. Tras crear, recalcula la nota máxima total (R-RUB-014)
	 */
	async createRubric(dto: CreateRubricDto): Promise<RubricEntity> {
		const existingRubric = await this.rubricRepo.findOne({
			where: {
				studyPlanCourseId: dto.studyPlanCourseId,
				gradeTypeId: dto.gradeTypeId,
				competencyScopeTypeId: dto.competencyScopeTypeId,
				isActive: true,
			},
		});

		if (existingRubric) {
			throw new BadRequestException(rubricsValidationStrings.error.activeRubricExists);
		}

		const outcomeIds = dto.questions
			.map((q) => q.outcomeId)
			.filter((id): id is number => id != null);
		if (outcomeIds.length > 0) {
			const validOutcomeIds = await this.rubricConfigRepository.getOutcomeIdsByCourse(
				dto.studyPlanCourseId,
			);
			const invalidOutcomes = outcomeIds.filter((id) => !validOutcomeIds.includes(id));
			if (invalidOutcomes.length > 0) {
				throw new BadRequestException({
					message: rubricsValidationStrings.error.invalidOutcomeMapping,
					errors: invalidOutcomes.map(String),
				});
			}
		}

		const capstoneTypeId = await this.resolveRubricTypeIdByCode(TYPE_CODES.RUBRIC_TYPE.CAPSTONE);
		const multipleScopeTypeId = await this.resolveRubricTypeIdByCode(
			TYPE_CODES.COMPETENCY_SCOPE.MULTIPLE,
		);
		const isCapstone = capstoneTypeId != null && dto.rubricTypeId === capstoneTypeId;
		const isMultipleScope =
			multipleScopeTypeId != null && dto.competencyScopeTypeId === multipleScopeTypeId;

		// Solo se exige outcome_id en todas las preguntas si es Capstone Y el alcance es Múltiple competencia
		if (isCapstone && isMultipleScope) {
			const hasMissingOutcomes = dto.questions.some((q) => !q.outcomeId);
			if (hasMissingOutcomes) {
				throw new BadRequestException(rubricsValidationStrings.error.capstoneRequiresOutcome);
			}
		}

		const courseExists = await this.courseRepo.exists({
			where: { id: dto.studyPlanCourseId },
		});
		if (!courseExists) {
			throw new NotFoundException(rubricsValidationStrings.error.studyPlanCourseNotFound);
		}

		if (!(isCapstone && isMultipleScope)) {
			this.validateCriteriaScores(dto.questions);
		}

		const questionInputs = dto.questions.map((questionDto) => ({
			outcomeId: questionDto.outcomeId,
			question: toI18n(questionDto.question),
			criterias: [...questionDto.criterias]
				.sort((a, b) => a.minValue - b.minValue)
				.map((criteriaDto) => ({
					criteria: toI18n(criteriaDto.criteria),
					minValue: criteriaDto.minValue,
					maxValue: criteriaDto.maxValue,
				})),
		}));

		const savedRubric = await this.rubricConfigRepository.createWithChildren(
			{
				rubricTypeId: dto.rubricTypeId,
				gradeTypeId: dto.gradeTypeId,
				competencyScopeTypeId: dto.competencyScopeTypeId,
				studyPlanCourseId: dto.studyPlanCourseId,
				isActive: dto.isActive ?? true,
				extra: dto.extra,
			},
			questionInputs,
		);

		try {
			await this.recalculateMaxScore(savedRubric.id);
		} catch {
			// Recalculo no crítico para la creación
		}

		return savedRubric;
	}

	async resolveRubricType(
		studyPlanCourseId: number,
	): Promise<{ id: number; code: string; name: I18nText }> {
		const [capstoneType, nonCapstoneType, verificationOutcomeType] = await Promise.all([
			this.typeRepo.findOne({ where: { code: TYPE_CODES.RUBRIC_TYPE.CAPSTONE } }),
			this.typeRepo.findOne({ where: { code: TYPE_CODES.RUBRIC_TYPE.NON_CAPSTONE } }),
			this.typeRepo.findOne({ where: { code: TYPE_CODES.OUTCOME_TYPE.VERIFICATION } }),
		]);

		if (!capstoneType || !nonCapstoneType)
			throw new BadRequestException(rubricsValidationStrings.error.rubricTypesNotConfigured);

		if (verificationOutcomeType) {
			const hasVerificationOutcome = await this.rubricConfigRepository.hasVerificationOutcome(
				studyPlanCourseId,
				verificationOutcomeType.id,
			);

			if (hasVerificationOutcome) {
				return { id: capstoneType.id, code: capstoneType.code, name: capstoneType.name };
			}
		}

		return { id: nonCapstoneType.id, code: nonCapstoneType.code, name: nonCapstoneType.name };
	}

	async getRubricByCourse(courseId: number): Promise<RubricEntity> {
		const rubric = await this.rubricRepo.findOne({
			where: { studyPlanCourseId: courseId },
			relations: ['questions', 'questions.criterias', 'questions.outcome'],
		});

		if (!rubric) {
			throw new NotFoundException(rubricsValidationStrings.error.noRubricForCourse);
		}

		return rubric;
	}

	private validateCriteriaScores(
		questions: { criterias: { minValue: number; maxValue: number }[] }[],
	): void {
		// Per-question: minValue <= maxValue, no overlaps
		for (let qi = 0; qi < questions.length; qi++) {
			const sorted = [...questions[qi].criterias].sort((a, b) => a.minValue - b.minValue);
			for (let ci = 0; ci < sorted.length; ci++) {
				const c = sorted[ci];
				if (c.minValue > c.maxValue) {
					throw new BadRequestException({
						message: rubricsValidationStrings.error.criteriaInvalidRange,
						errors: [
							`question ${qi + 1}, criteria ${ci + 1}: minValue (${c.minValue}) > maxValue (${c.maxValue})`,
						],
					});
				}
				if (ci > 0) {
					const prev = sorted[ci - 1];
					if (c.minValue <= prev.maxValue) {
						throw new BadRequestException({
							message: rubricsValidationStrings.error.criteriaOverlap,
							errors: [
								`question ${qi + 1}: criteria ${ci} (max ${prev.maxValue}) overlaps criteria ${ci + 1} (min ${c.minValue})`,
							],
						});
					}
				}
			}
		}

		// Sum of each question's highest maxValue must equal 20
		const total = questions.reduce((sum, q) => {
			const maxVal = Math.max(...q.criterias.map((c) => c.maxValue));
			return sum + maxVal;
		}, 0);

		if (Math.round(total * 1e6) !== Math.round(20 * 1e6)) {
			throw new BadRequestException({
				message: rubricsValidationStrings.error.criteriaTotalNot20,
				errors: [`sum of max scores per question = ${total}, expected 20`],
			});
		}
	}

	async getRubricById(id: number): Promise<RubricEntity> {
		const rubric = await this.rubricRepo.findOne({
			where: { id },
			relations: ['questions', 'questions.criterias', 'questions.outcome', 'competencyScopeType'],
		});

		if (!rubric) {
			throw new NotFoundException(rubricsValidationStrings.error.notFound);
		}

		return rubric;
	}

	/**
	 * Obtiene una rúbrica por ID con estructura normalizada para frontend:
	 * - rubric: información base
	 * - commissions: array de comisiones con outcomeIds
	 * - outcomes: array de outcomes con questionIds
	 * - questions: array de preguntas con criterias
	 */
	async getRubricWithContextData(id: number): Promise<any> {
		const rubric = await this.rubricRepo.findOne({
			where: { id },
			relations: [
				'questions',
				'questions.criterias',
				'questions.outcome',
				'gradeType',
				'rubricType',
				'competencyScopeType',
				'studyPlanCourse',
				'studyPlanCourse.course',
				'studyPlanCourse.studyPlanAcademicPeriod',
				'studyPlanCourse.studyPlanAcademicPeriod.studyPlan',
				'studyPlanCourse.studyPlanAcademicPeriod.studyPlan.program',
				'studyPlanCourse.studyPlanAcademicPeriod.academicPeriod',
			],
			order: {
				questions: {
					id: 'ASC',
					criterias: {
						id: 'ASC',
					},
				},
			},
		});

		if (!rubric) {
			throw new NotFoundException(rubricsValidationStrings.error.notFound);
		}

		const commissionIds = [
			...new Set(
				(rubric.questions || [])
					.filter((q) => q.outcome?.programCommissionId != null)
					.map((q) => q.outcome!.programCommissionId),
			),
		];

		let commissions: ProgramCommissionEntity[] = [];
		if (commissionIds.length > 0) {
			commissions = await this.programCommissionRepo.find({
				where: { id: In(commissionIds) },
				relations: ['commission'],
			});
		}

		const outcomeToQuestions = new Map<number, number[]>();
		const commissionToOutcomes = new Map<number, number[]>();

		const questionsMap = new Map<number, any>();
		const outcomesMap = new Map<number, any>();

		(rubric.questions || []).forEach((q) => {
			questionsMap.set(q.id, {
				id: q.id,
				text: q.question,
				outcomeId: q.outcomeId,
				criterias: (q.criterias || [])
					.sort((a, b) => a.id - b.id)
					.map((c) => ({
						id: c.id,
						text: c.criteria,
						minValue: c.minValue,
						maxValue: c.maxValue,
					})),
			});

			if (q.outcomeId) {
				if (!outcomeToQuestions.has(q.outcomeId)) {
					outcomeToQuestions.set(q.outcomeId, []);
				}
				outcomeToQuestions.get(q.outcomeId)!.push(q.id);

				if (q.outcome && !outcomesMap.has(q.outcome.id)) {
					outcomesMap.set(q.outcome.id, {
						id: q.outcome.id,
						code: q.outcome.outcomeCode,
						name: q.outcome.outcomeName,
						description: q.outcome.outcomeDescription,
						programCommissionId: q.outcome.programCommissionId,
					});
				}
			}
		});

		(Array.from(outcomesMap.values()) as any).forEach((outcome: any) => {
			const commission = commissions.find((c) => c.id === outcome.programCommissionId);
			if (commission) {
				if (!commissionToOutcomes.has(commission.id)) {
					commissionToOutcomes.set(commission.id, []);
				}
				commissionToOutcomes.get(commission.id)!.push(outcome.id);
			}
		});

		return {
			rubric: {
				id: rubric.id,
				rubricTypeId: rubric.rubricTypeId,
				gradeTypeId: rubric.gradeTypeId,
				competencyScopeTypeId: rubric.competencyScopeTypeId,
				studyPlanCourseId: rubric.studyPlanCourseId,
				isActive: rubric.isActive ?? false,
				createdAt: rubric.createdAt,
				rubricType: rubric.rubricType
					? {
							id: rubric.rubricType.id,
							code: rubric.rubricType.code,
							name: rubric.rubricType.name,
						}
					: undefined,
				gradeType: rubric.gradeType
					? {
							id: rubric.gradeType.id,
							code: rubric.gradeType.code,
							name: rubric.gradeType.name,
						}
					: undefined,
				competencyScopeType: rubric.competencyScopeType
					? {
							id: rubric.competencyScopeType.id,
							code: rubric.competencyScopeType.code,
							name: rubric.competencyScopeType.name,
						}
					: undefined,
			},
			course: rubric.studyPlanCourse?.course
				? {
						id: rubric.studyPlanCourse.course.id,
						name: rubric.studyPlanCourse.course.name,
						description: rubric.studyPlanCourse.course.description,
						learningOutcome: rubric.studyPlanCourse.course.learningOutcome,
					}
				: undefined,
			academicPeriod: rubric.studyPlanCourse?.studyPlanAcademicPeriod?.academicPeriod
				? {
						id: rubric.studyPlanCourse.studyPlanAcademicPeriod.academicPeriod.id,
						code: rubric.studyPlanCourse.studyPlanAcademicPeriod.academicPeriod.code,
						startDate: rubric.studyPlanCourse.studyPlanAcademicPeriod.academicPeriod.startDate,
						endDate: rubric.studyPlanCourse.studyPlanAcademicPeriod.academicPeriod.endDate,
					}
				: undefined,
			studyPlan: rubric.studyPlanCourse?.studyPlanAcademicPeriod?.studyPlan
				? {
						id: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.id,
						code: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.code,
						name: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.name,
					}
				: undefined,
			program: rubric.studyPlanCourse?.studyPlanAcademicPeriod?.studyPlan?.program
				? {
						id: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.program.id,
						code: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.program.code,
						name: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.program.name,
						degree: rubric.studyPlanCourse.studyPlanAcademicPeriod.studyPlan.program.degree,
					}
				: undefined,
			commissions: commissions.map((c) => ({
				id: c.id,
				code: c.commission?.code,
				name: c.commission?.name,
				outcomeIds: commissionToOutcomes.get(c.id) || [],
			})),
			outcomes: Array.from(outcomesMap.values()).map((outcome: any) => ({
				id: outcome.id,
				code: outcome.code,
				name: outcome.name,
				description: outcome.description,
				questionIds: outcomeToQuestions.get(outcome.id) || [],
			})),
			questions: Array.from(questionsMap.values()),
			isUsed: false,
		};
	}
}
