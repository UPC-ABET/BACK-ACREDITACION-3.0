import {
	Injectable,
	NotFoundException,
	BadRequestException,
	ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { EvaluationEntity } from '../model/evaluations.entity';
import {
	SubmitEvaluationDto,
	SaveObservationDto,
	FinalizeProjectDto,
} from '../model/evaluations.dtos';
import { ProjectStudentEntity } from 'src/modules/evaluation/project-students/model/project-students.entity';
import { ProjectEvaluatorEntity } from 'src/modules/evaluation/project-evaluators/model/project-evaluators.entity';
import { RubricQuestionCriteriaEntity } from 'src/modules/evaluation/rubric-question-criterias/model/rubric-question-criterias.entity';
import { RubricQuestionEntity } from 'src/modules/evaluation/rubric-questions/model/rubric-questions.entity';
import { RubricEntity } from 'src/modules/evaluation/rubrics/model/rubrics.entity';
import { StudentCourseOutcomeGradeEntity } from 'src/modules/evidence/student-course-outcome-grades/model/student-course-outcome-grades.entity';
import { StudentSectionEnrollmentEntity } from 'src/modules/academic/student-section-enrollments/model/student-section-enrollments.entity';
import { ProjectEntity } from 'src/modules/evaluation/projects/model/projects.entity';
import { RubricScoreEntity } from 'src/modules/evaluation/rubric-scores/model/rubric-scores.entity';
import { TypeEntity } from 'src/modules/core/types/model/types.entity';
import { PerformanceLevelEntity } from 'src/modules/academic/performance-levels/model/performance-levels.entity';
import { StudyPlanCourseEntity } from 'src/modules/academic/study-plan-courses/model/study-plan-courses.entity';
import { StudyPlanAcademicPeriodEntity } from 'src/modules/academic/study-plan-academic-periods/model/study-plan-academic-periods.entity';
import { type I18nText, i18nText, i18nTrim } from 'src/shared/types/i18n';
import { TYPE_CODES } from 'src/modules/core/types/constants/type-codes';
import { evaluationsValidationStrings } from '../config/strings/evaluations.validation';

/**
 * EvaluationSubmissionService
 *
 * Servicio que implementa la lógica de calificación de rúbricas (flujo completo).
 *
 * Reglas de negocio implementadas:
 * - R-NOT-001: Cálculo de Nivel Alcanzado por outcome (umbrales 0.33/0.67)
 * - R-NOT-002: Nota final escalada a vigesimal (20)
 * - R-NOT-003: NotaOutcome = Sum(NotaCriterio)
 * - R-NOT-004: NotaRubrica = Sum(NotaOutcome)
 * - R-NOT-005: Guardada se activa si hay observación o todos los criterios están completos
 * - R-NOT-008: Comité (COM) escribe directo (sobrescribe, no promedia)
 * - R-NOT-009: Gerente (GER) en WASC escribe directo (sin promediar)
 * - R-NOT-010: Validación de rango de puntaje contra min_value/max_value del criterio
 * - R-NOT-011: Exclusión de alumnos retirados en finalización
 * - R-NOT-012: Validación de completitud al guardar calificación
 * - R-NOT-013: Observación obligatoria salvo en PA
 * - R-NOT-014: Observación vacía revierte estado
 * - R-NOT-015: Rol DOC (docente) solo visualiza, no califica
 * - R-NOT-016: Máximo 1 evaluador por tipo de rol en el proyecto
 */
@Injectable()
export class EvaluationSubmissionService {
	constructor(
		@InjectRepository(EvaluationEntity)
		private readonly evaluationRepo: Repository<EvaluationEntity>,
		@InjectRepository(ProjectStudentEntity)
		private readonly studentRepo: Repository<ProjectStudentEntity>,
		@InjectRepository(ProjectEvaluatorEntity)
		private readonly evaluatorRepo: Repository<ProjectEvaluatorEntity>,
		@InjectRepository(RubricQuestionCriteriaEntity)
		private readonly criteriaRepo: Repository<RubricQuestionCriteriaEntity>,
		@InjectRepository(RubricQuestionEntity)
		private readonly questionRepo: Repository<RubricQuestionEntity>,
		@InjectRepository(RubricEntity)
		private readonly rubricRepo: Repository<RubricEntity>,
		@InjectRepository(RubricScoreEntity)
		private readonly scoreRepo: Repository<RubricScoreEntity>,
		@InjectRepository(StudentCourseOutcomeGradeEntity)
		private readonly outcomeGradeRepo: Repository<StudentCourseOutcomeGradeEntity>,
		@InjectRepository(StudentSectionEnrollmentEntity)
		private readonly enrollmentRepo: Repository<StudentSectionEnrollmentEntity>,
		@InjectRepository(ProjectEntity)
		private readonly projectRepo: Repository<ProjectEntity>,
		@InjectRepository(TypeEntity)
		private readonly typeRepo: Repository<TypeEntity>,
		@InjectRepository(PerformanceLevelEntity)
		private readonly performanceLevelRepo: Repository<PerformanceLevelEntity>,
		@InjectRepository(StudyPlanCourseEntity)
		private readonly studyPlanCourseRepo: Repository<StudyPlanCourseEntity>,
		private readonly dataSource: DataSource,
	) {}

	private computeLevel(score: number, maxValue: number): number {
		if (!maxValue || maxValue === 0) return 1;
		const ratio = Math.round((score / maxValue) * 100) / 100;
		if (ratio >= 0 && ratio <= 0.33) return 1;
		if (ratio >= 0.34 && ratio <= 0.67) return 2;
		return 3;
	}

	private scaleTo20(notaRubrica: number, notaMaxima: number): number {
		if (!notaMaxima || notaMaxima === 0) return 0;
		return Math.round(((notaRubrica * 20) / notaMaxima) * 100) / 100;
	}

	private async resolveEvaluatorTypeCode(evaluatorTypeId: number): Promise<string | null> {
		const type = await this.typeRepo.findOne({ where: { id: evaluatorTypeId } });
		return type?.code ?? null;
	}

	private async canEvaluatorTypeGrade(evaluatorTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: evaluatorTypeId } });
		return type?.extra?.can_evaluate === true;
	}

	private async resolveStatusTypeIdByCode(code: string): Promise<number> {
		const type = await this.typeRepo.findOne({ where: { code } });
		if (!type) {
			throw new BadRequestException(
				`Tipo de estado de calificación con código '${code}' no encontrado en core.types.`,
			);
		}
		return type.id;
	}

	private async isPaRubric(rubricId?: number, gradeTypeId?: number): Promise<boolean> {
		if (!gradeTypeId && !rubricId) return false;
		let gTypeId = gradeTypeId;
		if (!gTypeId && rubricId) {
			const rubric = await this.rubricRepo.findOne({ where: { id: rubricId } });
			gTypeId = rubric?.gradeTypeId;
		}
		if (!gTypeId) return false;
		const type = await this.typeRepo.findOne({ where: { id: gTypeId } });
		return type?.code === TYPE_CODES.GRADE_TYPE.PA;
	}

	private async isCapstoneRubric(rubricTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: rubricTypeId } });
		return type?.code === TYPE_CODES.RUBRIC_TYPE.CAPSTONE;
	}

	private async isFinalEvaluation(gradeTypeId: number): Promise<boolean> {
		const type = await this.typeRepo.findOne({ where: { id: gradeTypeId } });
		return type?.code === TYPE_CODES.GRADE_TYPE.EB;
	}

	private async getValidPerformanceLevelValues(rubric: RubricEntity): Promise<Set<number>> {
		const course = await this.studyPlanCourseRepo.findOne({
			where: { id: rubric.studyPlanCourseId },
			relations: ['studyPlanAcademicPeriod'],
		});
		const academicPeriodId = course?.studyPlanAcademicPeriod?.academicPeriodId;
		if (!academicPeriodId) return new Set();

		const instrType = await this.typeRepo.findOne({
			where: { code: TYPE_CODES.PERF_LEVEL_INSTRUMENT.TYPE },
		});
		if (!instrType) return new Set();

		const levels = await this.performanceLevelRepo.find({
			where: { instrumentTypeId: instrType.id, academicPeriodId: academicPeriodId },
		});
		return new Set(levels.map((l) => Number(l.uniqueValue)));
	}

	private async getRubricForProject(
		projectId: number,
	): Promise<{ rubric: RubricEntity | null; studyPlanCourseId: number | null }> {
		const student = await this.studentRepo.findOne({
			where: { projectId: projectId },
			relations: ['studentSectionEnrollment', 'studentSectionEnrollment.courseSection'],
		});
		if (!student?.studentSectionEnrollment) return { rubric: null, studyPlanCourseId: null };

		const courseSection = student.studentSectionEnrollment.courseSection;
		const courseId = courseSection?.courseId;
		const academicPeriodId = courseSection?.academicPeriodId;
		if (!courseId || !academicPeriodId) return { rubric: null, studyPlanCourseId: null };

		const rubric = await this.rubricRepo
			.createQueryBuilder('r')
			.innerJoin(StudyPlanCourseEntity, 'spc', 'spc.id = r.study_plan_course_id')
			.innerJoin(
				StudyPlanAcademicPeriodEntity,
				'spap',
				'spap.id = spc.study_plan_academic_period_id',
			)
			.leftJoinAndSelect('r.questions', 'questions')
			.leftJoinAndSelect('questions.criterias', 'criterias')
			.where('spc.course_id = :courseId', { courseId })
			.andWhere('spap.academic_period_id = :academicPeriodId', { academicPeriodId })
			.getOne();

		return { rubric: rubric ?? null, studyPlanCourseId: rubric?.studyPlanCourseId ?? null };
	}

	private async aggregateScoresByOutcome(
		manager: EntityManager,
		evaluationId: number,
	): Promise<{
		scoresByQuestion: Map<number, { notaOutcome: number; notaMaxOutcome: number }>;
		notaRubrica: number;
		notaMaximaRubrica: number;
		outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>;
	}> {
		const allScores = await manager.find(RubricScoreEntity, {
			where: { evaluationId: evaluationId },
			relations: ['rubricQuestionCriteria', 'rubricQuestionCriteria.question'],
		});

		const scoresByQuestion = new Map<
			number,
			{ scores: RubricScoreEntity[]; maxValues: number[] }
		>();
		for (const score of allScores) {
			const questionId = score.rubricQuestionCriteria?.rubricQuestionId;
			if (!questionId) continue;
			if (!scoresByQuestion.has(questionId)) {
				scoresByQuestion.set(questionId, { scores: [], maxValues: [] });
			}
			const bucket = scoresByQuestion.get(questionId)!;
			bucket.scores.push(score);
			bucket.maxValues.push(score.rubricQuestionCriteria.maxValue); // string, no number
		}

		let notaRubrica = 0;
		let notaMaximaRubrica = 0;
		const outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }> = [];

		const resultByQuestion = new Map<number, { notaOutcome: number; notaMaxOutcome: number }>();

		for (const [questionId, bucket] of scoresByQuestion) {
			const notaOutcome = bucket.scores.reduce((sum, s) => sum + s.score, 0);
			const notaMaxOutcome = bucket.maxValues.reduce((sum, mv) => sum + mv, 0);
			notaRubrica += notaOutcome;
			notaMaximaRubrica += notaMaxOutcome;
			resultByQuestion.set(questionId, { notaOutcome, notaMaxOutcome });

			const question = await manager.findOne(RubricQuestionEntity, { where: { id: questionId } });
			if (question?.outcomeId) {
				outcomeGrades.push({
					outcomeId: question.outcomeId,
					grade: notaOutcome,
					maxValue: notaMaxOutcome,
				});
			}
		}

		return { scoresByQuestion: resultByQuestion, notaRubrica, notaMaximaRubrica, outcomeGrades };
	}

	private async upsertOutcomeGrades(
		manager: EntityManager,
		studentSectionEnrollmentId: number,
		outcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>,
	): Promise<void> {
		for (const og of outcomeGrades) {
			const existing = await manager.findOne(StudentCourseOutcomeGradeEntity, {
				where: {
					studentSectionEnrollmentId: studentSectionEnrollmentId,
					outcomeId: og.outcomeId,
				},
			});
			if (existing) {
				existing.grade = og.grade;
				await manager.save(existing);
			} else {
				const newGrade = manager.create(StudentCourseOutcomeGradeEntity, {
					studentSectionEnrollmentId: studentSectionEnrollmentId,
					outcomeId: og.outcomeId,
					grade: og.grade,
				});
				await manager.save(newGrade);
			}
		}
	}

	private async saveEvaluationScores(
		manager: EntityManager,
		projectStudentId: number,
		projectEvaluatorId: number,
		observation: I18nText | string | null | undefined,
		scores: Array<{
			rubricQuestionCriteriaId: number;
			score: number;
			commentaries?: I18nText | string;
		}>,
		statusTypeId: number,
	): Promise<EvaluationEntity> {
		let evaluation = await manager.findOne(EvaluationEntity, {
			where: {
				projectStudentId: projectStudentId,
				projectEvaluatorId: projectEvaluatorId,
			},
		});

		if (evaluation) {
			evaluation.qualificationStatusTypeId = statusTypeId;
			if (observation !== undefined) {
				evaluation.observation = i18nText(observation);
			}
			await manager.save(evaluation);
		} else {
			evaluation = manager.create(EvaluationEntity, {
				projectStudentId: projectStudentId,
				projectEvaluatorId: projectEvaluatorId,
				qualificationStatusTypeId: statusTypeId,
				observation: i18nText(observation),
				registerAt: new Date(),
				isActive: true,
			});
			evaluation = await manager.save(evaluation);
		}

		for (const scoreDto of scores) {
			const existingScore = await manager.findOne(RubricScoreEntity, {
				where: {
					evaluationId: evaluation.id,
					rubricQuestionCriteriaId: scoreDto.rubricQuestionCriteriaId,
				},
			});

			if (existingScore) {
				existingScore.score = scoreDto.score;
				existingScore.commentaries = i18nText(scoreDto.commentaries) ?? existingScore.commentaries;
				await manager.save(existingScore);
			} else {
				const newScore = manager.create(RubricScoreEntity, {
					evaluationId: evaluation.id,
					rubricQuestionCriteriaId: scoreDto.rubricQuestionCriteriaId,
					score: scoreDto.score,
					commentaries: i18nText(scoreDto.commentaries) as any,
					isActive: true,
				});
				await manager.save(newScore);
			}
		}

		return evaluation;
	}

	/**
	 * Envía/actualiza una calificación de criterio individual.
	 *
	 * Flujo:
	 * 1. Valida evaluador/estudiante y rangos
	 * 2. Rechaza si el evaluador es de tipo DOC (solo visualiza)
	 * 3. UPSERT en rubric_scores
	 * 4. Escribe directo los outcome grades (sin promediar entre evaluadores)
	 * 5. Persiste outcome grades escalados
	 * 6. Devuelve nota vigesimal
	 */
	async submitEvaluation(
		dto: SubmitEvaluationDto,
	): Promise<{ success: boolean; evaluationId: number; scaledScore?: number }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.projectEvaluatorId },
			relations: ['project'],
		});
		const student = await this.studentRepo.findOne({
			where: { id: dto.projectStudentId },
			relations: ['project'],
		});

		if (!evaluator || !student) {
			throw new NotFoundException(evaluationsValidationStrings.error.evaluatorOrStudentNotFound);
		}
		if (!evaluator.isActive) {
			throw new BadRequestException(
				evaluationsValidationStrings.error.inactiveEvaluatorCannotGrade,
			);
		}
		if (evaluator.projectId !== student.projectId) {
			throw new ConflictException(evaluationsValidationStrings.error.notSameProject);
		}

		const evaluatorCode = await this.resolveEvaluatorTypeCode(evaluator.evaluatorTypeId);
		if (!(await this.canEvaluatorTypeGrade(evaluator.evaluatorTypeId))) {
			throw new BadRequestException(evaluationsValidationStrings.error.onlyComiteCanGrade);
		}

		const criteriaIds = dto.scores.map((s) => s.rubricQuestionCriteriaId);
		const criterias = await this.criteriaRepo.find({ where: { id: In(criteriaIds) } });

		const rubric = await this.rubricRepo.findOne({
			where: { id: dto.rubricId },
			relations: ['questions', 'questions.criterias'],
		});
		if (!rubric) {
			throw new NotFoundException(`Rúbrica con ID ${dto.rubricId} no encontrada.`);
		}

		const statusCode = await this.resolveEvaluatorTypeCode(dto.qualificationStatusTypeId);
		const isNr = statusCode === TYPE_CODES.QUALIFICATION_STATUS.NR;
		const isNa = statusCode === TYPE_CODES.QUALIFICATION_STATUS.NA;
		const isNrOrNa = isNr || isNa;

		const isCapstone = await this.isCapstoneRubric(rubric.rubricTypeId);
		const isFinal = await this.isFinalEvaluation(rubric.gradeTypeId);
		const isCapstoneFinal = isCapstone && isFinal;

		const criteriaToQuestion = new Map<number, number>();
		for (const question of rubric.questions ?? []) {
			for (const criteria of question.criterias ?? []) {
				criteriaToQuestion.set(criteria.id, question.id);
			}
		}

		if (!isNrOrNa) {
			if (isCapstoneFinal) {
				// Todos los criterios de la rúbrica deben estar en el DTO
				const allCriteriaIds = new Set(criteriaToQuestion.keys());
				const scoredIds = new Set(dto.scores.map((s) => s.rubricQuestionCriteriaId));
				const missing = [...allCriteriaIds].filter((id) => !scoredIds.has(id));
				if (missing.length > 0) {
					throw new BadRequestException(
						`Deben calificarse todos los criterios de la rúbrica. Faltan: ${missing.join(', ')}.`,
					);
				}
			} else {
				// Capstone parcial o no capstone: máximo 1 criterio por pregunta
				const countByQuestion = new Map<number, number>();
				for (const scoreDto of dto.scores) {
					const questionId = criteriaToQuestion.get(scoreDto.rubricQuestionCriteriaId);
					if (!questionId) continue;
					countByQuestion.set(questionId, (countByQuestion.get(questionId) ?? 0) + 1);
				}
				for (const [questionId, count] of countByQuestion) {
					if (count > 1) {
						throw new BadRequestException(
							`La pregunta ${questionId} tiene ${count} criterios calificados. Solo se permite uno por pregunta.`,
						);
					}
				}
			}

			const validPerfLevelValues = isCapstoneFinal
				? await this.getValidPerformanceLevelValues(rubric)
				: null;

			for (const scoreDto of dto.scores) {
				const criteria = criterias.find((c) => c.id === scoreDto.rubricQuestionCriteriaId);
				if (!criteria) {
					throw new NotFoundException(
						`Criterio con ID ${scoreDto.rubricQuestionCriteriaId} no encontrado.`,
					);
				}
				if (validPerfLevelValues) {
					if (!validPerfLevelValues.has(Number(scoreDto.score))) {
						throw new BadRequestException(
							`Puntaje ${scoreDto.score} inválido para rúbrica capstone final. Valores permitidos: ${[...validPerfLevelValues].sort((a, b) => a - b).join(', ')}.`,
						);
					}
				} else {
					if (
						Number(scoreDto.score) < Number(criteria.minValue) ||
						Number(scoreDto.score) > Number(criteria.maxValue)
					) {
						throw new BadRequestException(
							`Puntaje ${scoreDto.score} inválido. Rango: [${criteria.minValue} - ${criteria.maxValue}].`,
						);
					}
				}
			}
		}

		const scoresToSave =
			isCapstoneFinal && isNrOrNa
				? [...criteriaToQuestion.keys()].map((criteriaId) => ({
						rubricQuestionCriteriaId: criteriaId,
						score: 0,
					}))
				: dto.scores;

		const { evaluationId, finalOutcomeGrades } = await this.dataSource.transaction(
			async (manager) => {
				const evaluation = await this.saveEvaluationScores(
					manager,
					dto.projectStudentId,
					dto.projectEvaluatorId,
					dto.observation,
					scoresToSave,
					dto.qualificationStatusTypeId,
				);

				if (!isCapstoneFinal) {
					const submittedCriteriaIds = new Set(dto.scores.map((s) => s.rubricQuestionCriteriaId));
					const questionsInSubmission = new Set(
						dto.scores
							.map((s) => criteriaToQuestion.get(s.rubricQuestionCriteriaId))
							.filter((qId): qId is number => qId !== undefined),
					);
					const criteriaToDelete: number[] = [];
					for (const question of rubric.questions ?? []) {
						if (!questionsInSubmission.has(question.id)) continue;
						for (const criteria of question.criterias ?? []) {
							if (!submittedCriteriaIds.has(criteria.id)) {
								criteriaToDelete.push(criteria.id);
							}
						}
					}
					if (criteriaToDelete.length > 0) {
						await manager.delete(RubricScoreEntity, {
							evaluationId: evaluation.id,
							rubricQuestionCriteriaId: In(criteriaToDelete),
						});
					}
				}

				const isPa = await this.isPaRubric(rubric.id);

				let txOutcomeGrades: Array<{ outcomeId: number; grade: number; maxValue: number }>;

				if (evaluatorCode === TYPE_CODES.EVALUATOR_TYPE.GER && isPa) {
					const { outcomeGrades } = await this.aggregateScoresByOutcome(manager, evaluation.id);
					txOutcomeGrades = outcomeGrades;
				} else {
					const { outcomeGrades } = await this.aggregateScoresByOutcome(manager, evaluation.id);
					txOutcomeGrades = outcomeGrades;
				}

				await this.upsertOutcomeGrades(
					manager,
					student.studentSectionEnrollmentId,
					txOutcomeGrades,
				);

				return { evaluationId: evaluation.id, finalOutcomeGrades: txOutcomeGrades };
			},
		);

		const allOutcomeGrades = finalOutcomeGrades || [];
		const notaRubrica = allOutcomeGrades.reduce((s, og) => s + og.grade, 0);
		const notaMaxRubrica = allOutcomeGrades.reduce((s, og) => s + og.maxValue, 0);
		const scaledScore = this.scaleTo20(notaRubrica, notaMaxRubrica);

		return { success: true, evaluationId, scaledScore };
	}

	/**
	 * Guarda/actualiza la observación de una evaluación (R-NOT-014)
	 */
	async saveObservation(dto: SaveObservationDto): Promise<{ success: boolean }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.projectEvaluatorId },
		});

		if (!evaluator) {
			throw new NotFoundException(evaluationsValidationStrings.error.evaluatorOrStudentNotFound);
		}
		if (!evaluator.isActive) {
			throw new BadRequestException(
				evaluationsValidationStrings.error.inactiveEvaluatorCannotGrade,
			);
		}

		const evaluatorCode = await this.resolveEvaluatorTypeCode(evaluator.evaluatorTypeId);
		if (!(await this.canEvaluatorTypeGrade(evaluator.evaluatorTypeId))) {
			throw new BadRequestException(evaluationsValidationStrings.error.onlyComiteCanGrade);
		}

		const asistioStatusTypeId = await this.resolveStatusTypeIdByCode(
			TYPE_CODES.QUALIFICATION_STATUS.ASISTIO,
		);
		const nrStatusTypeId = await this.resolveStatusTypeIdByCode(TYPE_CODES.QUALIFICATION_STATUS.NR);

		await this.dataSource.transaction(async (manager) => {
			let evaluation = await manager.findOne(EvaluationEntity, {
				where: {
					projectStudentId: dto.projectStudentId,
					projectEvaluatorId: dto.projectEvaluatorId,
				},
			});

			if (!evaluation) {
				evaluation = manager.create(EvaluationEntity, {
					projectStudentId: dto.projectStudentId,
					projectEvaluatorId: dto.projectEvaluatorId,
					qualificationStatusTypeId: nrStatusTypeId,
					observation: i18nText(dto.observation),
					registerAt: new Date(),
				});
			} else {
				evaluation.observation = i18nText(dto.observation);
			}

			if (!evaluation.observation || !i18nTrim(evaluation.observation)) {
				evaluation.qualificationStatusTypeId = nrStatusTypeId;
			} else {
				evaluation.qualificationStatusTypeId = asistioStatusTypeId;
			}

			await manager.save(evaluation);
		});

		return { success: true };
	}

	/**
	 * Finaliza la calificación de un proyecto (R-NOT-011, R-NOT-012, R-NOT-013, R-NOT-015)
	 */
	async finalizeProject(dto: FinalizeProjectDto): Promise<{ success: boolean; message: string }> {
		const evaluator = await this.evaluatorRepo.findOne({
			where: { id: dto.evaluatorId },
		});

		if (!evaluator) {
			throw new NotFoundException(evaluationsValidationStrings.error.evaluatorOrStudentNotFound);
		}
		if (!evaluator.isActive) {
			throw new BadRequestException(
				evaluationsValidationStrings.error.inactiveEvaluatorCannotGrade,
			);
		}

		const evaluatorCode = await this.resolveEvaluatorTypeCode(evaluator.evaluatorTypeId);
		if (!(await this.canEvaluatorTypeGrade(evaluator.evaluatorTypeId))) {
			throw new BadRequestException(evaluationsValidationStrings.error.onlyComiteCanGrade);
		}

		const project = await this.projectRepo.findOne({
			where: { id: dto.projectId },
			relations: ['students', 'students.studentSectionEnrollment'],
		});

		if (!project) {
			throw new NotFoundException(evaluationsValidationStrings.error.projectNotFound);
		}

		const { rubric } = await this.getRubricForProject(dto.projectId);
		if (!rubric) {
			throw new BadRequestException(evaluationsValidationStrings.error.noRubricForProject);
		}

		const totalCriteria =
			rubric.questions?.reduce((sum, q) => sum + (q.criterias?.length || 0), 0) || 0;

		const asistioStatusTypeId = await this.resolveStatusTypeIdByCode(
			TYPE_CODES.QUALIFICATION_STATUS.ASISTIO,
		);

		await this.dataSource.transaction(async (manager) => {
			for (const ps of project.students) {
				const evaluation = await manager.findOne(EvaluationEntity, {
					where: {
						projectStudentId: ps.id,
						projectEvaluatorId: dto.evaluatorId,
					},
				});

				if (!ps.studentSectionEnrollment) continue;

				if (!evaluation) {
					throw new BadRequestException(
						`Debe calificar al alumno con enrollment ${ps.studentSectionEnrollmentId}.`,
					);
				}

				if (!dto.isPa && !i18nTrim(evaluation.observation)) {
					throw new BadRequestException(
						`Debe ingresar y guardar las observaciones para el alumno ${ps.studentSectionEnrollmentId}.`,
					);
				}

				const criteriaCount = await manager.count(RubricScoreEntity, {
					where: { evaluationId: evaluation.id },
				});

				if (criteriaCount < totalCriteria) {
					throw new BadRequestException(
						`Debe calificar todos los criterios para el alumno ${ps.studentSectionEnrollmentId}.`,
					);
				}

				evaluation.qualificationStatusTypeId = asistioStatusTypeId;
				await manager.save(evaluation);
			}
		});

		return { success: true, message: 'Calificación guardada exitosamente.' };
	}

	async getEvaluationById(id: number): Promise<EvaluationEntity> {
		const evaluation = await this.evaluationRepo.findOne({
			where: { id },
			relations: ['scores', 'projectStudent', 'projectEvaluator'],
		});

		if (!evaluation) {
			throw new NotFoundException(evaluationsValidationStrings.error.notFound);
		}

		return evaluation;
	}

	async getStudentEvaluations(studentId: number): Promise<EvaluationEntity[]> {
		return await this.evaluationRepo.find({
			where: { projectStudentId: studentId },
			relations: ['scores', 'projectEvaluator'],
		});
	}

	async getEvaluatorEvaluations(evaluatorId: number): Promise<EvaluationEntity[]> {
		return await this.evaluationRepo.find({
			where: { projectEvaluatorId: evaluatorId },
			relations: ['scores', 'projectStudent'],
		});
	}
}
