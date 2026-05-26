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

	/**
	 * Determina si una rúbrica es de tipo WASC (PA) según su grade_type_id
	 */
	private async isWascRubric(gradeTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: gradeTypeId } });
		return type?.code === TYPE_CODES.GRADE_TYPE.PA;
	}

	/**
	 * Recalcula la nota máxima por pregunta y de toda la rúbrica (R-RUB-014, R-RUB-015)
	 *
	 * Para ABET (no PA): NotaOutcome = Sum(ValorMaximo)
	 * Para WASC (PA): NotaOutcome = Max(ValorMaximo)
	 *
	 * Retorna { byQuestion: Map<questionId, maxValue>, totalMaxScore }
	 */
	async recalculateMaxScore(
		rubricId: number,
	): Promise<{ byQuestion: Map<number, number>; totalMaxScore: number }> {
		const rubric = await this.rubricRepo.findOne({ where: { id: rubricId } });
		if (!rubric) throw new NotFoundException(rubricsValidationStrings.error.notFound);

		const isWasc = await this.isWascRubric(rubric.grade_type_id);

		const questions = await this.questionRepo.find({
			where: { rubric_id: rubricId },
			relations: ['criterias'],
		});

		const byQuestion = new Map<number, number>();
		let totalMaxScore = 0;

		for (const question of questions) {
			const maxValues = question.criterias.map((c) => c.max_value);
			if (maxValues.length === 0) continue;

			const questionMax = isWasc
				? Math.max(...maxValues)
				: maxValues.reduce((sum, v) => sum + v, 0);

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
		// Verificar que no exista ya una rúbrica activa para el mismo curso + grade_type + periodo académico
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
				[dto.study_plan_course_id, dto.grade_type_id],
			)
		)[0] as { id: number } | undefined;

		if (conflictingRubric) {
			throw new BadRequestException(rubricsValidationStrings.error.activeRubricExistsForPeriod);
		}

		// Verificar si ya existe una rúbrica activa para el mismo study_plan_course + grade_type
		const existingRubric = await this.rubricRepo.findOne({
			where: {
				study_plan_course_id: dto.study_plan_course_id,
				grade_type_id: dto.grade_type_id,
				is_active: true,
			},
		});

		if (existingRubric) {
			throw new BadRequestException(rubricsValidationStrings.error.activeRubricExists);
		}

		const outcomeIds = dto.questions
			.map((q) => q.outcome_id)
			.filter((id): id is number => id != null);
		if (outcomeIds.length > 0) {
			const mappings = await this.dataSource.getRepository(CourseOutcomeMappingEntity).find({
				where: { study_plan_course_id: dto.study_plan_course_id },
			});
			const validOutcomeIds = mappings.map((m) => m.outcome_id);
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
		const isCapstone = capstoneTypeId != null && dto.rubric_type_id === capstoneTypeId;
		const isEbGrade = ebGradeTypeId != null && dto.grade_type_id === ebGradeTypeId;

		// Solo se exige outcome_id en todas las preguntas si es Capstone Y el grade type es EB (Evaluación Final)
		if (isCapstone && isEbGrade) {
			const hasMissingOutcomes = dto.questions.some((q) => !q.outcome_id);
			if (hasMissingOutcomes) {
				throw new BadRequestException(rubricsValidationStrings.error.capstoneRequiresOutcome);
			}
		}

		const courseExists = await this.courseRepo.exists({
			where: { id: dto.study_plan_course_id },
		});
		if (!courseExists) {
			throw new NotFoundException(rubricsValidationStrings.error.studyPlanCourseNotFound);
		}

		const savedRubric = await this.dataSource.transaction(async (manager) => {
			const rubric = manager.create(RubricEntity, {
				rubric_type_id: dto.rubric_type_id,
				grade_type_id: dto.grade_type_id,
				study_plan_course_id: dto.study_plan_course_id,
				is_active: dto.is_active ?? true,
				extra: dto.extra,
			});

			const txSavedRubric = await manager.save(rubric);

			const questionEntities: RubricQuestionEntity[] = [];
			for (const questionDto of dto.questions) {
				const question = manager.create(RubricQuestionEntity, {
					rubric_id: txSavedRubric.id,
					outcome_id: questionDto.outcome_id,
					question: toI18n(questionDto.question),
					is_active: true,
				});
				const savedQuestion = await manager.save(question);

				const criteriaEntities = questionDto.criterias.map((criteriaDto) =>
					manager.create(RubricQuestionCriteriaEntity, {
						rubric_question_id: savedQuestion.id,
						criteria: toI18n(criteriaDto.criteria),
						min_value: criteriaDto.min_value,
						max_value: criteriaDto.max_value,
						is_active: true,
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

	/**
	 * Obtiene una rúbrica completa por curso, incluyendo todas sus preguntas y criterios
	 */
	async getRubricByCourse(courseId: number): Promise<RubricEntity> {
		const rubric = await this.rubricRepo.findOne({
			where: { study_plan_course_id: courseId },
			relations: ['questions', 'questions.criterias', 'questions.outcome'],
		});

		if (!rubric) {
			throw new NotFoundException(rubricsValidationStrings.error.noRubricForCourse);
		}

		return rubric;
	}

	/**
	 * Obtiene una rúbrica por ID con toda su estructura
	 */
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
		// 1. Obtener rúbrica con relaciones directas
		const rubric = await this.rubricRepo.findOne({
			where: { id },
			relations: [
				'questions',
				'questions.criterias',
				'questions.outcome',
				'grade_type',
				'rubric_type',
				'study_plan_course',
				'study_plan_course.course',
				'study_plan_course.study_plan_academic_period',
				'study_plan_course.study_plan_academic_period.study_plan',
				'study_plan_course.study_plan_academic_period.study_plan.program',
				'study_plan_course.study_plan_academic_period.academic_period',
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

		// 2. Obtener comisiones directamente desde los program_commission_id de los outcomes
		const commissionIds = [
			...new Set(
				(rubric.questions || [])
					.filter((q) => q.outcome?.program_commission_id != null)
					.map((q) => q.outcome!.program_commission_id),
			),
		];

		let commissions: ProgramCommissionEntity[] = [];
		if (commissionIds.length > 0) {
			commissions = await this.programCommissionRepo.find({
				where: { id: In(commissionIds) },
				relations: ['commission'],
			});
		}

		// 3. Normalizar datos: crear arrays sin anidamiento profundo
		const outcomeToQuestions = new Map<number, number[]>();
		const commissionToOutcomes = new Map<number, number[]>();

		const questionsMap = new Map<number, any>();
		const outcomesMap = new Map<number, any>();

		(rubric.questions || []).forEach((q) => {
			questionsMap.set(q.id, {
				id: q.id,
				text: q.question,
				outcomeId: q.outcome_id,
				criterias: (q.criterias || [])
					.sort((a, b) => a.id - b.id)
					.map((c) => ({
						id: c.id,
						text: c.criteria,
						min_value: c.min_value,
						max_value: c.max_value,
					})),
			});

			if (q.outcome_id) {
				if (!outcomeToQuestions.has(q.outcome_id)) {
					outcomeToQuestions.set(q.outcome_id, []);
				}
				outcomeToQuestions.get(q.outcome_id)!.push(q.id);

				if (q.outcome && !outcomesMap.has(q.outcome.id)) {
					outcomesMap.set(q.outcome.id, {
						id: q.outcome.id,
						code: q.outcome.outcome_code,
						name: q.outcome.outcome_name,
						description: q.outcome.outcome_description,
						program_commission_id: q.outcome.program_commission_id,
					});
				}
			}
		});

		(Array.from(outcomesMap.values()) as any).forEach((outcome: any) => {
			const commission = commissions.find((c) => c.id === outcome.program_commission_id);
			if (commission) {
				if (!commissionToOutcomes.has(commission.id)) {
					commissionToOutcomes.set(commission.id, []);
				}
				commissionToOutcomes.get(commission.id)!.push(outcome.id);
			}
		});

		// 4. Construir respuesta normalizada
		return {
			rubric: {
				id: rubric.id,
				rubric_type_id: rubric.rubric_type_id,
				grade_type_id: rubric.grade_type_id,
				study_plan_course_id: rubric.study_plan_course_id,
				is_active: rubric.is_active ?? false,
				created_at: rubric.created_at,
				rubric_type: rubric.rubric_type
					? {
							id: rubric.rubric_type.id,
							code: rubric.rubric_type.code,
							name: rubric.rubric_type.name,
						}
					: undefined,
				grade_type: rubric.grade_type
					? {
							id: rubric.grade_type.id,
							code: rubric.grade_type.code,
							name: rubric.grade_type.name,
						}
					: undefined,
			},
			course: rubric.study_plan_course?.course
				? {
						id: rubric.study_plan_course.course.id,
						name: rubric.study_plan_course.course.name,
						description: rubric.study_plan_course.course.description,
						learning_outcome: rubric.study_plan_course.course.learning_outcome,
					}
				: undefined,
			academicPeriod: rubric.study_plan_course?.study_plan_academic_period?.academic_period
				? {
						id: rubric.study_plan_course.study_plan_academic_period.academic_period.id,
						code: rubric.study_plan_course.study_plan_academic_period.academic_period.code,
						start_date:
							rubric.study_plan_course.study_plan_academic_period.academic_period.start_date,
						end_date: rubric.study_plan_course.study_plan_academic_period.academic_period.end_date,
					}
				: undefined,
			studyPlan: rubric.study_plan_course?.study_plan_academic_period?.study_plan
				? {
						id: rubric.study_plan_course.study_plan_academic_period.study_plan.id,
						code: rubric.study_plan_course.study_plan_academic_period.study_plan.code,
						name: rubric.study_plan_course.study_plan_academic_period.study_plan.name,
					}
				: undefined,
			program: rubric.study_plan_course?.study_plan_academic_period?.study_plan?.program
				? {
						id: rubric.study_plan_course.study_plan_academic_period.study_plan.program.id,
						code: rubric.study_plan_course.study_plan_academic_period.study_plan.program.code,
						name: rubric.study_plan_course.study_plan_academic_period.study_plan.program.name,
						degree: rubric.study_plan_course.study_plan_academic_period.study_plan.program.degree,
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
