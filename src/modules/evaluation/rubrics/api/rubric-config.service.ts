import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { RubricEntity } from '../model/rubrics.entity';
import { CreateRubricDto } from '../model/rubrics.dtos';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { CourseOutcomeMappingEntity } from 'src/modules/academic/course-outcome-mappings/model/course-outcome-mappings.entity';
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
 * - R-RUB-008: Una sola rúbrica por (study_plan_course_id, grade_type_id)
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
		private readonly dataSource: DataSource,
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
	 * 1. Si es Capstone, todas las preguntas DEBEN tener outcome_id
	 * 2. El study_plan_course_id debe existir en la BD
	 * 3. Todo se guarda de forma transaccional o se revierte
	 * 4. Tras crear, recalcula la nota máxima total (R-RUB-014)
	 */
	async createRubric(dto: CreateRubricDto): Promise<RubricEntity> {
		const conflictingRubric = (
			await this.dataSource.query(
				`
			SELECT r.id
			FROM evaluation.rubrics r
			INNER JOIN academic.study_plan_courses spc ON spc.id = r.study_plan_course_id
			INNER JOIN academic.study_plan_academic_periods spap ON spap.id = spc.study_plan_academic_period_id
			INNER JOIN academic.study_plan_courses spc_target ON spc_target.id = $1
			INNER JOIN academic.study_plan_academic_periods spap_target ON spap_target.id = spc_target.study_plan_academic_period_id
			WHERE r.is_active = true
			  AND r.grade_type_id = $2
			  AND spc.course_id = spc_target.course_id
			  AND spap.academic_period_id = spap_target.academic_period_id
			  AND r.study_plan_course_id != $1
			LIMIT 1
		`,
				[dto.studyPlanCourseId, dto.gradeTypeId],
			)
		)[0] as { id: number } | undefined;

		if (conflictingRubric) {
			throw new BadRequestException(rubricsValidationStrings.error.activeRubricExistsForPeriod);
		}

		const existingRubric = await this.rubricRepo.findOne({
			where: {
				studyPlanCourseId: dto.studyPlanCourseId,
				gradeTypeId: dto.gradeTypeId,
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
			const mappings = await this.dataSource.getRepository(CourseOutcomeMappingEntity).find({
				where: { studyPlanCourseId: dto.studyPlanCourseId },
			});
			const validOutcomeIds = mappings.map((m) => m.outcomeId);
			const invalidOutcomes = outcomeIds.filter((id) => !validOutcomeIds.includes(id));
			if (invalidOutcomes.length > 0) {
				throw new BadRequestException({
					message: rubricsValidationStrings.error.invalidOutcomeMapping,
					errors: invalidOutcomes.map(String),
				});
			}
		}

		const capstoneTypeId = await this.resolveRubricTypeIdByCode(TYPE_CODES.RUBRIC_TYPE.CAPSTONE);
		const ebGradeTypeId = await this.resolveRubricTypeIdByCode(TYPE_CODES.GRADE_TYPE.EB);
		const isCapstone = capstoneTypeId != null && dto.rubricTypeId === capstoneTypeId;
		const isEbGrade = ebGradeTypeId != null && dto.gradeTypeId === ebGradeTypeId;

		// Solo se exige outcome_id en todas las preguntas si es Capstone Y el grade type es EB (Evaluación Final)
		if (isCapstone && isEbGrade) {
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

		if (!(isCapstone && isEbGrade)) {
			this.validateCriteriaScores(dto.questions);
		}

		const savedRubric = await this.dataSource.transaction(async (manager) => {
			const rubric = manager.create(RubricEntity, {
				rubricTypeId: dto.rubricTypeId,
				gradeTypeId: dto.gradeTypeId,
				studyPlanCourseId: dto.studyPlanCourseId,
				isActive: dto.isActive ?? true,
				extra: dto.extra,
			});

			const txSavedRubric = await manager.save(rubric);

			const questionEntities: RubricQuestionEntity[] = [];
			for (const questionDto of dto.questions) {
				const question = manager.create(RubricQuestionEntity, {
					rubricId: txSavedRubric.id,
					outcomeId: questionDto.outcomeId,
					question: toI18n(questionDto.question),
					isActive: true,
				});
				const savedQuestion = await manager.save(question);

				const sortedCriterias = [...questionDto.criterias].sort((a, b) => a.minValue - b.minValue);
				const criteriaEntities = sortedCriterias.map((criteriaDto) =>
					manager.create(RubricQuestionCriteriaEntity, {
						rubricQuestionId: savedQuestion.id,
						criteria: toI18n(criteriaDto.criteria),
						minValue: criteriaDto.minValue,
						maxValue: criteriaDto.maxValue,
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

		try {
			await this.recalculateMaxScore(savedRubric.id);
		} catch {
			// Recalculo no crítico para la creación
		}

		return savedRubric;
	}

	async resolveRubricType(
		studyPlanCourseId: number,
		gradeTypeId: number,
	): Promise<{ id: number; code: string; name: I18nText }> {
		const [gradeType, capstoneType, nonCapstoneType, verificationOutcomeType] = await Promise.all([
			this.typeRepo.findOne({ where: { id: gradeTypeId } }),
			this.typeRepo.findOne({ where: { code: TYPE_CODES.RUBRIC_TYPE.CAPSTONE } }),
			this.typeRepo.findOne({ where: { code: TYPE_CODES.RUBRIC_TYPE.NON_CAPSTONE } }),
			this.typeRepo.findOne({ where: { code: TYPE_CODES.OUTCOME_TYPE.VERIFICATION } }),
		]);

		if (!gradeType) throw new BadRequestException(rubricsValidationStrings.error.gradeTypeNotFound);
		if (!capstoneType || !nonCapstoneType)
			throw new BadRequestException(rubricsValidationStrings.error.rubricTypesNotConfigured);

		const isEaOrEb =
			gradeType.code === TYPE_CODES.GRADE_TYPE.EA || gradeType.code === TYPE_CODES.GRADE_TYPE.EB;

		if (isEaOrEb && verificationOutcomeType) {
			const hasVerificationOutcome = await this.dataSource
				.getRepository(CourseOutcomeMappingEntity)
				.exists({
					where: {
						studyPlanCourseId,
						outcomeTypeId: verificationOutcomeType.id,
					},
				});

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
			relations: ['questions', 'questions.criterias', 'questions.outcome'],
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
